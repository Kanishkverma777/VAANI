from datetime import datetime, timezone
from typing import Any, Dict, Optional

from bson import ObjectId

from app.database import get_collection


def _serialize_user(doc: Dict[str, Any]) -> Dict[str, Any]:
    if not doc:
        return doc
    doc["id"] = str(doc.pop("_id"))
    return doc


class UserRepository:
    def __init__(self):
        self.collection_name = "users"

    def _col(self):
        return get_collection(self.collection_name)

    async def get_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        doc = await self._col().find_one({"email": email.lower().strip()})
        return _serialize_user(doc) if doc else None

    async def get_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        query: Dict[str, Any]
        if ObjectId.is_valid(user_id):
            query = {"$or": [{"_id": ObjectId(user_id)}, {"_id": user_id}]}
        else:
            query = {"_id": user_id}
        doc = await self._col().find_one(query)
        return _serialize_user(doc) if doc else None

    async def create(self, email: str, password_hash: str, display_name: str) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        doc = {
            "email": email.lower().strip(),
            "password_hash": password_hash,
            "display_name": display_name.strip(),
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }
        res = await self._col().insert_one(doc)
        doc["id"] = str(res.inserted_id)
        if "_id" in doc:
            del doc["_id"]
        return doc


default_user_repository = UserRepository()
