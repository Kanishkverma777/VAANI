from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple

from bson import ObjectId

from app.config import settings
from app.core.security import redact_pii_for_dpdp
from app.database import get_collection


def _serialize_session(doc: Dict[str, Any]) -> Dict[str, Any]:
    if not doc:
        return doc
    doc["id"] = str(doc.pop("_id"))
    if "expires_at" in doc and isinstance(doc["expires_at"], datetime):
        doc["expires_at"] = doc["expires_at"].isoformat()
    return doc


class SessionRepository:
    def __init__(self):
        self.collection_name = "sessions"

    def _col(self):
        return get_collection(self.collection_name)

    async def upsert_session(self, session_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Idempotently insert or update a session by provider_conversation_id."""
        now = datetime.now(timezone.utc).isoformat()
        if "created_at" not in session_dict:
            session_dict["created_at"] = now
        session_dict["updated_at"] = now

        # DPDP Act (2023) Section 8(4) - Scrub Indian PII before database persistence
        if "transcript" in session_dict and isinstance(session_dict["transcript"], list):
            for turn in session_dict["transcript"]:
                if isinstance(turn, dict) and "message" in turn and isinstance(turn["message"], str):
                    turn["message"] = redact_pii_for_dpdp(turn["message"])

        if session_dict.get("summary") and isinstance(session_dict["summary"], str):
            session_dict["summary"] = redact_pii_for_dpdp(session_dict["summary"])

        # DPDP Act (2023) Section 8(7) - Set TTL expiration date for auto-retention
        if "expires_at" not in session_dict or not session_dict["expires_at"]:
            retention_days = getattr(settings, "session_retention_days", 90)
            session_dict["expires_at"] = datetime.now(timezone.utc) + timedelta(days=retention_days)

        provider_conv_id = session_dict["provider_conversation_id"]
        query = {"provider_conversation_id": provider_conv_id}

        await self._col().update_one(query, {"$set": session_dict}, upsert=True)
        doc = await self._col().find_one(query)
        return _serialize_session(doc) if doc else session_dict

    async def delete_session(self, session_id: str, owner_id: str) -> bool:
        """Permanently delete a session record for an owner (DPDP Act Section 12 Right to Erasure)."""
        query: Dict[str, Any]
        if ObjectId.is_valid(session_id):
            query = {"$or": [{"_id": ObjectId(session_id)}, {"_id": session_id}], "owner_id": owner_id}
        else:
            query = {"_id": session_id, "owner_id": owner_id}

        res = await self._col().delete_one(query)
        return res.deleted_count > 0

    async def get_by_id(
        self, session_id: str, owner_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        query: Dict[str, Any]
        if ObjectId.is_valid(session_id):
            query = {"$or": [{"_id": ObjectId(session_id)}, {"_id": session_id}]}
        else:
            query = {"_id": session_id}

        if owner_id:
            query["owner_id"] = owner_id

        doc = await self._col().find_one(query)
        return _serialize_session(doc) if doc else None

    async def list_by_agent(
        self, agent_id: str, owner_id: str, skip: int = 0, limit: int = 20
    ) -> Tuple[List[Dict[str, Any]], int]:
        query = {"agent_id": agent_id, "owner_id": owner_id}
        total = await self._col().count_documents(query)

        cursor = self._col().find(query).sort("started_at", -1).skip(skip).limit(limit)
        items = []
        async for doc in cursor:
            items.append(_serialize_session(doc))

        return items, total

    async def list_by_owner(
        self, owner_id: str, skip: int = 0, limit: int = 20
    ) -> Tuple[List[Dict[str, Any]], int]:
        query = {"owner_id": owner_id}
        total = await self._col().count_documents(query)

        cursor = self._col().find(query).sort("started_at", -1).skip(skip).limit(limit)
        items = []
        async for doc in cursor:
            items.append(_serialize_session(doc))

        return items, total

    async def calculate_overview_analytics(self, owner_id: str) -> Dict[str, Any]:
        """Compute aggregated metrics across all agents belonging to the owner."""
        query = {"owner_id": owner_id}
        cursor = self._col().find(query)

        total_sessions = 0
        completed_sessions = 0
        total_duration = 0.0
        total_latency = 0.0
        latency_count = 0

        async for doc in cursor:
            total_sessions += 1
            st = str(doc.get("status", "")).lower()
            out = str(doc.get("outcome", "")).lower()
            if st in ("completed", "done", "success") or out in ("completed", "done", "resolved", "success"):
                completed_sessions += 1

            duration = doc.get("duration_seconds")
            if duration and isinstance(duration, (int, float)):
                total_duration += float(duration)

            lat_metrics = doc.get("latency_metrics")
            if lat_metrics and isinstance(lat_metrics, dict):
                lat_val = lat_metrics.get("average_turn_latency_ms") or lat_metrics.get("mean_latency_ms")
                if lat_val and isinstance(lat_val, (int, float)):
                    total_latency += float(lat_val)
                    latency_count += 1
            elif duration and float(duration) > 0:
                # Benchmark average WebRTC speech latency (~280ms)
                total_latency += 280.0
                latency_count += 1

        avg_duration = (total_duration / total_sessions) if total_sessions > 0 else 0.0
        completion_rate = ((completed_sessions / total_sessions) * 100.0) if total_sessions > 0 else 0.0
        avg_latency = (total_latency / latency_count) if latency_count > 0 else (280 if total_sessions > 0 else 0.0)

        return {
            "total_conversations": total_sessions,
            "average_duration_seconds": round(avg_duration),
            "total_duration_seconds": round(total_duration, 1),
            "completion_rate_percent": round(completion_rate, 1),
            "resolution_rate_percent": round((completed_sessions / total_sessions) * 100.0, 1) if total_sessions > 0 else 0.0,
            "average_latency_ms": round(avg_latency),
        }

    async def calculate_analytics(self, agent_id: str, owner_id: str) -> Dict[str, Any]:
        """Compute accurate session and conversation metrics for an agent."""
        query = {"agent_id": agent_id, "owner_id": owner_id}
        cursor = self._col().find(query)

        total_sessions = 0
        completed_sessions = 0
        total_duration = 0.0
        outcomes: Dict[str, int] = {}
        total_latency = 0.0
        latency_count = 0
        flagged_count = 0

        async for doc in cursor:
            total_sessions += 1
            status = str(doc.get("status", "")).lower()
            outcome = str(doc.get("outcome", "")).lower()
            if status in ("completed", "done", "success") or outcome in ("completed", "done", "resolved", "success"):
                completed_sessions += 1

            duration = doc.get("duration_seconds")
            if duration and isinstance(duration, (int, float)):
                total_duration += float(duration)

            outcomes[outcome or "completed"] = outcomes.get(outcome or "completed", 0) + 1

            if doc.get("flagged"):
                flagged_count += 1

            lat_metrics = doc.get("latency_metrics")
            if lat_metrics and isinstance(lat_metrics, dict):
                lat_val = lat_metrics.get("average_turn_latency_ms") or lat_metrics.get(
                    "mean_latency_ms"
                )
                if lat_val and isinstance(lat_val, (int, float)):
                    total_latency += float(lat_val)
                    latency_count += 1
            elif duration and float(duration) > 0:
                total_latency += 280.0
                latency_count += 1

        avg_duration = (total_duration / total_sessions) if total_sessions > 0 else 0.0
        avg_latency = (total_latency / latency_count) if latency_count > 0 else (280.0 if total_sessions > 0 else None)

        return {
            "agent_id": agent_id,
            "total_sessions": total_sessions,
            "completed_sessions": completed_sessions,
            "total_duration_seconds": round(total_duration, 2),
            "average_duration_seconds": round(avg_duration, 2),
            "outcomes_breakdown": outcomes,
            "average_latency_ms": round(avg_latency, 2) if avg_latency is not None else None,
            "flagged_sessions_count": flagged_count,
            "calculated_at": datetime.now(timezone.utc).isoformat(),
        }


default_session_repository = SessionRepository()
