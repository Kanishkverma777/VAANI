from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

SAMPLE_CONFIG = {
    "name": "Deployment Bot",
    "description": "Agent for deployment testing",
    "purpose": "Deploy to ElevenLabs",
    "use_case": "customer_support",
    "personality": {
        "tone": "helpful",
        "speaking_style": "clear",
        "pace": "normal",
        "traits": ["friendly"],
    },
    "instructions": "Help customers.",
    "welcome_message": "Hello from deployed bot!",
    "language": "en",
    "additional_languages": [],
    "voice_id": "21m00Tcm4TlvDq8ikWAM",
    "conversation_flow": {"steps": [], "fallback_policy": "Clarify"},
    "guardrails": {
        "prohibited_topics": [],
        "max_turn_count": 20,
        "fallback_message": "Cannot answer",
        "data_privacy_rules": [],
    },
    "tools": [],
    "knowledge_settings": {
        "rag_enabled": False,
        "top_k": 3,
        "confidence_threshold": 0.6,
        "source_identifiers": [],
    },
    "escalation_settings": {
        "human_handoff_enabled": True,
        "escalation_contact": None,
        "trigger_phrases": [],
        "escalation_message": "Transferring",
    },
}


@pytest.mark.asyncio
async def test_initial_deploy_success(async_client: AsyncClient, auth_headers: dict):
    """Test initial deployment calls ElevenLabs create_agent and marks agent active."""
    # Create agent
    create_res = await async_client.post(
        "/api/v1/agents",
        json={"name": "Deploy Bot", "use_case": "customer_support", "configuration": SAMPLE_CONFIG},
        headers=auth_headers,
    )
    agent_id = create_res.json()["id"]

    with patch(
        "app.integrations.elevenlabs_client.ElevenLabsClient.create_agent",
        new_callable=AsyncMock,
        return_value="elevenlabs_agent_abc123",
    ):
        deploy_res = await async_client.post(
            f"/api/v1/agents/{agent_id}/deploy",
            headers=auth_headers,
        )
        assert deploy_res.status_code == 200
        data = deploy_res.json()
        assert data["status"] == "active"
        assert data["provider_agent_id"] == "elevenlabs_agent_abc123"
        assert data["shareable_url"] is not None
        assert data["phone_deployment"]["is_simulated"] is True

    # Check status endpoint
    status_res = await async_client.get(
        f"/api/v1/agents/{agent_id}/deployment",
        headers=auth_headers,
    )
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert status_data["status"] == "active"
    assert status_data["provider_agent_id"] == "elevenlabs_agent_abc123"


@pytest.mark.asyncio
async def test_redeploy_updates_remote_agent(async_client: AsyncClient, auth_headers: dict):
    """Test deploying an already-provisioned agent calls update_agent on ElevenLabs."""
    create_res = await async_client.post(
        "/api/v1/agents",
        json={"name": "Deploy Bot", "use_case": "customer_support", "configuration": SAMPLE_CONFIG},
        headers=auth_headers,
    )
    agent_id = create_res.json()["id"]

    # Initial deploy
    with patch(
        "app.integrations.elevenlabs_client.ElevenLabsClient.create_agent",
        new_callable=AsyncMock,
        return_value="elevenlabs_agent_xyz",
    ):
        await async_client.post(f"/api/v1/agents/{agent_id}/deploy", headers=auth_headers)

    # Re-deploy
    with patch(
        "app.integrations.elevenlabs_client.ElevenLabsClient.update_agent",
        new_callable=AsyncMock,
        return_value={"status": "ok"},
    ) as mock_update:
        redeploy_res = await async_client.post(
            f"/api/v1/agents/{agent_id}/deploy", headers=auth_headers
        )
        assert redeploy_res.status_code == 200
        assert mock_update.called


@pytest.mark.asyncio
async def test_deploy_failure_recovers_state(async_client: AsyncClient, auth_headers: dict):
    """Test that provider failure sets deployment_failed and preserves local config."""
    create_res = await async_client.post(
        "/api/v1/agents",
        json={"name": "Deploy Bot", "use_case": "customer_support", "configuration": SAMPLE_CONFIG},
        headers=auth_headers,
    )
    agent_id = create_res.json()["id"]

    with patch(
        "app.integrations.elevenlabs_client.ElevenLabsClient.create_agent",
        new_callable=AsyncMock,
        side_effect=Exception("ElevenLabs API 500 error"),
    ):
        deploy_res = await async_client.post(
            f"/api/v1/agents/{agent_id}/deploy", headers=auth_headers
        )
        assert deploy_res.status_code == 502
        assert deploy_res.json()["error"]["code"] == "DEPLOYMENT_FAILED"

    # Verify agent state in db is marked deployment_failed and configuration is intact
    agent_res = await async_client.get(f"/api/v1/agents/{agent_id}", headers=auth_headers)
    assert agent_res.status_code == 200
    agent_data = agent_res.json()
    assert agent_data["status"] == "deployment_failed"
    assert agent_data["configuration"]["welcome_message"] == "Hello from deployed bot!"
