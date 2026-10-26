from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from bson import ObjectId

from app.database import get_collection


def _serialize_source(doc: Dict[str, Any]) -> Dict[str, Any]:
    if not doc:
        return doc
    doc["id"] = str(doc.pop("_id"))
    return doc


class KnowledgeRepository:
    def __init__(self):
        self.collection_name = "knowledge_sources"

    def _col(self):
        return get_collection(self.collection_name)

    async def create_source(self, source_dict: Dict[str, Any]) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        source_dict["created_at"] = now
        source_dict["updated_at"] = now
        res = await self._col().insert_one(source_dict)
        source_dict["id"] = str(res.inserted_id)
        if "_id" in source_dict:
            del source_dict["_id"]
        return source_dict

    async def get_by_id(
        self, source_id: str, owner_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        query: Dict[str, Any]
        if ObjectId.is_valid(source_id):
            query = {"$or": [{"_id": ObjectId(source_id)}, {"_id": source_id}]}
        else:
            query = {"_id": source_id}
        if owner_id:
            query["owner_id"] = owner_id
        doc = await self._col().find_one(query)
        return _serialize_source(doc) if doc else None

    async def list_by_agent(self, agent_id: str, owner_id: str) -> List[Dict[str, Any]]:
        query = {"agent_id": agent_id, "owner_id": owner_id}
        cursor = self._col().find(query).sort("created_at", -1)
        items = []
        async for doc in cursor:
            items.append(_serialize_source(doc))
        return items

    async def update_status(
        self,
        source_id: str,
        owner_id: str,
        status: str,
        chunk_count: int = 0,
        error_message: Optional[str] = None,
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        query: Dict[str, Any]
        if ObjectId.is_valid(source_id):
            query = {"$or": [{"_id": ObjectId(source_id)}, {"_id": source_id}]}
        else:
            query = {"_id": source_id}
        query["owner_id"] = owner_id

        await self._col().update_one(
            query,
            {
                "$set": {
                    "processing_status": status,
                    "chunk_count": chunk_count,
                    "error_message": error_message,
                    "updated_at": now,
                }
            },
        )

    async def delete_source(self, source_id: str, owner_id: str) -> bool:
        query: Dict[str, Any]
        if ObjectId.is_valid(source_id):
            query = {"$or": [{"_id": ObjectId(source_id)}, {"_id": source_id}]}
        else:
            query = {"_id": source_id}
        query["owner_id"] = owner_id

        res = await self._col().delete_one(query)
        return res.deleted_count > 0


default_knowledge_repository = KnowledgeRepository()
