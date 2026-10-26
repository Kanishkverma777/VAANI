from typing import Any, Dict, List

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile, status
from pydantic import BaseModel

from app.api.dependencies import get_current_user
from app.schemas.agent import (
    AgentChatRequest,
    AgentChatResponse,
    AgentCreate,
    AgentResponse,
    AgentUpdate,
)
from app.schemas.common import PaginatedResponse, SuccessResponse
from app.services.agent_service import AgentService, default_agent_service

router = APIRouter(prefix="/agents", tags=["Agents"])


def get_agent_service() -> AgentService:
    return default_agent_service


class SynthesizeSpeechRequest(BaseModel):
    text: str


@router.post(
    "",
    response_model=AgentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new voice agent configuration",
)
async def create_agent(
    data: AgentCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: AgentService = Depends(get_agent_service),
) -> AgentResponse:
    """Create a local agent record and initial configuration version."""
    return await service.create_agent(data, owner_id=current_user["id"])


@router.get(
    "",
    response_model=PaginatedResponse[AgentResponse],
    status_code=status.HTTP_200_OK,
    summary="List agents owned by the current user",
)
async def list_agents(
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: AgentService = Depends(get_agent_service),
) -> PaginatedResponse[AgentResponse]:
    """Retrieve paginated list of agents belonging to the authenticated user."""
    return await service.list_agents(owner_id=current_user["id"], page=page, page_size=page_size)


@router.get(
    "/{agent_id}",
    response_model=AgentResponse,
    status_code=status.HTTP_200_OK,
    summary="Get details of a specific agent",
)
async def get_agent(
    agent_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: AgentService = Depends(get_agent_service),
) -> AgentResponse:
    """Retrieve full configuration and metadata for a specific agent by ID."""
    return await service.get_agent(agent_id=agent_id, owner_id=current_user["id"])


@router.patch(
    "/{agent_id}",
    response_model=AgentResponse,
    status_code=status.HTTP_200_OK,
    summary="Update an agent's configuration or metadata",
)
async def update_agent(
    agent_id: str,
    data: AgentUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: AgentService = Depends(get_agent_service),
) -> AgentResponse:
    """Update agent configuration and create a new immutable version entry."""
    return await service.update_agent(agent_id=agent_id, owner_id=current_user["id"], data=data)


@router.delete(
    "/{agent_id}",
    response_model=SuccessResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete an agent",
)
async def delete_agent(
    agent_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: AgentService = Depends(get_agent_service),
) -> SuccessResponse:
    """Delete an agent record and its associated local version history."""
    await service.delete_agent(agent_id=agent_id, owner_id=current_user["id"])
    return SuccessResponse(success=True, message=f"Agent '{agent_id}' deleted successfully.")


@router.get(
    "/{agent_id}/versions",
    response_model=List[Dict[str, Any]],
    status_code=status.HTTP_200_OK,
    summary="Get configuration version history for an agent",
)
async def get_agent_versions(
    agent_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: AgentService = Depends(get_agent_service),
) -> List[Dict[str, Any]]:
    """Retrieve configuration history for an agent."""
    return await service.get_versions(agent_id=agent_id, owner_id=current_user["id"])


@router.post(
    "/{agent_id}/chat",
    response_model=AgentChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Interactive conversational voice turn test",
)
async def chat_with_agent(
    agent_id: str,
    request: AgentChatRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: AgentService = Depends(get_agent_service),
) -> AgentChatResponse:
    """Send user speech/message to agent and receive spoken conversational reply."""
    result = await service.chat_with_agent(
        agent_id=agent_id,
        owner_id=current_user["id"],
        message=request.message,
        history=request.history,
    )
    return AgentChatResponse(**result)


@router.get(
    "/{agent_id}/public",
    response_model=AgentResponse,
    status_code=status.HTTP_200_OK,
    summary="Get public details of an agent for web calling",
)
async def get_public_agent(
    agent_id: str,
    service: AgentService = Depends(get_agent_service),
) -> AgentResponse:
    """Retrieve public agent configuration for web calling room without requiring login."""
    return await service.get_agent(agent_id=agent_id, owner_id="public")


@router.post(
    "/{agent_id}/public-chat",
    response_model=AgentChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Public interactive conversational voice turn",
)
async def public_chat_with_agent(
    agent_id: str,
    request: AgentChatRequest,
    service: AgentService = Depends(get_agent_service),
) -> AgentChatResponse:
    """Send user speech/message to agent and receive spoken conversational reply without requiring login."""
    result = await service.chat_with_agent(
        agent_id=agent_id,
        owner_id="public",
        message=request.message,
        history=request.history,
    )
    return AgentChatResponse(**result)


@router.post(
    "/{agent_id}/transcribe",
    status_code=status.HTTP_200_OK,
    summary="Transcribe browser audio using Groq Whisper",
)
async def transcribe_agent_audio(
    agent_id: str,
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: AgentService = Depends(get_agent_service),
) -> Dict[str, str]:
    """Transcribe microphone audio blob into text."""
    audio_bytes = await file.read()
    text = await service.transcribe_voice(
        audio_bytes=audio_bytes,
        filename=file.filename or "audio.webm",
    )
    return {"text": text}


@router.post(
    "/{agent_id}/synthesize",
    status_code=status.HTTP_200_OK,
    summary="Synthesize speech audio using ElevenLabs neural TTS",
)
async def synthesize_agent_speech(
    agent_id: str,
    request: SynthesizeSpeechRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: AgentService = Depends(get_agent_service),
):
    """Generate high-fidelity MP3 audio for agent speech using ElevenLabs."""
    audio_bytes = await service.synthesize_voice(
        agent_id=agent_id,
        text=request.text,
        owner_id=current_user["id"],
    )
    return Response(content=audio_bytes, media_type="audio/mpeg")


