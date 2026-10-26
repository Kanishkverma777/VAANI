from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

SAMPLE_CONFIG = {
    "name": "Analytics Bot",
    "description": "Bot for testing analytics",
    "purpose": "Analytics testing",
    "use_case": "customer_support",
    "personality": {"tone": "polite", "speaking_style": "natural", "pace": "normal", "traits": []},
    "instructions": "Help customers.",
    "welcome_message": "Hello!",
    "language": "en",
    "additional_languages": [],
    "voice_id": "21m00Tcm4TlvDq8ikWAM",
    "conversation_flow": {"steps": [], "fallback_policy": "Repeat"},
    "guardrails": {
        "prohibited_topics": [],
        "max_turn_count": 10,
        "fallback_message": "Sorry",
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

MOCK_ELEVENLABS_CONVERSATION = {
    "conversation_id": "conv_987654321",
    "status": "completed",
    "transcript": [
        {"role": "agent", "message": "Hello! How can I help you?", "time_in_call_secs": 1.2},
        {"role": "user", "message": "I'd like to book an appointment.", "time_in_call_secs": 3.5},
        {"role": "agent", "message": "Sure, tomorrow at 10 AM is open.", "time_in_call_secs": 5.8},
    ],
    "metadata": {
        "start_time_unix_secs": 1700000000,
        "call_duration_secs": 42.5,
    },
    "analysis": {
        "transcript_summary": "User scheduled an appointment for tomorrow at 10 AM.",
        "call_successful": True,
    },
    "latency_metrics": {
        "average_turn_latency_ms": 680.0,
    },
}


@pytest.mark.asyncio
async def test_session_sync_and_retrieval(async_client: AsyncClient, auth_headers: dict):
    """Test synchronizing a conversation from ElevenLabs and retrieving its transcript."""
    # Create agent
    agent_res = await async_client.post(
        "/api/v1/agents",
        json={
            "name": "Analytics Bot",
            "use_case": "customer_support",
            "configuration": SAMPLE_CONFIG,
        },
        headers=auth_headers,
    )
    agent_id = agent_res.json()["id"]

    with patch(
        "app.integrations.elevenlabs_client.ElevenLabsClient.get_conversation",
        new_callable=AsyncMock,
        return_value=MOCK_ELEVENLABS_CONVERSATION,
    ):
        sync_res = await async_client.post(
            f"/api/v1/agents/{agent_id}/sessions/sync",
            json={"provider_conversation_id": "conv_987654321"},
            headers=auth_headers,
        )
        assert sync_res.status_code == 200
        data = sync_res.json()
        assert data["provider_conversation_id"] == "conv_987654321"
        assert data["duration_seconds"] == 42.5
        assert data["outcome"] == "completed"
        assert len(data["transcript"]) == 3
        session_id = data["id"]

    # Retrieve single session
    get_res = await async_client.get(f"/api/v1/sessions/{session_id}", headers=auth_headers)
    assert get_res.status_code == 200
    assert get_res.json()["id"] == session_id
    assert get_res.json()["summary"] == "User scheduled an appointment for tomorrow at 10 AM."

    # List sessions for agent
    list_res = await async_client.get(
        f"/api/v1/agents/{agent_id}/sessions?page=1&page_size=10",
        headers=auth_headers,
    )
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["total"] == 1
    assert list_data["items"][0]["id"] == session_id


@pytest.mark.asyncio
async def test_webhook_idempotent_ingestion(async_client: AsyncClient):
    """Test webhook endpoint ingests events idempotently without duplicates."""
    payload = {
        "conversation_id": "conv_webhook_111",
        "agent_id": "convai_remote_test",
        "status": "completed",
        "outcome": "completed",
        "metadata": {"call_duration_secs": 30.0},
        "transcript": [{"role": "user", "message": "Hi"}],
    }

    # First delivery
    res1 = await async_client.post("/api/v1/conversations/webhook", json=payload)
    assert res1.status_code == 200
    assert res1.json()["status"] == "processed"

    # Second delivery with updated duration (idempotent update)
    payload["metadata"]["call_duration_secs"] = 35.0
    res2 = await async_client.post("/api/v1/conversations/webhook", json=payload)
    assert res2.status_code == 200
    assert res2.json()["status"] == "processed"


@pytest.mark.asyncio
async def test_agent_analytics_metrics(async_client: AsyncClient, auth_headers: dict):
    """Test computed analytics metrics including total sessions, avg duration, outcomes, and latency."""
    agent_res = await async_client.post(
        "/api/v1/agents",
        json={
            "name": "Analytics Bot",
            "use_case": "customer_support",
            "configuration": SAMPLE_CONFIG,
        },
        headers=auth_headers,
    )
    agent_id = agent_res.json()["id"]

    # Sync two sessions
    conv1 = dict(MOCK_ELEVENLABS_CONVERSATION)
    conv1["conversation_id"] = "session_one"
    conv1["metadata"] = {"call_duration_secs": 60.0}

    conv2 = dict(MOCK_ELEVENLABS_CONVERSATION)
    conv2["conversation_id"] = "session_two"
    conv2["metadata"] = {"call_duration_secs": 120.0}

    with patch(
        "app.integrations.elevenlabs_client.ElevenLabsClient.get_conversation",
        side_effect=[conv1, conv2],
    ):
        await async_client.post(
            f"/api/v1/agents/{agent_id}/sessions/sync",
            json={"provider_conversation_id": "session_one"},
            headers=auth_headers,
        )
        await async_client.post(
            f"/api/v1/agents/{agent_id}/sessions/sync",
            json={"provider_conversation_id": "session_two"},
            headers=auth_headers,
        )

    # Get analytics
    analytics_res = await async_client.get(
        f"/api/v1/agents/{agent_id}/analytics",
        headers=auth_headers,
    )
    assert analytics_res.status_code == 200
    analytics = analytics_res.json()
    assert analytics["agent_id"] == agent_id
    assert analytics["total_sessions"] == 2
    assert analytics["completed_sessions"] == 2
    assert analytics["total_duration_seconds"] == 180.0
    assert analytics["average_duration_seconds"] == 90.0
    assert analytics["outcomes_breakdown"].get("completed") == 2
    assert analytics["average_latency_ms"] == 680.0

    # Test aggregated overview endpoint
    overview_res = await async_client.get(
        "/api/v1/analytics/overview",
        headers=auth_headers,
    )
    assert overview_res.status_code == 200
    overview = overview_res.json()
    assert overview["total_conversations"] == 2
    assert overview["average_duration_seconds"] == 90
    assert overview["completion_rate_percent"] == 100.0

    # Test user sessions list endpoint
    sessions_res = await async_client.get(
        "/api/v1/sessions",
        headers=auth_headers,
    )
    assert sessions_res.status_code == 200
    sessions_data = sessions_res.json()
    assert sessions_data["total"] == 2
    assert len(sessions_data["items"]) == 2

