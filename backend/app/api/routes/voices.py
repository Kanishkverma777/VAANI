from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from fastapi.responses import Response

from app.api.dependencies import get_current_user
from app.core.rate_limit import require_rate_limit
from app.schemas.conversation import ConversationAccessResponse
from app.schemas.voice import VoiceListResponse, VoiceModel
from app.services.voice_service import VoiceService, default_voice_service

router = APIRouter(tags=["Voices & Conversations"])


def get_voice_service() -> VoiceService:
    return default_voice_service


@router.get(
    "/voices",
    response_model=VoiceListResponse,
    status_code=status.HTTP_200_OK,
    summary="List available ElevenLabs voices",
)
async def list_voices(
    category: Optional[str] = Query(
        default=None, description="Optional category filter (e.g. 'premade', 'cloned')"
    ),
    service: VoiceService = Depends(get_voice_service),
) -> VoiceListResponse:
    """Retrieve available ElevenLabs voices with metadata."""
    return await service.list_voices(category=category)


@router.api_route(
    "/voices/{voice_id}/preview",
    methods=["GET", "HEAD"],
    status_code=status.HTTP_200_OK,
    summary="Stream audio preview for a voice (premade or cloned)",
)
async def get_voice_preview(
    voice_id: str,
    text: Optional[str] = Query(default=None, description="Custom text to speak with cloned voice"),
    service: VoiceService = Depends(get_voice_service),
):
    """Stream MP3 audio sample preview for any voice, including custom cloned voices."""
    audio_bytes, media_type = await service.get_voice_preview_audio(voice_id, custom_text=text)
    return Response(
        content=audio_bytes,
        media_type=media_type,
        headers={
            "Cache-Control": "public, max-age=3600",
            "Accept-Ranges": "bytes",
        },
    )


@router.post(
    "/agents/{agent_id}/conversation-access",
    response_model=ConversationAccessResponse,
    status_code=status.HTTP_200_OK,
    summary="Obtain authorized browser conversation access URL",
)
async def get_conversation_access(
    agent_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    service: VoiceService = Depends(get_voice_service),
) -> ConversationAccessResponse:
    """Acquire a temporary signed URL to start a direct browser voice conversation session."""
    return await service.get_conversation_access(agent_id=agent_id, owner_id=current_user["id"])


@router.post(
    "/voices/clone",
    response_model=VoiceModel,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_rate_limit(max_requests=10, window_seconds=60, key_prefix="clone"))],
    summary="Clone a voice from an audio sample with consent check",
)
async def clone_voice(
    name: str = Form(..., description="Name for the cloned voice"),
    description: str = Form("", description="Optional voice description"),
    consent_verified: bool = Form(..., description="Explicit consent confirmation"),
    file: UploadFile = File(..., description="Audio sample file"),
    service: VoiceService = Depends(get_voice_service),
) -> VoiceModel:
    """Clone an authorized voice using ElevenLabs Instant Voice Cloning with strict safety check."""
    audio_bytes = await file.read()
    return await service.clone_voice(
        name=name,
        audio_bytes=audio_bytes,
        filename=file.filename or "sample.mp3",
        description=description,
        consent_verified=consent_verified,
    )

