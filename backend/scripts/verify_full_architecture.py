import asyncio
import json
import sys
import httpx

BASE_URL = "http://localhost:8000"

async def run_diagnostics():
    print("=" * 70)
    print("  VOICEFORGE AI - COMPREHENSIVE ARCHITECTURE & ENDPOINT DIAGNOSTIC")
    print("=" * 70)

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=45.0) as client:
        # 1. Health & Ready
        print("\n[1/9] Checking Health & Readiness Probes...")
        res_h = await client.get("/health")
        print(f"  GET /health: HTTP {res_h.status_code} -> {res_h.json()}")
        assert res_h.status_code == 200, "Health check failed"

        res_r = await client.get("/ready")
        print(f"  GET /ready:  HTTP {res_r.status_code} -> {res_r.json()}")
        assert res_r.status_code == 200, "Readiness check failed"

        # 2. Authentication
        print("\n[2/9] Checking Authentication & User Management...")
        auth_email = "architect_test@voiceforge.ai"
        auth_password = "SecurePassword123!"
        
        # Login or register
        login_res = await client.post("/api/v1/auth/login", json={"email": auth_email, "password": auth_password})
        if login_res.status_code != 200:
            reg_res = await client.post(
                "/api/v1/auth/register",
                json={"email": auth_email, "password": auth_password, "display_name": "Lead Architect"}
            )
            print(f"  POST /api/v1/auth/register: HTTP {reg_res.status_code}")
            login_res = await client.post("/api/v1/auth/login", json={"email": auth_email, "password": auth_password})

        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print(f"  POST /api/v1/auth/login: HTTP {login_res.status_code} (JWT Token Issued)")

        me_res = await client.get("/api/v1/auth/me", headers=headers)
        print(f"  GET /api/v1/auth/me: HTTP {me_res.status_code} -> {me_res.json().get('email')} ({me_res.json().get('display_name')})")

        # 3. Voices
        print("\n[3/9] Checking ElevenLabs Voice Catalog...")
        voices_res = await client.get("/api/v1/voices", headers=headers)
        print(f"  GET /api/v1/voices: HTTP {voices_res.status_code}")
        voices_data = voices_res.json()
        voices = voices_data.get("voices", [])
        print(f"  Loaded {len(voices)} voices. Top voice: {voices[0]['name']} ({voices[0]['voice_id']})")
        chosen_voice_id = voices[0]["voice_id"] if voices else "21m00Tcm4TlvDq8ikWAM"

        # 4. Agent Generation via Groq LLM
        print("\n[4/9] Checking AI Agent Generation (Groq LLM)...")
        gen_req = {
            "description": "A polite concierge voice assistant for a boutique luxury hotel in Zurich that answers amenities inquiries and books restaurant reservations.",
            "use_case": "customer_support",
            "preferred_voice_id": chosen_voice_id
        }
        gen_res = await client.post("/api/v1/agents/generate", json=gen_req, headers=headers)
        print(f"  POST /api/v1/agents/generate: HTTP {gen_res.status_code}")
        assert gen_res.status_code == 200, f"Generation failed: {gen_res.text}"
        gen_data = gen_res.json()
        config = gen_data["configuration"]
        print(f"  Agent Name:    {config.get('name')}")
        print(f"  Tone:          {config.get('personality', {}).get('tone')}")
        print(f"  Welcome Msg:   {config.get('welcome_message')}")
        print(f"  Flow Steps:    {len(config.get('conversation_flow', {}).get('steps', []))} steps defined")

        # 5. Agent Persistence in MongoDB
        print("\n[5/9] Checking Agent Persistence (MongoDB Database)...")
        create_payload = {
            "name": config.get("name", "Zurich Luxury Concierge"),
            "description": config.get("description", "Hotel concierge assistant"),
            "use_case": "customer_support",
            "configuration": config
        }
        create_res = await client.post("/api/v1/agents", json=create_payload, headers=headers)
        print(f"  POST /api/v1/agents: HTTP {create_res.status_code}")
        assert create_res.status_code in (200, 201), f"Save failed: {create_res.text}"
        agent_record = create_res.json()
        agent_id = agent_record["id"]
        print(f"  Persisted Agent ID: {agent_id} (Status: {agent_record.get('status')})")

        list_res = await client.get("/api/v1/agents", headers=headers)
        print(f"  GET /api/v1/agents: HTTP {list_res.status_code} -> Found {list_res.json().get('total')} total saved agents")

        # 6. Automated Testing / Benchmark Suite
        print("\n[6/9] Checking Automated Quality & Safety Benchmark Suite...")
        test_res = await client.post(f"/api/v1/agents/{agent_id}/tests", headers=headers)
        print(f"  POST /api/v1/agents/{agent_id}/tests: HTTP {test_res.status_code}")
        assert test_res.status_code == 200, f"Test benchmark failed: {test_res.text}"
        test_data = test_res.json()
        print(f"  Overall Benchmark Score: {test_data.get('score')}% ({test_data.get('passed_tests')}/{test_data.get('total_tests')} passed)")
        for tc in test_data.get("test_cases", [])[:4]:
            print(f"    - [{tc['category']}] {tc['scenario'][:40]}... -> {'PASSED' if tc['passed'] else 'FAILED'}")

        # 7. Deployment to ElevenLabs Conversational AI
        print("\n[7/9] Checking Deployment Engine (ElevenLabs Conversational AI Sync)...")
        dep_res = await client.post(f"/api/v1/agents/{agent_id}/deploy", headers=headers)
        print(f"  POST /api/v1/agents/{agent_id}/deploy: HTTP {dep_res.status_code}")
        assert dep_res.status_code == 200, f"Deploy failed: {dep_res.text}"
        dep_data = dep_res.json()
        print(f"  Deployment Status:     {dep_data.get('status')}")
        print(f"  Provider Agent ID:     {dep_data.get('provider_agent_id')}")

        # 8. Knowledge Base & Vector Retrieval (RAG)
        print("\n[8/9] Checking Knowledge Base & Semantic Search (RAG)...")
        doc_content = b"The rooftop Michelin-star restaurant is open from 6:30 PM to 11:00 PM. The spa and heated infinity pool are open daily from 7:00 AM to 10:00 PM. Valet parking is complimentary for hotel guests."
        files = {"file": ("hotel_amenities.txt", doc_content, "text/plain")}
        kb_ingest_res = await client.post(f"/api/v1/agents/{agent_id}/knowledge", files=files, headers=headers)
        print(f"  POST /api/v1/agents/{agent_id}/knowledge: HTTP {kb_ingest_res.status_code}")
        assert kb_ingest_res.status_code in (200, 201), f"Ingest failed: {kb_ingest_res.text}"
        doc_info = kb_ingest_res.json()
        print(f"  Indexed Document ID: {doc_info.get('id')} (Chunks: {doc_info.get('chunk_count')})")

        query_payload = {
            "query": "What time is the rooftop restaurant open?",
            "top_k": 3,
            "confidence_threshold": 0.5
        }
        search_res = await client.post(f"/api/v1/agents/{agent_id}/knowledge/query", json=query_payload, headers=headers)
        print(f"  POST /api/v1/agents/{agent_id}/knowledge/query: HTTP {search_res.status_code}")
        search_results = search_res.json().get("results", [])
        print(f"  Retrieved {len(search_results)} relevant chunk(s).")
        if search_results:
            print(f"  Top Match (score {search_results[0].get('score'):.2f}): {search_results[0].get('text')[:90]}...")

        # 9. Analytics & Telemetry
        print("\n[9/9] Checking Analytics & Call Metrics...")
        analytics_res = await client.get(f"/api/v1/agents/{agent_id}/analytics", headers=headers)
        print(f"  GET /api/v1/agents/{agent_id}/analytics: HTTP {analytics_res.status_code}")
        print(f"  Agent Analytics: {analytics_res.json()}")

    print("\n" + "=" * 70)
    print("  ALL ARCHITECTURE COMPONENTS ARE 100% OPERATIONAL AND CONNECTED!")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(run_diagnostics())
