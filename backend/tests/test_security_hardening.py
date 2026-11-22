from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.core.exceptions import ValidationException
from app.services.telephony_service import default_telephony_service


@pytest.mark.asyncio
async def test_telephony_toll_fraud_blocks_unauthorized_destinations():
    """Verify that toll fraud protection rejects unauthorized/international destination prefixes."""
    with pytest.raises(ValidationException) as exc_info:
        await default_telephony_service.trigger_outbound_call(
            agent_id="mock_agent",
            owner_id="mock_owner",
            to_number="+53 1234567",  # Cuba (high-risk toll fraud range)
        )
    assert exc_info.value.code == "TELEPHONY_DESTINATION_RESTRICTED"
    assert "restricted to verified regions" in exc_info.value.message


@pytest.mark.asyncio
async def test_telephony_allows_verified_domestic_destinations():
    """Verify that legitimate domestic destinations (+91) pass the destination fraud check."""
    with patch("app.repositories.agent_repository.AgentRepository.get_agent_by_id", new_callable=AsyncMock) as mock_agent:
        mock_agent.return_value = {
            "id": "agent_123",
            "owner_id": "test_user_id_123",
            "elevenlabs_agent_id": "el_123",
        }
        with patch("app.integrations.elevenlabs_client.ElevenLabsClient.list_phone_numbers", new_callable=AsyncMock) as mock_phones:
            mock_phones.return_value = [{"phone_number_id": "ph_123"}]
            with patch("app.integrations.elevenlabs_client.ElevenLabsClient.outbound_phone_call", new_callable=AsyncMock) as mock_call:
                mock_call.return_value = {"callSid": "CA1234567890"}

                res = await default_telephony_service.trigger_outbound_call(
                    agent_id="agent_123",
                    owner_id="test_user_id_123",
                    to_number="+91 98765 43210",
                )
                assert res["success"] is True
                assert res["call_id"] == "CA1234567890"


@pytest.mark.asyncio
async def test_webhook_rejects_empty_or_spoofed_payload(async_client: AsyncClient):
    """Verify that webhook endpoint rejects invalid/spoofed payloads missing conversation_id."""
    res = await async_client.post("/api/v1/conversations/webhook", json={"junk": "payload"})
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "INVALID_WEBHOOK_PAYLOAD"


@pytest.mark.asyncio
async def test_webhook_validates_secret_when_configured(async_client: AsyncClient, monkeypatch):
    """Verify that webhook enforces X-Webhook-Secret when configured in environment."""
    from app.config import settings

    monkeypatch.setattr(settings, "webhook_secret", "super_secret_webhook_key_123")

    # Request without secret header
    res_no_key = await async_client.post(
        "/api/v1/conversations/webhook", json={"conversation_id": "conv_123"}
    )
    assert res_no_key.status_code == 401
    assert res_no_key.json()["error"]["code"] == "WEBHOOK_AUTH_FAILED"

    # Request with invalid secret header
    res_bad_key = await async_client.post(
        "/api/v1/conversations/webhook",
        json={"conversation_id": "conv_123"},
        headers={"X-Webhook-Secret": "wrong_key"},
    )
    assert res_bad_key.status_code == 401

    # Request with valid secret header
    with patch("app.services.conversation_service.ConversationService.ingest_webhook_event", new_callable=AsyncMock) as mock_ingest:
        mock_ingest.return_value = {"status": "processed", "session_id": "sess_123"}
        res_ok = await async_client.post(
            "/api/v1/conversations/webhook",
            json={"conversation_id": "conv_123"},
            headers={"X-Webhook-Secret": "super_secret_webhook_key_123"},
        )
        assert res_ok.status_code == 200
        assert res_ok.json()["status"] == "processed"
