from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.schemas.voice import VoiceModel

MOCK_VOICES = [
    VoiceModel(
        voice_id="21m00Tcm4TlvDq8ikWAM",
        name="Rachel",
        category="premade",
        description="Calm and warm conversational voice",
        preview_url="https://preview.elevenlabs.io/rachel.mp3",
        labels={"accent": "american", "gender": "female"},
    ),
    VoiceModel(
        voice_id="AZnzlk1XvdvUeBnXmlld",
        name="Domi",
        category="premade",
        description="Strong and energetic voice",
        preview_url="https://preview.elevenlabs.io/domi.mp3",
        labels={"accent": "american", "gender": "female"},
    ),
    VoiceModel(
        voice_id="custom_voice_77",
        name="Tech CEO",
        category="cloned",
        description="Custom executive clone",
        preview_url=None,
        labels={"gender": "male"},
    ),
]


@pytest.mark.asyncio
async def test_list_voices_success(async_client: AsyncClient):
    """Test retrieving voices with normalization."""
    with patch(
        "app.integrations.elevenlabs_client.ElevenLabsClient.list_voices",
        new_callable=AsyncMock,
        return_value=MOCK_VOICES,
    ):
        res = await async_client.get("/api/v1/voices")
        assert res.status_code == 200
        data = res.json()
        assert data["total"] == 3
        assert data["voices"][0]["name"] == "Rachel"


@pytest.mark.asyncio
async def test_list_voices_category_filter(async_client: AsyncClient):
    """Test filtering voices by category."""
    with patch(
        "app.integrations.elevenlabs_client.ElevenLabsClient.list_voices",
        new_callable=AsyncMock,
        return_value=MOCK_VOICES,
    ):
        res = await async_client.get("/api/v1/voices?category=cloned")
        assert res.status_code == 200
        data = res.json()
        assert data["total"] == 1
        assert data["voices"][0]["name"] == "Tech CEO"


@pytest.mark.asyncio
async def test_conversation_access_undeployed_agent(async_client: AsyncClient, auth_headers: dict):
    """Test requesting conversation access for an undeployed agent fails with 422."""
    # Create agent (undeployed by default)
    agent_res = await async_client.post(
        "/api/v1/agents",
        json={
            "name": "Local Agent",
            "use_case": "customer_support",
            "configuration": {
                "name": "Local Agent",
                "description": "Test",
                "purpose": "Test",
                "use_case": "customer_support",
                "instructions": "Be helpful and kind.",
                "welcome_message": "Hello!",
            },
        },
        headers=auth_headers,
    )
    agent_id = agent_res.json()["id"]

    res = await async_client.post(
        f"/api/v1/agents/{agent_id}/conversation-access",
        headers=auth_headers,
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "AGENT_NOT_DEPLOYED"


@pytest.mark.asyncio
async def test_conversation_access_deployed_agent(
    async_client: AsyncClient, auth_headers: dict, other_user_auth_headers: dict
):
    """Test requesting conversation access for a deployed agent returns signed URL."""
    # Create agent
    agent_res = await async_client.post(
        "/api/v1/agents",
        json={
            "name": "Live Agent",
            "use_case": "customer_support",
            "configuration": {
                "name": "Live Agent",
                "description": "Test",
                "purpose": "Test",
                "use_case": "customer_support",
                "instructions": "Be helpful and kind.",
                "welcome_message": "Hello!",
            },
        },
        headers=auth_headers,
    )
    agent_id = agent_res.json()["id"]

    # Simulate deployed state in db
    from app.repositories.agent_repository import default_agent_repository

    await default_agent_repository.update_agent(
        agent_id=agent_id,
        owner_id="test_user_id_123",
        update_fields={"provider_agent_id": "convai_remote_123", "status": "active"},
    )

    fake_signed_url = "wss://api.elevenlabs.io/v1/convai/conversation?agent_id=convai_remote_123&token=signed_token_999"

    with patch(
        "app.integrations.elevenlabs_client.ElevenLabsClient.get_conversation_signed_url",
        new_callable=AsyncMock,
        return_value=fake_signed_url,
    ):
        res = await async_client.post(
            f"/api/v1/agents/{agent_id}/conversation-access",
            headers=auth_headers,
        )
        assert res.status_code == 200
        data = res.json()
        assert data["agent_id"] == agent_id
        assert data["provider_agent_id"] == "convai_remote_123"
        assert data["signed_url"] == fake_signed_url
        assert "api_key" not in str(data)

        # Other user cannot access it
        forbidden_res = await async_client.post(
            f"/api/v1/agents/{agent_id}/conversation-access",
            headers=other_user_auth_headers,
        )
        assert forbidden_res.status_code == 404


@pytest.mark.asyncio
async def test_clone_voice_success(async_client: AsyncClient):
    """Test voice cloning endpoint with valid audio sample and consent."""
    with patch(
        "app.integrations.elevenlabs_client.ElevenLabsClient.clone_voice",
        new_callable=AsyncMock,
        return_value={"voice_id": "cloned_voice_999"},
    ):
        files = {"file": ("sample.mp3", b"FAKE_AUDIO_SAMPLE_DATA_BYTES" * 30, "audio/mpeg")}
        data = {
            "name": "Priya Ambassador",
            "description": "Warm voice",
            "consent_verified": "true",
        }
        res = await async_client.post("/api/v1/voices/clone", data=data, files=files)
        assert res.status_code == 201
        res_data = res.json()
        assert res_data["name"] == "Priya Ambassador"
        assert res_data["voice_id"] == "cloned_voice_999"
        assert res_data["category"] == "cloned"


@pytest.mark.asyncio
async def test_clone_voice_missing_consent(async_client: AsyncClient):
    """Test that voice cloning is rejected without explicit consent."""
    files = {"file": ("sample.mp3", b"FAKE_AUDIO_SAMPLE_DATA_BYTES" * 30, "audio/mpeg")}
    data = {
        "name": "Unauthorized Voice",
        "description": "No consent",
        "consent_verified": "false",
    }
    res = await async_client.post("/api/v1/voices/clone", data=data, files=files)
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "CONSENT_NOT_VERIFIED"

