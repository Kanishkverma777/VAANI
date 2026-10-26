from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from bson import ObjectId

from app.core.cache import default_cache
from app.database import get_collection


def _serialize_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    if not doc:
        return doc
    doc["id"] = str(doc.pop("_id"))
    return doc


class AgentRepository:
    def __init__(self):
        self.agents_col_name = "agents"
        self.versions_col_name = "agent_versions"

    def _agents(self):
        return get_collection(self.agents_col_name)

    def _versions(self):
        return get_collection(self.versions_col_name)

    def _build_id_query(self, agent_id: str, owner_id: Optional[str] = None) -> Dict[str, Any]:
        query: Dict[str, Any]
        if ObjectId.is_valid(agent_id):
            query = {"$or": [{"_id": ObjectId(agent_id)}, {"_id": agent_id}]}
        else:
            query = {"_id": agent_id}

        if owner_id:
            query["owner_id"] = owner_id
        return query

    async def create_agent(self, agent_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Insert a new agent document and initial version 1."""
        now = datetime.now(timezone.utc).isoformat()
        agent_dict["created_at"] = now
        agent_dict["updated_at"] = now
        agent_dict["current_version"] = 1

        res = await self._agents().insert_one(agent_dict)
        agent_id = str(res.inserted_id)
        agent_dict["id"] = agent_id
        if "_id" in agent_dict:
            del agent_dict["_id"]

        # Invalidate cached agent lists for owner
        await default_cache.clear_prefix(f"agent:list:{agent_dict['owner_id']}")

        # Save initial version
        version_doc = {
            "agent_id": agent_id,
            "owner_id": agent_dict["owner_id"],
            "version": 1,
            "configuration": agent_dict["configuration"],
            "change_description": "Initial configuration generated",
            "created_at": now,
        }
        await self._versions().insert_one(version_doc)
        return agent_dict

    async def get_agent_by_id(
        self, agent_id: str, owner_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Retrieve agent by ID with sub-millisecond LRU/TTL read caching."""
        cache_key = f"agent:id:{agent_id}:{owner_id or '*'}"
        cached_agent = await default_cache.get(cache_key)
        if cached_agent is not None:
            return cached_agent

        query = self._build_id_query(agent_id, owner_id)
        doc = await self._agents().find_one(query)
        serialized = _serialize_doc(doc) if doc else None
        if serialized:
            await default_cache.set(cache_key, serialized, ttl_seconds=60.0)
        return serialized

    async def list_agents(
        self, owner_id: str, skip: int = 0, limit: int = 20
    ) -> Tuple[List[Dict[str, Any]], int]:
        """List agents owned by a user with cached pagination."""
        cache_key = f"agent:list:{owner_id}:{skip}:{limit}"
        cached_list = await default_cache.get(cache_key)
        if cached_list is not None:
            return cached_list

        query = {"owner_id": owner_id, "status": {"$ne": "archived"}}
        total = await self._agents().count_documents(query)

        cursor = self._agents().find(query).sort("created_at", -1).skip(skip).limit(limit)
        items = []
        async for doc in cursor:
            items.append(_serialize_doc(doc))

        result = (items, total)
        await default_cache.set(cache_key, result, ttl_seconds=30.0)
        return result

    async def update_agent(
        self,
        agent_id: str,
        owner_id: str,
        update_fields: Dict[str, Any],
        new_version_config: Optional[Dict[str, Any]] = None,
        change_description: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Update agent fields and invalidate relevant cache entries."""
        now = datetime.now(timezone.utc).isoformat()
        update_fields["updated_at"] = now

        current_agent = await self.get_agent_by_id(agent_id, owner_id)
        if not current_agent:
            return None

        if new_version_config is not None:
            new_version_num = current_agent.get("current_version", 1) + 1
            update_fields["current_version"] = new_version_num
            update_fields["configuration"] = new_version_config

            version_doc = {
                "agent_id": agent_id,
                "owner_id": owner_id,
                "version": new_version_num,
                "configuration": new_version_config,
                "change_description": change_description or f"Version {new_version_num} update",
                "created_at": now,
            }
            await self._versions().insert_one(version_doc)

        query = self._build_id_query(agent_id, owner_id)
        await self._agents().update_one(query, {"$set": update_fields})

        # Evict cache entries
        await default_cache.clear_prefix(f"agent:id:{agent_id}")
        await default_cache.clear_prefix(f"agent:list:{owner_id}")

        return await self.get_agent_by_id(agent_id, owner_id)

    async def delete_agent(self, agent_id: str, owner_id: str) -> bool:
        """Mark agent as archived or delete document and evict cache."""
        query = self._build_id_query(agent_id, owner_id)
        res = await self._agents().delete_one(query)
        if res.deleted_count > 0:
            await self._versions().delete_many({"agent_id": agent_id, "owner_id": owner_id})
            await default_cache.clear_prefix(f"agent:id:{agent_id}")
            await default_cache.clear_prefix(f"agent:list:{owner_id}")
            return True
        return False

    async def get_agent_versions(self, agent_id: str, owner_id: str) -> List[Dict[str, Any]]:
        """List all version history records for an agent."""
        query = {"agent_id": agent_id, "owner_id": owner_id}
        cursor = self._versions().find(query).sort("version", -1)
        items = []
        async for doc in cursor:
            items.append(_serialize_doc(doc))
        return items


default_agent_repository = AgentRepository()
