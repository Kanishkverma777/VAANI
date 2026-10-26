import copy
import uuid
from typing import Any, Dict, List, Optional


class MockAsyncCursor:
    def __init__(self, docs: List[Dict[str, Any]]):
        self.docs = copy.deepcopy(docs)
        self.index = 0

    def sort(self, field: str, direction: int = 1):
        reverse = direction < 0
        self.docs.sort(key=lambda x: x.get(field, ""), reverse=reverse)
        return self

    def skip(self, n: int):
        self.docs = self.docs[n:]
        return self

    def limit(self, n: int):
        self.docs = self.docs[:n]
        return self

    def __aiter__(self):
        self.index = 0
        return self

    async def __anext__(self):
        if self.index < len(self.docs):
            doc = self.docs[self.index]
            self.index += 1
            return copy.deepcopy(doc)
        raise StopAsyncIteration


class InsertOneResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id


class DeleteResult:
    def __init__(self, deleted_count):
        self.deleted_count = deleted_count


class UpdateResult:
    def __init__(self, matched_count, modified_count):
        self.matched_count = matched_count
        self.modified_count = modified_count


class InMemoryAsyncCollection:
    def __init__(self, name: str):
        self.name = name
        self.docs: List[Dict[str, Any]] = []

    def _matches_query(self, doc: Dict[str, Any], query: Dict[str, Any]) -> bool:
        if not query:
            return True

        if "$or" in query:
            subqueries = query["$or"]
            if not any(self._matches_query(doc, sq) for sq in subqueries):
                return False

        for k, v in query.items():
            if k == "$or":
                continue
            doc_val = doc.get(k)
            if isinstance(v, dict):
                if "$ne" in v and doc_val == v["$ne"]:
                    return False
                if "$in" in v and doc_val not in v["$in"]:
                    return False
            else:
                if str(doc_val) != str(v):
                    return False
        return True

    async def insert_one(self, doc: Dict[str, Any]) -> InsertOneResult:
        doc_copy = copy.deepcopy(doc)
        if "_id" not in doc_copy:
            doc_copy["_id"] = str(uuid.uuid4())
        self.docs.append(doc_copy)
        return InsertOneResult(doc_copy["_id"])

    async def find_one(self, query: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        for d in self.docs:
            if self._matches_query(d, query):
                return copy.deepcopy(d)
        return None

    def find(self, query: Optional[Dict[str, Any]] = None) -> MockAsyncCursor:
        query = query or {}
        matched = [d for d in self.docs if self._matches_query(d, query)]
        return MockAsyncCursor(matched)

    async def count_documents(self, query: Optional[Dict[str, Any]] = None) -> int:
        query = query or {}
        return sum(1 for d in self.docs if self._matches_query(d, query))

    async def update_one(
        self, query: Dict[str, Any], update: Dict[str, Any], upsert: bool = False
    ) -> UpdateResult:
        for d in self.docs:
            if self._matches_query(d, query):
                if "$set" in update:
                    d.update(copy.deepcopy(update["$set"]))
                return UpdateResult(matched_count=1, modified_count=1)
        if upsert:
            new_doc = {}
            for k, v in query.items():
                if not k.startswith("$"):
                    new_doc[k] = v
            if "$set" in update:
                new_doc.update(copy.deepcopy(update["$set"]))
            await self.insert_one(new_doc)
            return UpdateResult(matched_count=0, modified_count=1)
        return UpdateResult(matched_count=0, modified_count=0)

    def aggregate(self, pipeline: List[Dict[str, Any]]) -> MockAsyncCursor:
        # Simple pipeline runner for $match and basic group
        docs = copy.deepcopy(self.docs)
        for stage in pipeline:
            if "$match" in stage:
                docs = [d for d in docs if self._matches_query(d, stage["$match"])]
        return MockAsyncCursor(docs)

    async def delete_one(self, query: Dict[str, Any]) -> DeleteResult:
        for i, d in enumerate(self.docs):
            if self._matches_query(d, query):
                del self.docs[i]
                return DeleteResult(deleted_count=1)
        return DeleteResult(deleted_count=0)

    async def delete_many(self, query: Dict[str, Any]) -> DeleteResult:
        initial_len = len(self.docs)
        self.docs = [d for d in self.docs if not self._matches_query(d, query)]
        return DeleteResult(deleted_count=initial_len - len(self.docs))

    async def create_index(self, *args, **kwargs):
        pass


class MockAsyncDatabase:
    def __init__(self):
        self.collections: Dict[str, InMemoryAsyncCollection] = {}

    def __getitem__(self, name: str) -> InMemoryAsyncCollection:
        if name not in self.collections:
            self.collections[name] = InMemoryAsyncCollection(name)
        return self.collections[name]

    def clear(self):
        self.collections.clear()
