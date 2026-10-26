import pytest
from httpx import AsyncClient

SAMPLE_CONFIG = {
    "name": "Support Bot",
    "description": "General customer support voice bot",
    "purpose": "Answer inquiries",
    "use_case": "customer_support",
    "personality": {
        "tone": "helpful",
        "speaking_style": "conversational",
        "pace": "normal",
        "traits": ["friendly"],
    },
    "instructions": "Be polite, concise, and helpful.",
    "welcome_message": "Hello, thank you for calling support. How can I assist you?",
    "language": "en",
    "additional_languages": [],
    "voice_id": "21m00Tcm4TlvDq8ikWAM",
    "conversation_flow": {
        "steps": [
            {
                "step_id": "step_1",
                "title": "Welcome",
                "goal": "Greet the customer",
                "example_phrases": ["Hello"],
            }
        ],
        "fallback_policy": "Ask customer to repeat",
    },
    "guardrails": {
        "prohibited_topics": ["politics"],
        "max_turn_count": 20,
        "fallback_message": "I cannot help with that.",
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
        "trigger_phrases": ["human"],
        "escalation_message": "Connecting you now.",
    },
}


@pytest.mark.asyncio
async def test_auth_registration_and_login(async_client: AsyncClient):
    """Test user registration, login and getting current profile."""
    reg_payload = {
        "email": "sarah@example.com",
        "password": "Password123!",
        "display_name": "Sarah Connor",
    }
    reg_res = await async_client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_res.status_code == 201
    user_data = reg_res.json()
    assert user_data["email"] == "sarah@example.com"
    assert "id" in user_data

    # Duplicate registration should return 409
    dup_res = await async_client.post("/api/v1/auth/register", json=reg_payload)
    assert dup_res.status_code == 409
    assert dup_res.json()["error"]["code"] == "EMAIL_ALREADY_REGISTERED"

    # Login
    login_res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "sarah@example.com", "password": "Password123!"},
    )
    assert login_res.status_code == 200
    token_data = login_res.json()
    assert "access_token" in token_data
    token = token_data["access_token"]

    # Verify /me with token
    me_res = await async_client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["display_name"] == "Sarah Connor"


@pytest.mark.asyncio
async def test_agent_crud_and_versioning(async_client: AsyncClient, auth_headers: dict):
    """Test full agent lifecycle: create, get, list, update (version bump), versions list, and delete."""
    create_payload = {
        "name": "Support Bot",
        "description": "General customer support voice bot",
        "use_case": "customer_support",
        "configuration": SAMPLE_CONFIG,
    }

    # 1. Create agent
    res = await async_client.post("/api/v1/agents", json=create_payload, headers=auth_headers)
    assert res.status_code == 201
    created = res.json()
    agent_id = created["id"]
    assert created["name"] == "Support Bot"
    assert created["current_version"] == 1
    assert created["status"] == "configured"

    # 2. Get agent
    get_res = await async_client.get(f"/api/v1/agents/{agent_id}", headers=auth_headers)
    assert get_res.status_code == 200
    assert get_res.json()["id"] == agent_id

    # 3. List agents
    list_res = await async_client.get("/api/v1/agents?page=1&page_size=10", headers=auth_headers)
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["total"] >= 1
    assert any(a["id"] == agent_id for a in list_data["items"])

    # 4. Update configuration (should increment version to 2)
    updated_config = dict(SAMPLE_CONFIG)
    updated_config["welcome_message"] = "Welcome to VIP support! How can I assist?"
    patch_payload = {
        "name": "VIP Support Bot",
        "configuration": updated_config,
        "change_description": "Updated greeting for VIPs",
    }
    patch_res = await async_client.patch(
        f"/api/v1/agents/{agent_id}", json=patch_payload, headers=auth_headers
    )
    assert patch_res.status_code == 200
    patched = patch_res.json()
    assert patched["name"] == "VIP Support Bot"
    assert patched["current_version"] == 2
    assert (
        patched["configuration"]["welcome_message"] == "Welcome to VIP support! How can I assist?"
    )

    # 5. Check version history
    versions_res = await async_client.get(
        f"/api/v1/agents/{agent_id}/versions", headers=auth_headers
    )
    assert versions_res.status_code == 200
    versions = versions_res.json()
    assert len(versions) == 2
    assert versions[0]["version"] == 2
    assert versions[1]["version"] == 1

    # 6. Delete agent
    del_res = await async_client.delete(f"/api/v1/agents/{agent_id}", headers=auth_headers)
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # 7. Confirm agent no longer found
    post_del_res = await async_client.get(f"/api/v1/agents/{agent_id}", headers=auth_headers)
    assert post_del_res.status_code == 404


@pytest.mark.asyncio
async def test_agent_ownership_isolation(
    async_client: AsyncClient, auth_headers: dict, other_user_auth_headers: dict
):
    """Test that User B cannot view, edit, or delete User A's agent."""
    create_payload = {
        "name": "Secret Bot",
        "use_case": "customer_support",
        "configuration": SAMPLE_CONFIG,
    }
    create_res = await async_client.post(
        "/api/v1/agents", json=create_payload, headers=auth_headers
    )
    agent_id = create_res.json()["id"]

    # Other user attempts to get User A's agent
    get_res = await async_client.get(f"/api/v1/agents/{agent_id}", headers=other_user_auth_headers)
    assert get_res.status_code == 404
    assert get_res.json()["error"]["code"] == "AGENT_NOT_FOUND"

    # Other user attempts to patch User A's agent
    patch_res = await async_client.patch(
        f"/api/v1/agents/{agent_id}", json={"name": "Hacked"}, headers=other_user_auth_headers
    )
    assert patch_res.status_code == 404

    # Other user attempts to delete User A's agent
    del_res = await async_client.delete(
        f"/api/v1/agents/{agent_id}", headers=other_user_auth_headers
    )
    assert del_res.status_code == 404


@pytest.mark.asyncio
async def test_unauthorized_access_rejected(async_client: AsyncClient):
    """Test that requests lacking valid authentication are rejected with 401."""
    res = await async_client.get("/api/v1/agents")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "INVALID_CREDENTIALS"


@pytest.mark.asyncio
async def test_agent_conversational_chat(async_client: AsyncClient, auth_headers: dict):
    """Test interactive chat turn with an agent."""
    create_payload = {
        "name": "Chatty Bot",
        "use_case": "customer_support",
        "configuration": SAMPLE_CONFIG,
    }
    create_res = await async_client.post(
        "/api/v1/agents", json=create_payload, headers=auth_headers
    )
    assert create_res.status_code == 201
    agent_id = create_res.json()["id"]

    chat_res = await async_client.post(
        f"/api/v1/agents/{agent_id}/chat",
        json={"message": "Can you help me reset my password?", "history": []},
        headers=auth_headers,
    )
    assert chat_res.status_code == 200
    data = chat_res.json()
    assert "reply" in data
    assert len(data["reply"]) > 0
    assert "latency_ms" in data
    assert data["agent_id"] == agent_id

