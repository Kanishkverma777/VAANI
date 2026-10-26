import asyncio
from collections import OrderedDict
from functools import wraps
import time
from typing import Any, Callable, Dict, Optional, Tuple

from app.core.logging import logger


class InMemoryCache:
    """High-performance thread-safe in-memory cache with TTL and LRU eviction."""

    def __init__(self, max_size: int = 1000):
        self.max_size = max_size
        self._store: OrderedDict[str, Tuple[Any, float]] = OrderedDict()
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Optional[Any]:
        """Retrieve an item if it exists and has not expired (O(1))."""
        async with self._lock:
            if key not in self._store:
                return None
            value, expires_at = self._store[key]
            if time.time() > expires_at:
                del self._store[key]
                return None
            # Move to end (most recently used)
            self._store.move_to_end(key)
            return value

    async def set(self, key: str, value: Any, ttl_seconds: float = 60.0) -> None:
        """Store an item with a time-to-live expiration (O(1))."""
        async with self._lock:
            now = time.time()
            expires_at = now + ttl_seconds
            if key in self._store:
                self._store.move_to_end(key)
            self._store[key] = (value, expires_at)

            # Evict least recently used entries if over capacity
            while len(self._store) > self.max_size:
                self._store.popitem(last=False)

    async def delete(self, key: str) -> bool:
        """Delete a single key from cache."""
        async with self._lock:
            if key in self._store:
                del self._store[key]
                return True
            return False

    async def clear_prefix(self, prefix: str) -> int:
        """Remove all keys starting with a prefix."""
        async with self._lock:
            keys_to_delete = [k for k in self._store if k.startswith(prefix)]
            for k in keys_to_delete:
                del self._store[k]
            return len(keys_to_delete)

    async def clear(self) -> None:
        """Purge all entries from the cache."""
        async with self._lock:
            self._store.clear()


# Global default cache instance
default_cache = InMemoryCache(max_size=2000)


def cached(ttl_seconds: float = 60.0, prefix: str = "", cache_instance: Optional[InMemoryCache] = None):
    """Decorator to cache asynchronous function responses with TTL."""
    cache = cache_instance or default_cache

    def decorator(func: Callable):
        func_prefix = prefix or f"{func.__module__}.{func.__qualname__}"

        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Build cache key omitting `self` if present
            call_args = args[1:] if args and hasattr(args[0], "__dict__") else args
            key_parts = [func_prefix]
            if call_args:
                key_parts.append(str(call_args))
            if kwargs:
                key_parts.append(str(sorted(kwargs.items())))
            cache_key = ":".join(key_parts)

            cached_val = await cache.get(cache_key)
            if cached_val is not None:
                return cached_val

            result = await func(*args, **kwargs)
            if result is not None:
                await cache.set(cache_key, result, ttl_seconds=ttl_seconds)
            return result

        return wrapper

    return decorator


async def invalidate_cache(prefix: str, cache_instance: Optional[InMemoryCache] = None) -> int:
    """Invalidate all cached items matching a prefix."""
    cache = cache_instance or default_cache
    removed = await cache.clear_prefix(prefix)
    if removed > 0:
        logger.debug("Invalidated %d cache keys for prefix '%s'", removed, prefix)
    return removed
