from typing import Any, Dict

from fastapi import APIRouter, Depends, Query, status

from app.api.dependencies import get_current_user
from app.schemas.analytics import SyncSessionRequest
from app.schemas.common import PaginatedResponse
from app.schemas.conversation import SessionDetailResponse
from app.services.conversation_service import (
    ConversationService,
    default_conversation_service,
)

router = APIRouter(tags=["Sessions & Conversations"])


def get_conversation_service() -> ConversationService:
    return default_conversation_service


@router.get(
    "/agents/{agent_id}/sessions",
    response_model=PaginatedResponse[SessionDetailResponse],
    status_code=status.HTTP_200_OK,
    summary="List historical conversation sessions for an agent",
)
async def list_agent_sessions(
    agent_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: ConversationService = Depends(get_conversation_service),
) -> PaginatedResponse[SessionDetailResponse]:
    """Retrieve recorded sessions and transcripts for the specified agent."""
    return await service.list_agent_sessions(
        agent_id=agent_id, owner_id=current_user["id"], page=page, page_size=page_size
    )


@router.post(
    "/agents/{agent_id}/sessions/sync",
    response_model=SessionDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Synchronize a specific conversation session from ElevenLabs",
)
async def sync_session(
    agent_id: str,
    request: SyncSessionRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: ConversationService = Depends(get_conversation_service),
) -> SessionDetailResponse:
    """Fetch transcripts, durations, and metadata for a conversation directly from ElevenLabs."""
    return await service.sync_session(
        agent_id=agent_id,
        provider_conversation_id=request.provider_conversation_id,
        owner_id=current_user["id"],
    )


@router.get(
    "/sessions",
    response_model=PaginatedResponse[SessionDetailResponse],
    status_code=status.HTTP_200_OK,
    summary="List all historical conversation sessions for the current user",
)
async def list_user_sessions(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    auto_sync: bool = Query(default=False, description="Whether to check provider for missing sessions"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: ConversationService = Depends(get_conversation_service),
) -> PaginatedResponse[SessionDetailResponse]:
    """Retrieve recorded sessions across all agents for the authenticated user."""
    return await service.list_user_sessions(
        owner_id=current_user["id"], page=page, page_size=page_size, auto_sync=auto_sync
    )


@router.post(
    "/sessions/sync-all",
    status_code=status.HTTP_200_OK,
    summary="Synchronize recent conversation sessions across all agents from ElevenLabs",
)
async def sync_all_sessions(
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: ConversationService = Depends(get_conversation_service),
) -> Dict[str, Any]:
    """Fetch and synchronize any un-synced conversations from ElevenLabs."""
    synced = await service.sync_user_sessions_from_provider(owner_id=current_user["id"])
    return {"status": "success", "synced_count": synced}


@router.get(
    "/sessions/{session_id}",
    response_model=SessionDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get detailed conversation transcript and metrics for a single session",
)
async def get_session(
    session_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: ConversationService = Depends(get_conversation_service),
) -> SessionDetailResponse:
    """Retrieve full transcript and outcome for a single conversation session."""
    return await service.get_session_by_id(session_id=session_id, owner_id=current_user["id"])


@router.post(
    "/conversations/webhook",
    status_code=status.HTTP_200_OK,
    summary="ElevenLabs conversation event webhook endpoint",
)
async def conversation_webhook(
    payload: Dict[str, Any],
    service: ConversationService = Depends(get_conversation_service),
) -> Dict[str, Any]:
    """Idempotently process conversation events and transcripts from ElevenLabs webhooks."""
    return await service.ingest_webhook_event(payload)
