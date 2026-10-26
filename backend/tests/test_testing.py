import pytest
from httpx import AsyncClient

SAMPLE_CONFIG_COMPLETE = {
    "name": "High Quality Agent",
    "description": "Thoroughly configured voice AI agent",
    "purpose": "Handle appointments and questions",
    "use_case": "appointments",
    "personality": {
        "tone": "friendly and clear",
        "speaking_style": "concise and spoken",
        "pace": "normal",
        "traits": ["patient", "organized"],
    },
    "instructions": "Help patients book appointments.",
    "welcome_message": "Hello! Welcome to our dental office. How can I help you book a visit today?",
    "language": "en",
    "additional_languages": ["es"],
    "voice_id": "21m00Tcm4TlvDq8ikWAM",
    "conversation_flow": {
        "steps": [
            {
                "step_id": "step_1",
                "title": "Booking Details",
                "goal": "Collect patient name and preferred date",
                "example_phrases": ["I want an appointment"],
            }
        ],
        "fallback_policy": "Ask clarifying questions if caller intent is unclear.",
    },
    "guardrails": {
        "prohibited_topics": ["medical diagnosis", "prescriptions"],
        "max_turn_count": 25,
        "fallback_message": "I apologize, but I cannot provide clinical advice.",
        "data_privacy_rules": ["Never request credit cards over phone."],
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
        "escalation_contact": "+1-800-555-0100",
        "trigger_phrases": ["human", "representative"],
        "escalation_message": "Transferring you to our clinic manager.",
    },
}


@pytest.mark.asyncio
async def test_run_agent_tests_and_scoring(async_client: AsyncClient, auth_headers: dict):
    """Test running the 7-scenario automated evaluation suite and validating score."""
    agent_res = await async_client.post(
        "/api/v1/agents",
        json={
            "name": "High Quality Agent",
            "use_case": "appointments",
            "configuration": SAMPLE_CONFIG_COMPLETE,
        },
        headers=auth_headers,
    )
    agent_id = agent_res.json()["id"]

    # Run tests
    test_res = await async_client.post(
        f"/api/v1/agents/{agent_id}/tests",
        headers=auth_headers,
    )
    assert test_res.status_code == 200
    test_run = test_res.json()
    assert test_run["agent_id"] == agent_id
    assert test_run["total_tests"] == 7
    assert test_run["passed_tests"] == 7
    assert test_run["failed_tests"] == 0
    assert test_run["score"] == 100.0
    assert "score_breakdown" in test_run
    assert test_run["score_breakdown"]["normal_requests"] == 1.0
    assert test_run["score_breakdown"]["guardrail_adherence"] == 1.0

    test_run_id = test_run["id"]

    # List test runs for agent
    list_res = await async_client.get(f"/api/v1/agents/{agent_id}/tests", headers=auth_headers)
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    # Get single test run
    get_res = await async_client.get(
        f"/api/v1/agents/{agent_id}/tests/{test_run_id}", headers=auth_headers
    )
    assert get_res.status_code == 200
    assert get_res.json()["id"] == test_run_id
    assert len(get_res.json()["test_cases"]) == 7


@pytest.mark.asyncio
async def test_test_run_ownership_isolation(
    async_client: AsyncClient, auth_headers: dict, other_user_auth_headers: dict
):
    """Test that User B cannot access User A's test runs."""
    agent_res = await async_client.post(
        "/api/v1/agents",
        json={
            "name": "High Quality Agent",
            "use_case": "appointments",
            "configuration": SAMPLE_CONFIG_COMPLETE,
        },
        headers=auth_headers,
    )
    agent_id = agent_res.json()["id"]

    test_res = await async_client.post(
        f"/api/v1/agents/{agent_id}/tests",
        headers=auth_headers,
    )
    test_run_id = test_res.json()["id"]

    # Other user attempts access
    other_res = await async_client.get(
        f"/api/v1/agents/{agent_id}/tests/{test_run_id}", headers=other_user_auth_headers
    )
    assert other_res.status_code == 404
