from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter, Response, status

from app.config import settings
from app.database import ping_database

router = APIRouter(tags=["Health"])


@router.get("/health", status_code=status.HTTP_200_OK)
async def health_check() -> Dict[str, Any]:
    """Basic liveness probe to verify the application process is running."""
    return {
        "status": "healthy",
        "app_name": settings.app_name,
        "environment": settings.app_env,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/ready")
async def readiness_check(response: Response) -> Dict[str, Any]:
    """Readiness probe checking critical database and integration dependencies."""
    db_ok = await ping_database()

    integrations = {
        "groq_configured": settings.has_groq,
        "elevenlabs_configured": settings.has_elevenlabs,
        "qdrant_configured": settings.has_qdrant,
    }

    # Determine readiness status:
    # In test/dev environment, if mongodb is not reached, report degraded or not_ready
    is_ready = db_ok
    if not is_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "ready": is_ready,
        "status": "ready" if is_ready else "degraded",
        "dependencies": {
            "mongodb": "connected" if db_ok else "unreachable",
            **integrations,
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
