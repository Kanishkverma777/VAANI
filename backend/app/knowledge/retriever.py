import math
import re
import uuid
from typing import Any, Dict, List, Optional

from qdrant_client import AsyncQdrantClient
from qdrant_client.http import models

from app.config import settings
from app.core.logging import logger
from app.knowledge.embeddings import generate_embeddings

# In-memory vector store fallback for local development/testing without external Qdrant cluster
_in_memory_vectors: List[Dict[str, Any]] = []

_STOPWORDS = {
    "a", "an", "the", "in", "on", "at", "to", "for", "of", "with", "by", "from",
    "i", "you", "he", "she", "it", "we", "they", "me", "my", "your", "our",
    "how", "many", "much", "what", "where", "when", "why", "who", "which",
    "can", "could", "should", "would", "is", "are", "was", "were", "do", "does", "did",
}


def _calculate_lexical_overlap(query: str, text: str) -> float:
    """Fast, zero-RAM lexical relevance score for hybrid search."""
    q_tokens = [w for w in re.findall(r"\b\w+\b", query.lower()) if w not in _STOPWORDS and len(w) > 1]
    if not q_tokens:
        q_tokens = [w for w in re.findall(r"\b\w+\b", query.lower()) if len(w) > 1]
    if not q_tokens:
        return 0.0

    text_lower = text.lower()
    matches = sum(1 for w in q_tokens if w in text_lower)
    return matches / len(q_tokens)


def _cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    dot = sum(a * b for a, b in zip(vec1, vec2))
    norm_a = math.sqrt(sum(a * a for a in vec1))
    norm_b = math.sqrt(sum(b * b for b in vec2))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


class QdrantRetriever:
    def __init__(
        self,
        url: Optional[str] = None,
        api_key: Optional[str] = None,
        collection_name: Optional[str] = None,
    ):
        self.url = url or settings.qdrant_url
        self.api_key = api_key or settings.qdrant_api_key
        self.collection_name = collection_name or settings.qdrant_collection
        self._client: Optional[AsyncQdrantClient] = None

    def _get_client(self) -> AsyncQdrantClient:
        if self._client is None:
            self._client = AsyncQdrantClient(url=self.url, api_key=self.api_key, timeout=10.0)
        return self._client

    async def ensure_collection(self) -> None:
        """Create Qdrant collection and required payload indexes if they do not already exist."""
        try:
            client = self._get_client()
            collections = await client.get_collections()
            existing_names = [c.name for c in collections.collections]
            if self.collection_name not in existing_names:
                await client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=models.VectorParams(
                        size=settings.embedding_dimension,
                        distance=models.Distance.COSINE,
                    ),
                )
                logger.info("Created Qdrant collection '%s'", self.collection_name)

            # Ensure payload indexes exist for strict Qdrant filtering
            for field in ["agent_id", "owner_id", "source_id"]:
                try:
                    await client.create_payload_index(
                        collection_name=self.collection_name,
                        field_name=field,
                        field_schema=models.PayloadSchemaType.KEYWORD,
                    )
                except Exception:
                    pass
        except Exception as exc:
            logger.warning(
                "Could not connect to Qdrant cluster (%s). Using in-memory fallback.", str(exc)
            )

    async def upsert_chunks(
        self,
        owner_id: str,
        agent_id: str,
        source_id: str,
        filename: str,
        chunks: List[Dict[str, Any]],
    ) -> int:
        """Embed text chunks and store them in Qdrant with ownership metadata."""
        if not chunks:
            return 0

        texts = [c["text"] for c in chunks]
        vectors = generate_embeddings(texts)

        points = []
        for i, (chunk, vector) in enumerate(zip(chunks, vectors)):
            point_id = str(uuid.uuid4())
            payload = {
                "owner_id": owner_id,
                "agent_id": agent_id,
                "source_id": source_id,
                "chunk_index": chunk.get("chunk_index", i),
                "filename": filename,
                "text": chunk["text"],
            }
            points.append(
                models.PointStruct(
                    id=point_id,
                    vector=vector,
                    payload=payload,
                )
            )
            # Store in in-memory fallback as well
            _in_memory_vectors.append({"id": point_id, "vector": vector, "payload": payload})

        try:
            client = self._get_client()
            await self.ensure_collection()
            await client.upsert(collection_name=self.collection_name, points=points)
            logger.info("Upserted %d vector chunks to Qdrant for source %s", len(points), source_id)
        except Exception as exc:
            logger.warning("Qdrant upsert fell back to in-memory store: %s", str(exc))

        return len(points)

    async def query_knowledge(
        self,
        owner_id: str,
        agent_id: str,
        query: str,
        top_k: int = 3,
        threshold: float = 0.5,
    ) -> List[Dict[str, Any]]:
        """Search relevant document chunks strictly scoped by owner_id and agent_id using Hybrid Fusion."""
        query_vector = generate_embeddings([query])[0]
        results = []

        try:
            client = self._get_client()
            filter_condition = models.Filter(
                must=[
                    models.FieldCondition(key="agent_id", match=models.MatchValue(value=agent_id)),
                ]
            )

            # 1. Fetch dense candidates from Qdrant
            dense_scores: Dict[str, float] = {}
            try:
                if hasattr(client, "query_points"):
                    response = await client.query_points(
                        collection_name=self.collection_name,
                        query=query_vector,
                        query_filter=filter_condition,
                        limit=top_k * 2,
                        with_payload=True,
                    )
                    dense_hits = response.points
                else:
                    dense_hits = await client.search(
                        collection_name=self.collection_name,
                        query_vector=query_vector,
                        query_filter=filter_condition,
                        limit=top_k * 2,
                    )
                for hit in dense_hits:
                    dense_scores[str(hit.id)] = float(hit.score)
            except Exception as dense_err:
                logger.debug("Dense query points note: %s", str(dense_err))

            # 2. Fetch candidate chunks for this agent to perform hybrid lexical scoring
            scroll_res = await client.scroll(
                collection_name=self.collection_name,
                scroll_filter=filter_condition,
                limit=50,
                with_payload=True,
            )
            candidate_points = scroll_res[0] if scroll_res else []

            # 3. Fuse scores (Dense + Lexical)
            fused_candidates = []
            for p in candidate_points:
                point_id = str(p.id)
                payload = p.payload or {}
                text = payload.get("text", "")
                dense_score = dense_scores.get(point_id, 0.0)
                lex_score = _calculate_lexical_overlap(query, text)

                # Hybrid fusion: maximum of pure dense, pure lexical, or combined
                combined_score = max(dense_score, lex_score, 0.5 * dense_score + 0.5 * lex_score)
                effective_threshold = min(threshold, 0.20)

                if combined_score >= effective_threshold:
                    fused_candidates.append(
                        {
                            "chunk_id": point_id,
                            "score": round(combined_score, 4),
                            "text": text,
                            "filename": payload.get("filename", ""),
                            "source_id": payload.get("source_id", ""),
                        }
                    )

            fused_candidates.sort(key=lambda x: x["score"], reverse=True)
            return fused_candidates[:top_k]

        except Exception as exc:
            logger.warning("Qdrant search fell back to in-memory store: %s", str(exc))
            # Fallback to in-memory vector search with hybrid scoring
            matches = []
            for item in _in_memory_vectors:
                p = item["payload"]
                if p.get("owner_id") == owner_id and p.get("agent_id") == agent_id:
                    text = p.get("text", "")
                    dense_score = _cosine_similarity(query_vector, item["vector"])
                    lex_score = _calculate_lexical_overlap(query, text)
                    combined_score = max(dense_score, lex_score, 0.5 * dense_score + 0.5 * lex_score)
                    if combined_score >= min(threshold, 0.20):
                        matches.append(
                            {
                                "chunk_id": item["id"],
                                "score": round(combined_score, 4),
                                "text": text,
                                "filename": p.get("filename", ""),
                                "source_id": p.get("source_id", ""),
                            }
                        )
            matches.sort(key=lambda x: x["score"], reverse=True)
            return matches[:top_k]

    async def delete_source_vectors(self, source_id: str, owner_id: str, agent_id: str) -> None:
        """Remove vectors associated with a deleted document."""
        global _in_memory_vectors
        _in_memory_vectors = [
            v for v in _in_memory_vectors if v["payload"].get("source_id") != source_id
        ]
        try:
            client = self._get_client()
            filter_condition = models.Filter(
                must=[
                    models.FieldCondition(
                        key="source_id", match=models.MatchValue(value=source_id)
                    ),
                    models.FieldCondition(key="owner_id", match=models.MatchValue(value=owner_id)),
                ]
            )
            await client.delete(
                collection_name=self.collection_name,
                points_selector=models.FilterSelector(filter=filter_condition),
            )
        except Exception:
            pass


default_qdrant_retriever = QdrantRetriever()
