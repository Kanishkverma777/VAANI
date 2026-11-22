from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.core.security import redact_pii_for_dpdp
from app.integrations.elevenlabs_client import map_agent_config_to_elevenlabs_payload
from app.repositories.session_repository import default_session_repository
from app.schemas.agent import AgentConfiguration


@pytest.mark.asyncio
async def test_dpdp_pii_redaction_unit():
    """Verify DPDP Section 8(4) scrubbing of Indian sensitive personal identifiers."""
    raw_text = (
        "My Aadhaar is 2345 6789 0123 and PAN card is ABCDE1234F. "
        "Pay via UPI to rahul.sharma@okhdfcbank or credit card 4532-1234-5678-9010."
    )
    scrubbed = redact_pii_for_dpdp(raw_text)

    assert "2345 6789 0123" not in scrubbed
    assert "[REDACTED_AADHAAR]" in scrubbed
    assert "ABCDE1234F" not in scrubbed
    assert "[REDACTED_PAN]" in scrubbed
    assert "rahul.sharma@okhdfcbank" not in scrubbed
    assert "[REDACTED_UPI]" in scrubbed
    assert "4532-1234-5678-9010" not in scrubbed
    assert "[REDACTED_CARD]" in scrubbed


@pytest.mark.asyncio
async def test_dpdp_session_repository_redaction_and_retention():
    """Verify that SessionRepository automatically scrubs PII and sets TTL retention."""
    session_data = {
        "agent_id": "agent_dpdp_test",
        "owner_id": "user_dpdp_test",
        "provider_conversation_id": "conv_dpdp_test_123",
        "transcript": [
            {"role": "caller", "message": "My PAN is BKZPD1234K and card is 4111 2222 3333 4444"},
            {"role": "agent", "message": "Got it, your UPI is amit@paytm"},
        ],
        "summary": "Customer provided PAN BKZPD1234K for KYC verification.",
        "status": "completed",
    }

    saved = await default_session_repository.upsert_session(session_data)

    # 1. PII Redaction
    assert "[REDACTED_PAN]" in saved["transcript"][0]["message"]
    assert "BKZPD1234K" not in saved["transcript"][0]["message"]
    assert "[REDACTED_CARD]" in saved["transcript"][0]["message"]
    assert "[REDACTED_UPI]" in saved["transcript"][1]["message"]
    assert "[REDACTED_PAN]" in saved["summary"]

    # 2. TTL Retention (Section 8(7))
    assert "expires_at" in saved
    assert saved["expires_at"] is not None

    # Cleanup
    await default_session_repository.delete_session(saved["id"], owner_id="user_dpdp_test")


@pytest.mark.asyncio
async def test_dpdp_consent_notice_prepended():
    """Verify DPDP Section 6 pre-call AI disclosure notice is prepended to welcome messages."""
    config = AgentConfiguration(
        name="HDFC Bank Assistant",
        description="Banking virtual assistant",
        purpose="Assist with banking queries",
        use_case="customer_support",
        instructions="Help user with banking.",
        welcome_message="How can I help with your savings account?",
        language="hi-en",
    )
    payload = map_agent_config_to_elevenlabs_payload("HDFC Bank Assistant", config)

    first_msg = payload["conversation_config"]["agent"]["first_message"]
    prompt = payload["conversation_config"]["agent"]["prompt"]["prompt"]

    # Notice verification
    assert "AI" in first_msg
    assert "recorded" in first_msg.lower() or "assisted" in first_msg.lower()
    # Directive verification
    assert "DPDP ACT 2023" in prompt


@pytest.mark.asyncio
async def test_dpdp_right_to_erasure_endpoint(async_client: AsyncClient, auth_headers: dict):
    """Verify DPDP Section 12 Right to Erasure deletes session from DB and provider."""
    # First create a session belonging to test_user_id_123
    test_session = {
        "agent_id": "test_agent_erasure",
        "owner_id": "test_user_id_123",
        "provider_conversation_id": "conv_erasure_test_888",
        "transcript": [{"role": "caller", "message": "Please erase my data"}],
        "summary": "Caller invoked DPDP right to erasure.",
        "status": "completed",
    }
    saved = await default_session_repository.upsert_session(test_session)
    session_id = saved["id"]

    # Verify session exists
    get_res = await async_client.get(f"/api/v1/sessions/{session_id}", headers=auth_headers)
    assert get_res.status_code == 200

    # Call DELETE /api/v1/sessions/{session_id}
    with patch("app.integrations.elevenlabs_client.ElevenLabsClient.delete_conversation", new_callable=AsyncMock) as mock_del:
        mock_del.return_value = True
        del_res = await async_client.delete(f"/api/v1/sessions/{session_id}", headers=auth_headers)

        assert del_res.status_code == 200
        data = del_res.json()
        assert data["status"] == "deleted"
        assert "DPDP Act" in data["message"]

    # Verify session is now permanently gone
    get_after = await async_client.get(f"/api/v1/sessions/{session_id}", headers=auth_headers)
    assert get_after.status_code == 404
