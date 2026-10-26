import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.core.cache import default_cache
from app.core.exceptions import NotFoundException, ValidationException
from app.integrations.elevenlabs_client import (
    ElevenLabsClient,
    default_elevenlabs_client,
)
from app.repositories.agent_repository import AgentRepository, default_agent_repository
from app.repositories.session_repository import (
    SessionRepository,
    default_session_repository,
)
from app.schemas.common import PaginatedResponse
from app.schemas.conversation import SessionDetailResponse

logger = logging.getLogger(__name__)


class ConversationService:
    def __init__(
        self,
        elevenlabs_client: Optional[ElevenLabsClient] = None,
        agent_repo: Optional[AgentRepository] = None,
        session_repo: Optional[SessionRepository] = None,
    ):
        self.client = elevenlabs_client or default_elevenlabs_client
        self.agent_repo = agent_repo or default_agent_repository
        self.session_repo = session_repo or default_session_repository

    async def sync_session(
        self, agent_id: str, provider_conversation_id: str, owner_id: str
    ) -> SessionDetailResponse:
        """Fetch conversation details directly from ElevenLabs and persist locally."""
        agent = await self.agent_repo.get_agent_by_id(agent_id, owner_id=owner_id)
        if not agent:
            raise NotFoundException(f"Agent '{agent_id}' was not found.", code="AGENT_NOT_FOUND")

        raw_data = await self.client.get_conversation(provider_conversation_id)

        # Parse transcript safely
        transcript_raw = raw_data.get("transcript") or []
        clean_transcript: List[Dict[str, Any]] = []
        for turn in transcript_raw:
            if not isinstance(turn, dict):
                continue
            clean_transcript.append(
                {
                    "role": turn.get("role", "unknown"),
                    "message": turn.get("message", ""),
                    "time_in_call_secs": turn.get("time_in_call_secs"),
                }
            )

        # Parse metadata safely
        meta = raw_data.get("metadata") or {}
        duration_secs = meta.get("call_duration_secs") or raw_data.get("duration_seconds")
        start_unix = meta.get("start_time_unix_secs")
        started_at = (
            datetime.fromtimestamp(start_unix, tz=timezone.utc).isoformat()
            if start_unix
            else datetime.now(timezone.utc).isoformat()
        )

        # Parse analysis and outcome
        analysis = raw_data.get("analysis") or {}
        summary = analysis.get("transcript_summary") or raw_data.get("summary")
        call_success = analysis.get("call_successful")
        if call_success is True or call_success == "success":
            outcome = "completed"
        elif call_success is False or call_success in ("failure", "unresolved"):
            outcome = "unresolved"
        else:
            outcome = raw_data.get("status", "completed")

        session_doc = {
            "agent_id": agent_id,
            "owner_id": owner_id,
            "provider_conversation_id": provider_conversation_id,
            "started_at": started_at,
            "ended_at": datetime.now(timezone.utc).isoformat(),
            "duration_seconds": float(duration_secs) if duration_secs is not None else 0.0,
            "status": raw_data.get("status", "completed"),
            "transcript": clean_transcript,
            "summary": summary,
            "outcome": outcome,
            "latency_metrics": raw_data.get("latency_metrics"),
            "flagged": raw_data.get("flagged", False),
        }

        saved = await self.session_repo.upsert_session(session_doc)
        return self._to_response(saved)

    async def sync_user_sessions_from_provider(self, owner_id: str) -> int:
        """Fetch remote conversations from ElevenLabs and synchronize any missing ones."""
        try:
            # 1. Fetch user agents and build map of provider_agent_id -> agent
            user_agents, _ = await self.agent_repo.list_agents(owner_id=owner_id, limit=100)
            agents_map: Dict[str, Dict[str, Any]] = {}
            for a in user_agents:
                pid = a.get("provider_agent_id") or a.get("elevenlabs_agent_id")
                if pid:
                    agents_map[pid] = a

            if not agents_map:
                return 0

            # Find existing synced conversation IDs to avoid redundant HTTP requests
            existing_cursor = self.session_repo._col().find(
                {"owner_id": owner_id}, {"provider_conversation_id": 1}
            )
            existing_ids = {
                doc.get("provider_conversation_id")
                async for doc in existing_cursor
                if doc.get("provider_conversation_id")
            }

            # 2. Fetch recent conversations list from ElevenLabs (single fast request)
            conversations = await self.client.list_conversations(limit=50)
            tasks = []
            for c in conversations:
                agent_pid = c.get("agent_id")
                conv_id = c.get("conversation_id")
                if agent_pid in agents_map and conv_id and conv_id not in existing_ids:
                    matched_agent = agents_map[agent_pid]
                    agent_id = str(matched_agent.get("id") or matched_agent.get("_id"))
                    tasks.append((agent_id, conv_id))

            if not tasks:
                return 0

            sem = asyncio.Semaphore(5)

            async def _sync_one(aid: str, cid: str) -> int:
                async with sem:
                    try:
                        await self.sync_session(aid, cid, owner_id)
                        return 1
                    except Exception as err:
                        logger.warning("Error syncing conv %s: %s", cid, str(err))
                        return 0

            results = await asyncio.gather(*[_sync_one(aid, cid) for aid, cid in tasks])
            synced_count = sum(results)
            if synced_count > 0:
                await default_cache.clear_pattern(f"sessions:user:{owner_id}:*")
                await default_cache.delete(f"analytics:overview:{owner_id}")
            return synced_count
        except Exception as exc:
            logger.warning("Failed to auto-sync sessions from provider: %s", str(exc))
            return 0

    async def ingest_webhook_event(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Idempotently process an incoming ElevenLabs conversation webhook payload."""
        conv_id = payload.get("conversation_id")
        agent_id = payload.get("agent_id")
        if not conv_id:
            raise ValidationException(
                "Webhook payload missing conversation_id.", code="INVALID_PAYLOAD"
            )

        # Check existing or fallback agent matching
        agent = await self.agent_repo._agents().find_one(
            {"$or": [{"provider_agent_id": agent_id}, {"id": agent_id}, {"_id": agent_id}]}
        )
        owner_id = str(agent["owner_id"]) if agent else "system_ingest"
        internal_agent_id = str(agent["_id"]) if agent else (agent_id or "unknown")

        meta = payload.get("metadata", {})
        session_doc = {
            "agent_id": internal_agent_id,
            "owner_id": owner_id,
            "provider_conversation_id": conv_id,
            "started_at": meta.get("start_time") or datetime.now(timezone.utc).isoformat(),
            "ended_at": meta.get("end_time") or datetime.now(timezone.utc).isoformat(),
            "duration_seconds": float(meta.get("call_duration_secs", 0.0)),
            "status": payload.get("status", "completed"),
            "transcript": payload.get("transcript", []),
            "summary": payload.get("summary"),
            "outcome": payload.get("outcome", "completed"),
            "latency_metrics": payload.get("latency_metrics"),
            "flagged": payload.get("flagged", False),
        }

        saved = await self.session_repo.upsert_session(session_doc)
        return {"status": "processed", "session_id": str(saved.get("id", saved.get("_id")))}

    async def list_agent_sessions(
        self, agent_id: str, owner_id: str, page: int = 1, page_size: int = 20
    ) -> PaginatedResponse[SessionDetailResponse]:
        # Verify ownership
        agent = await self.agent_repo.get_agent_by_id(agent_id, owner_id=owner_id)
        if not agent:
            raise NotFoundException(f"Agent '{agent_id}' was not found.", code="AGENT_NOT_FOUND")

        page = max(1, page)
        page_size = max(1, min(page_size, 100))
        skip = (page - 1) * page_size

        docs, total = await self.session_repo.list_by_agent(
            agent_id, owner_id, skip=skip, limit=page_size
        )
        items = [self._to_response(d) for d in docs]
        has_more = (skip + len(items)) < total

        return PaginatedResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            has_more=has_more,
        )

    async def list_user_sessions(
        self, owner_id: str, page: int = 1, page_size: int = 20, auto_sync: bool = False
    ) -> PaginatedResponse[SessionDetailResponse]:
        page = max(1, page)
        page_size = max(1, min(page_size, 100))
        skip = (page - 1) * page_size

        cache_key = f"sessions:user:{owner_id}:p{page}:s{page_size}"
        if not auto_sync:
            cached_res = await default_cache.get(cache_key)
            if cached_res is not None:
                return cached_res

        docs, total = await self.session_repo.list_by_owner(
            owner_id, skip=skip, limit=page_size
        )

        # If user has no sessions locally or auto_sync is requested on page 1, check provider
        if (total == 0 or auto_sync) and page == 1:
            synced = await self.sync_user_sessions_from_provider(owner_id)
            if synced > 0:
                docs, total = await self.session_repo.list_by_owner(
                    owner_id, skip=skip, limit=page_size
                )

        items = [self._to_response(d) for d in docs]
        has_more = (skip + len(items)) < total

        response = PaginatedResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            has_more=has_more,
        )

        if not auto_sync:
            await default_cache.set(cache_key, response, ttl_seconds=15.0)

        return response

    async def get_session_by_id(self, session_id: str, owner_id: str) -> SessionDetailResponse:
        session = await self.session_repo.get_by_id(session_id, owner_id=owner_id)
        if not session:
            raise NotFoundException(
                f"Session '{session_id}' was not found.", code="SESSION_NOT_FOUND"
            )
        return self._to_response(session)

    def _to_response(self, doc: Dict[str, Any]) -> SessionDetailResponse:
        return SessionDetailResponse(
            id=str(doc.get("id") or doc.get("_id")),
            agent_id=doc["agent_id"],
            owner_id=doc["owner_id"],
            provider_conversation_id=doc["provider_conversation_id"],
            started_at=doc.get("started_at"),
            ended_at=doc.get("ended_at"),
            duration_seconds=doc.get("duration_seconds"),
            status=doc.get("status", "completed"),
            transcript=doc.get("transcript", []),
            summary=doc.get("summary"),
            outcome=doc.get("outcome"),
            latency_metrics=doc.get("latency_metrics"),
            flagged=doc.get("flagged", False),
            created_at=doc.get("created_at", datetime.now(timezone.utc).isoformat()),
        )


default_conversation_service = ConversationService()
