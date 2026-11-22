from typing import Callable
from fastapi import Request

from app.config import settings
from app.core.cache import default_cache
from app.core.exceptions import RateLimitException
from app.core.logging import logger


def require_rate_limit(
    max_requests: int = 30,
    window_seconds: int = 60,
    key_prefix: str = "rl",
) -> Callable:
    """
    FastAPI dependency enforcing a rate limit per client IP or authenticated user.
    Protects against Denial of Wallet and LLM/TTS API quota exhaustion.
    """

    async def dependency(request: Request):
        # Bypass during automated test runner executions
        if getattr(settings, "app_env", "development") == "testing":
            return

        auth_header = request.headers.get("Authorization", "")
        client_ip = request.client.host if request.client else "unknown_ip"

        # Unique key based on auth token snippet or client IP
        identity = f"usr_{abs(hash(auth_header)) % 10000000}" if auth_header else f"ip_{client_ip}"
        cache_key = f"{key_prefix}:{identity}"

        current = await default_cache.get(cache_key)
        if current is None:
            await default_cache.set(cache_key, 1, ttl_seconds=float(window_seconds))
        elif current >= max_requests:
            logger.warning(
                "Rate limit exceeded for %s on %s (%d/%d)",
                identity,
                request.url.path,
                current,
                max_requests,
            )
            raise RateLimitException(
                f"Rate limit exceeded. Maximum {max_requests} requests per {window_seconds}s allowed. Please slow down.",
                code="API_RATE_LIMIT_EXCEEDED",
            )
        else:
            await default_cache.set(cache_key, current + 1, ttl_seconds=float(window_seconds))

    return dependency
