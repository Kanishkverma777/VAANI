import hashlib
from typing import Dict, List, Optional

from sentence_transformers import SentenceTransformer
import torch

from app.config import settings
from app.core.logging import logger

_model: Optional[SentenceTransformer] = None
_embedding_cache: Dict[str, List[float]] = {}
MAX_EMBEDDING_CACHE_SIZE = 10000


def get_embedding_model() -> SentenceTransformer:
    """Lazily load SentenceTransformer embedding model."""
    global _model
    if _model is None:
        logger.info("Loading embedding model %s ...", settings.embedding_model)
        _model = SentenceTransformer(settings.embedding_model)
        # Enable eval mode for inference
        _model.eval()
    return _model


def _compute_chunk_hash(text: str) -> str:
    return hashlib.md5(text.encode("utf-8")).hexdigest()


def generate_embeddings(texts: List[str]) -> List[List[float]]:
    """Generate dense embeddings with vectorized batching and LRU chunk caching."""
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

    # Encode remaining un-cached texts in high-throughput batched inference
    if missing_texts:
        model = get_embedding_model()
        with torch.inference_mode():
            encoded = model.encode(
                missing_texts,
                batch_size=64,
                convert_to_numpy=True,
                normalize_embeddings=True,
                show_progress_bar=False,
            )

        encoded_list = encoded.tolist()
        for i, idx in enumerate(missing_indices):
            emb = encoded_list[i]
            results[idx] = emb
            # Store in cache
            if len(_embedding_cache) < MAX_EMBEDDING_CACHE_SIZE:
                _embedding_cache[_compute_chunk_hash(missing_texts[i])] = emb

    return [r for r in results if r is not None]
