import io

import pytest
from httpx import AsyncClient

SAMPLE_CONFIG = {
    "name": "Knowledge Bot",
    "description": "Agent for testing knowledge",
    "purpose": "RAG test",
    "use_case": "customer_support",
    "personality": {"tone": "polite", "speaking_style": "natural", "pace": "normal", "traits": []},
    "instructions": "Answer from knowledge.",
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
        "rag_enabled": True,
        "top_k": 3,
        "confidence_threshold": 0.5,
        "source_identifiers": [],
    },
    "escalation_settings": {
        "human_handoff_enabled": True,
        "escalation_contact": None,
        "trigger_phrases": [],
        "escalation_message": "Hold",
    },
}


def _create_minimal_pdf() -> bytes:
    import pymupdf

    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text(
        (50, 72),
        "VoiceForge AI Dental Clinic office hours are Monday through Friday from 8 AM to 5 PM.",
    )
    return doc.write()


@pytest.mark.asyncio
async def test_knowledge_ingestion_and_retrieval(async_client: AsyncClient, auth_headers: dict):
    """Test uploading a text document, verifying chunking, and querying knowledge base."""
    # Create agent
    agent_res = await async_client.post(
        "/api/v1/agents",
        json={
            "name": "Knowledge Bot",
            "use_case": "customer_support",
            "configuration": SAMPLE_CONFIG,
        },
        headers=auth_headers,
    )
    agent_id = agent_res.json()["id"]

    # Upload TXT file
    doc_content = (
        b"Our return policy allows full refunds within 30 days of purchase with original receipt."
    )
    files = {"file": ("return_policy.txt", io.BytesIO(doc_content), "text/plain")}

    upload_res = await async_client.post(
        f"/api/v1/agents/{agent_id}/knowledge",
        files=files,
        headers=auth_headers,
    )
    assert upload_res.status_code == 201
    source = upload_res.json()
    assert source["filename"] == "return_policy.txt"
    assert source["processing_status"] == "completed"
    assert source["chunk_count"] >= 1
    source_id = source["id"]

    # List documents
    list_res = await async_client.get(f"/api/v1/agents/{agent_id}/knowledge", headers=auth_headers)
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    # Query knowledge base
    query_res = await async_client.post(
        f"/api/v1/agents/{agent_id}/knowledge/query",
        json={"query": "What is the return refund policy?", "top_k": 2},
        headers=auth_headers,
    )
    assert query_res.status_code == 200
    query_data = query_res.json()
    assert query_data["total_matches"] >= 1
    assert "return policy" in query_data["results"][0]["text"].lower()

    # Delete document
    del_res = await async_client.delete(
        f"/api/v1/agents/{agent_id}/knowledge/{source_id}",
        headers=auth_headers,
    )
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True


@pytest.mark.asyncio
async def test_knowledge_pdf_ingestion(async_client: AsyncClient, auth_headers: dict):
    """Test uploading a real PDF document with magic byte detection."""
    agent_res = await async_client.post(
        "/api/v1/agents",
        json={
            "name": "Knowledge Bot",
            "use_case": "customer_support",
            "configuration": SAMPLE_CONFIG,
        },
        headers=auth_headers,
    )
    agent_id = agent_res.json()["id"]

    pdf_bytes = _create_minimal_pdf()
    files = {"file": ("clinic_hours.pdf", io.BytesIO(pdf_bytes), "application/pdf")}

    upload_res = await async_client.post(
        f"/api/v1/agents/{agent_id}/knowledge",
        files=files,
        headers=auth_headers,
    )
    assert upload_res.status_code == 201
    source = upload_res.json()
    assert source["content_type"] == "pdf"
    assert source["processing_status"] == "completed"


@pytest.mark.asyncio
async def test_knowledge_invalid_file_rejected(async_client: AsyncClient, auth_headers: dict):
    """Test that empty or corrupted files are rejected with 422."""
    agent_res = await async_client.post(
        "/api/v1/agents",
        json={
            "name": "Knowledge Bot",
            "use_case": "customer_support",
            "configuration": SAMPLE_CONFIG,
        },
        headers=auth_headers,
    )
    agent_id = agent_res.json()["id"]

    files = {"file": ("empty.txt", io.BytesIO(b""), "text/plain")}
    upload_res = await async_client.post(
        f"/api/v1/agents/{agent_id}/knowledge",
        files=files,
        headers=auth_headers,
    )
    assert upload_res.status_code == 422
    assert upload_res.json()["error"]["code"] == "EMPTY_FILE"
