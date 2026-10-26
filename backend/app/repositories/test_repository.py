from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from bson import ObjectId

from app.database import get_collection


def _serialize_test_run(doc: Dict[str, Any]) -> Dict[str, Any]:
    if not doc:
        return doc
    doc["id"] = str(doc.pop("_id"))
    return doc


class TestRepository:
    def __init__(self):
        self.collection_name = "test_runs"

    def _col(self):
        return get_collection(self.collection_name)

    async def save_test_run(self, test_dict: Dict[str, Any]) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        test_dict["created_at"] = now
        res = await self._col().insert_one(test_dict)
        test_dict["id"] = str(res.inserted_id)
        if "_id" in test_dict:
            del test_dict["_id"]
        return test_dict

    async def get_test_run_by_id(
        self, test_run_id: str, owner_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        query: Dict[str, Any]
        if ObjectId.is_valid(test_run_id):
            query = {"$or": [{"_id": ObjectId(test_run_id)}, {"_id": test_run_id}]}
        else:
            query = {"_id": test_run_id}
        if owner_id:
            query["owner_id"] = owner_id

        doc = await self._col().find_one(query)
        return _serialize_test_run(doc) if doc else None

    async def list_by_agent(self, agent_id: str, owner_id: str) -> List[Dict[str, Any]]:
        query = {"agent_id": agent_id, "owner_id": owner_id}
        cursor = self._col().find(query).sort("created_at", -1)
        items = []
        async for doc in cursor:
            items.append(_serialize_test_run(doc))
        return items


default_test_repository = TestRepository()
