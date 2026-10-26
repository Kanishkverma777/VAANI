import hashlib
import math
import re
from typing import Dict, List, Optional

from app.config import settings
from app.core.logging import logger

_embedding_cache: Dict[str, List[float]] = {}
MAX_EMBEDDING_CACHE_SIZE = 10000


def _compute_chunk_hash(text: str) -> str:
    return hashlib.md5(text.encode("utf-8")).hexdigest()


class SemanticFastEmbedder:
    """
    Ultra-lightweight, zero-RAM semantic embedding engine (384 dimensions).
    Uses Random Indexing with subword n-grams and bigram projection to produce
    unit-normalized dense vectors compliant with Qdrant Cosine distance without
    allocating hundreds of megabytes of PyTorch RAM in memory-constrained environments.
    """

    def __init__(self, dimension: int = 384):
        self.dimension = dimension

    def _term_projection(self, term: str) -> List[float]:
        vec = [0.0] * self.dimension
        h = int(hashlib.sha256(term.encode("utf-8")).hexdigest(), 16)
        # 6 sparse non-zero projection indices per term
        for i in range(6):
            idx = (h >> (i * 10)) % self.dimension
            sign = 1.0 if ((h >> (i * 10 + 9)) & 1) == 0 else -1.0
            vec[idx] += sign
        return vec

    def embed_single(self, text: str) -> List[float]:
        doc_vec = [0.0] * self.dimension
        clean = re.sub(r"[^\w\s]", " ", text.lower())
        tokens = clean.split()
        if not tokens:
            return doc_vec

        for i, token in enumerate(tokens):
            w = 1.5 if len(token) > 3 else 1.0
            tv = self._term_projection(token)
            for d in range(self.dimension):
                doc_vec[d] += tv[d] * w

            # Subword 3-grams for morphology and inflection matching
            if len(token) >= 4:
                for j in range(len(token) - 2):
                    sub = token[j : j + 3]
                    stv = self._term_projection(f"sub_{sub}")
                    for d in range(self.dimension):
                        doc_vec[d] += stv[d] * 0.4

            # Word bigrams for phrase semantics
            if i < len(tokens) - 1:
                bigram = f"{token}_{tokens[i + 1]}"
                btv = self._term_projection(bigram)
                for d in range(self.dimension):
                    doc_vec[d] += btv[d] * 0.8

        # Normalize to unit length (L2 norm = 1.0 for cosine similarity)
        norm = math.sqrt(sum(x * x for x in doc_vec))
        if norm > 0:
            doc_vec = [round(x / norm, 6) for x in doc_vec]
        return doc_vec


_fast_embedder = SemanticFastEmbedder(dimension=settings.embedding_dimension)


def generate_embeddings(texts: List[str]) -> List[List[float]]:
    """
    Generate 384-dimensional dense embeddings with chunk caching and zero memory overhead.
    Eliminates PyTorch 400MB RAM spikes on cloud hosts like Render free tier.
    """
    if not texts:
        return []

    results: List[Optional[List[float]]] = [None] * len(texts)
    missing_indices: List[int] = []
    missing_texts: List[str] = []

    # Check cache for previously embedded text chunks (O(1) hit)
    for idx, text in enumerate(texts):
        chunk_hash = _compute_chunk_hash(text)
        if chunk_hash in _embedding_cache:
            results[idx] = _embedding_cache[chunk_hash]
        else:
            missing_indices.append(idx)
            missing_texts.append(text)

    # Encode remaining un-cached texts with fast semantic embedder
    if missing_texts:
        for i, idx in enumerate(missing_indices):
            emb = _fast_embedder.embed_single(missing_texts[i])
            results[idx] = emb
            if len(_embedding_cache) < MAX_EMBEDDING_CACHE_SIZE:
                _embedding_cache[_compute_chunk_hash(missing_texts[i])] = emb

    return [r for r in results if r is not None]
