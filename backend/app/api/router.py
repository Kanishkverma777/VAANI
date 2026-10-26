from fastapi import APIRouter

from app.api.routes.agents import router as agents_router
from app.api.routes.analytics import router as analytics_router
from app.api.routes.auth import router as auth_router
from app.api.routes.conversations import router as conversations_router
from app.api.routes.deployments import router as deployments_router
from app.api.routes.generation import router as generation_router
from app.api.routes.knowledge import router as knowledge_router
from app.api.routes.tests import router as tests_router
from app.api.routes.voices import router as voices_router

api_router = APIRouter()

# Mount feature routers
api_router.include_router(auth_router)
api_router.include_router(generation_router)
api_router.include_router(agents_router)
api_router.include_router(deployments_router)
api_router.include_router(voices_router)
api_router.include_router(conversations_router)
api_router.include_router(analytics_router)
api_router.include_router(knowledge_router)
api_router.include_router(tests_router)
