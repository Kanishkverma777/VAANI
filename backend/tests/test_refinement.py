from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

SAMPLE_CONFIG = {
    "name": "Greeter Bot",
    "description": "Office front desk agent",
    "purpose": "Greet callers",
    "use_case": "customer_support",
    "personality": {
        "tone": "formal",
        "speaking_style": "direct",
        "pace": "normal",
        "traits": ["polite"],
    },
    "instructions": "Greet visitor and ask for department.",
    "welcome_message": "Good morning. Which department do you wish to speak with?",
    "language": "en",
    "additional_languages": [],
    "voice_id": "21m00Tcm4TlvDq8ikWAM",
    "conversation_flow": {"steps": [], "fallback_policy": "Repeat"},
    "guardrails": {
        "prohibited_topics": [],
        "max_turn_count": 10,
        "fallback_message": "Fallback",
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
        "escalation_message": "Hold",
    },
}

REFINED_CONFIG = dict(SAMPLE_CONFIG)
REFINED_CONFIG["welcome_message"] = "Hey there! How can I help you today?"
REFINED_CONFIG["personality"] = {
    "tone": "warm and friendly",
    "speaking_style": "casual and brief",
    "pace": "normal",
    "traits": ["friendly", "enthusiastic"],
}
REFINED_CONFIG["additional_languages"] = ["es"]


@pytest.mark.asyncio
async def test_refine_agent_success(async_client: AsyncClient, auth_headers: dict):
    """Test refining an agent creates a new version with diff and summary."""
    # 1. Create agent
    agent_res = await async_client.post(
        "/api/v1/agents",
        json={
            "name": "Greeter Bot",
            "use_case": "customer_support",
            "configuration": SAMPLE_CONFIG,
        },
        headers=auth_headers,
    )
    agent_id = agent_res.json()["id"]

    # 2. Refine
    instruction = "Make the greeting much friendlier and shorter, and add Spanish support."
    with patch(
        "app.integrations.llm_client.LLMClient.generate_structured_json",
        new_callable=AsyncMock,
        return_value=REFINED_CONFIG,
    ):
        refine_res = await async_client.post(
            f"/api/v1/agents/{agent_id}/refine",
            json={"instruction": instruction, "configuration_version": 1},
            headers=auth_headers,
        )
        assert refine_res.status_code == 200
        data = refine_res.json()
        assert data["previous_version"] == 1
        assert data["current_version"] == 2
        assert data["configuration"]["welcome_message"] == "Hey there! How can I help you today?"
        assert "welcome_message" in data["diff"]
        assert "additional_languages" in data["diff"]


@pytest.mark.asyncio
async def test_refine_agent_version_conflict(async_client: AsyncClient, auth_headers: dict):
    """Test that specifying an outdated version triggers a 409 VERSION_CONFLICT."""
    agent_res = await async_client.post(
        "/api/v1/agents",
        json={
            "name": "Greeter Bot",
            "use_case": "customer_support",
            "configuration": SAMPLE_CONFIG,
        },
        headers=auth_headers,
    )
    agent_id = agent_res.json()["id"]

    # Request with mismatched version
    refine_res = await async_client.post(
        f"/api/v1/agents/{agent_id}/refine",
        json={"instruction": "Change greeting", "configuration_version": 99},
        headers=auth_headers,
    )
    assert refine_res.status_code == 409
    assert refine_res.json()["error"]["code"] == "VERSION_CONFLICT"


@pytest.mark.asyncio
async def test_refine_agent_ownership_boundary(
    async_client: AsyncClient, auth_headers: dict, other_user_auth_headers: dict
):
    """Test that User B cannot refine User A's agent."""
    agent_res = await async_client.post(
        "/api/v1/agents",
        json={
            "name": "Greeter Bot",
            "use_case": "customer_support",
            "configuration": SAMPLE_CONFIG,
        },
        headers=auth_headers,
    )
    agent_id = agent_res.json()["id"]

    refine_res = await async_client.post(
        f"/api/v1/agents/{agent_id}/refine",
        json={"instruction": "Change greeting"},
        headers=other_user_auth_headers,
    )
    assert refine_res.status_code == 404
