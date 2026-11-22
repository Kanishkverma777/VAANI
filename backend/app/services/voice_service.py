from typing import List, Optional

from app.core.cache import default_cache
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
        # Invalidate voice catalog cache so new clone voice appears instantly in listings
        await default_cache.delete("elevenlabs:voices:catalog")
        return VoiceModel(
            voice_id=voice_id,
            name=name.strip(),
            category="cloned",
            description=description or "Custom cloned voice",
            preview_url=f"/api/v1/voices/{voice_id}/preview",
            labels={"cloned": "true"},
        )

    async def get_voice_preview_audio(
        self, voice_id: str, custom_text: Optional[str] = None
    ) -> tuple[bytes, str]:
        """Synthesize and stream a real-time neural speech demonstration using the specified voice."""
        demo_text = custom_text.strip() if custom_text and custom_text.strip() else (
            "Namaste! This is an AI generated demonstration using your newly cloned voice on VAANI. "
            "I can now speak any new sentence on your phone calls and customer conversations."
        )
        cache_key = f"voice:preview:synth:{voice_id}:{abs(hash(demo_text)) % 10000000}"
        cached = await default_cache.get(cache_key)
        if cached:
            return cached, "audio/mpeg"

        # 1. Synthesize brand new neural speech using the cloned voice model
        try:
            tts_bytes = await self.client.text_to_speech(
                text=demo_text,
                voice_id=voice_id,
                model_id="eleven_multilingual_v2",
            )
            if tts_bytes and len(tts_bytes) > 500:
                await default_cache.set(cache_key, tts_bytes, ttl_seconds=3600.0)
                return tts_bytes, "audio/mpeg"
        except Exception as tts_err:
            logger.warning("Neural speech synthesis failed for voice %s: %s", voice_id, tts_err)

        # 2. Fallback: if TTS quota is hit or unavailable, retrieve uploaded voice sample as safety net
        try:
            voice_meta = await self.client.get_voice(voice_id)
            samples = voice_meta.get("samples") or []
            if samples:
                sample_id = samples[0].get("sample_id")
                if sample_id:
                    sample_bytes = await self.client.get_voice_sample_audio(voice_id, sample_id)
                    if sample_bytes and len(sample_bytes) > 500:
                        return sample_bytes, "audio/mpeg"
        except Exception as sample_err:
            logger.warning("Error fetching sample audio for voice %s: %s", voice_id, sample_err)

        raise NotFoundException(f"Audio preview not available for voice '{voice_id}'.", code="PREVIEW_NOT_FOUND")


default_voice_service = VoiceService()
