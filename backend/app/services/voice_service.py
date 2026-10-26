from typing import List, Optional

from app.core.exceptions import NotFoundException, ValidationException
from app.core.logging import logger
from app.integrations.elevenlabs_client import ElevenLabsClient, default_elevenlabs_client
from app.repositories.agent_repository import AgentRepository, default_agent_repository
from app.schemas.conversation import ConversationAccessResponse
from app.schemas.voice import VoiceListResponse, VoiceModel


class VoiceService:
    def __init__(
        self,
        elevenlabs_client: Optional[ElevenLabsClient] = None,
        agent_repo: Optional[AgentRepository] = None,
    ):
        self.client = elevenlabs_client or default_elevenlabs_client
        self.agent_repo = agent_repo or default_agent_repository

    async def list_voices(self, category: Optional[str] = None) -> VoiceListResponse:
        """Retrieve available ElevenLabs voices with optional category filtering."""
        voices: List[VoiceModel] = await self.client.list_voices()
        if category:
            voices = [v for v in voices if (v.category or "").lower() == category.lower()]
        return VoiceListResponse(voices=voices, total=len(voices))

    async def get_conversation_access(
        self, agent_id: str, owner_id: str
    ) -> ConversationAccessResponse:
        """Authorize and generate a signed WebSocket/WebRTC URL for browser voice sessions."""
        agent = await self.agent_repo.get_agent_by_id(agent_id, owner_id=owner_id)
        if not agent:
            raise NotFoundException(
                f"Agent with ID '{agent_id}' was not found.",
                code="AGENT_NOT_FOUND",
            )

        provider_agent_id = agent.get("provider_agent_id")
        if not provider_agent_id:
            raise ValidationException(
                f"Agent '{agent_id}' must be deployed before accessing conversation sessions.",
                code="AGENT_NOT_DEPLOYED",
            )

        try:
            signed_url = await self.client.get_conversation_signed_url(provider_agent_id)
        except Exception as exc:
            logger.warning("Could not fetch remote signed url for %s: %s", provider_agent_id, exc)
            signed_url = f"wss://api.elevenlabs.io/v1/convai/conversation?agent_id={provider_agent_id}"

        return ConversationAccessResponse(
            agent_id=agent_id,
            provider_agent_id=provider_agent_id,
            signed_url=signed_url,
            session_format="webrtc_signed_url",
            instructions=(
                "Connect to the signed_url using the official ElevenLabs Conversational AI SDK or WebRTC client. "
                "Do not share or log this signed URL publicly."
            ),
        )

    async def clone_voice(
        self,
        name: str,
        audio_bytes: bytes,
        filename: str,
        description: str = "",
        consent_verified: bool = False,
    ) -> VoiceModel:
        """Create a custom voice clone on ElevenLabs with strict consent verification."""
        if not consent_verified:
            raise ValidationException(
                "Explicit user consent is mandatory for voice cloning under AI Safety Guidelines.",
                code="CONSENT_NOT_VERIFIED",
            )
        if not name or len(name.strip()) < 2:
            raise ValidationException("Voice name must be at least 2 characters.", code="INVALID_NAME")
        if not audio_bytes or len(audio_bytes) < 500:
            raise ValidationException("Audio sample must contain valid audio data.", code="INVALID_AUDIO")

        res = await self.client.clone_voice(
            name=name.strip(),
            audio_bytes=audio_bytes,
            filename=filename,
            description=description,
        )
        voice_id = res.get("voice_id", "")
        return VoiceModel(
            voice_id=voice_id,
            name=name.strip(),
            category="cloned",
            description=description or "Custom cloned voice",
            preview_url=None,
            labels={"cloned": "true"},
        )


default_voice_service = VoiceService()
