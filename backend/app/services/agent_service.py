import time
from typing import Any, Dict, List, Optional

from app.config import settings
from app.core.exceptions import NotFoundException, ValidationException
from app.core.logging import logger
from app.integrations.elevenlabs_client import (
    ElevenLabsClient,
    default_elevenlabs_client,
)
from app.integrations.llm_client import LLMClient, default_llm_client
from app.repositories.agent_repository import AgentRepository, default_agent_repository
from app.schemas.agent import (
    AgentConfiguration,
    AgentCreate,
    AgentResponse,
    AgentStatusEnum,
    AgentUpdate,
)
from app.schemas.common import PaginatedResponse

VALID_STATUS_TRANSITIONS = {
    AgentStatusEnum.DRAFT: [
        AgentStatusEnum.CONFIGURED,
        AgentStatusEnum.ARCHIVED,
    ],
    AgentStatusEnum.CONFIGURED: [
        AgentStatusEnum.PROVISIONING,
        AgentStatusEnum.DRAFT,
        AgentStatusEnum.ARCHIVED,
    ],
    AgentStatusEnum.PROVISIONING: [
        AgentStatusEnum.ACTIVE,
        AgentStatusEnum.DEPLOYMENT_FAILED,
        AgentStatusEnum.ARCHIVED,
    ],
    AgentStatusEnum.ACTIVE: [
        AgentStatusEnum.CONFIGURED,
        AgentStatusEnum.PROVISIONING,
        AgentStatusEnum.ARCHIVED,
    ],
    AgentStatusEnum.DEPLOYMENT_FAILED: [
        AgentStatusEnum.CONFIGURED,
        AgentStatusEnum.PROVISIONING,
        AgentStatusEnum.ARCHIVED,
    ],
    AgentStatusEnum.ARCHIVED: [],
}


def _validate_status_transition(current_status: AgentStatusEnum, new_status: AgentStatusEnum):
    if current_status == new_status:
        return
    allowed = VALID_STATUS_TRANSITIONS.get(current_status, [])
    if new_status not in allowed:
        raise ValidationException(
            f"Invalid agent status transition from '{current_status.value}' to '{new_status.value}'.",
            code="INVALID_STATUS_TRANSITION",
            details={
                "current_status": current_status,
                "attempted_status": new_status,
                "allowed": allowed,
            },
        )




class AgentService:
    def __init__(
        self,
        agent_repo: Optional[AgentRepository] = None,
        llm_client: Optional[LLMClient] = None,
        elevenlabs_client: Optional[ElevenLabsClient] = None,
    ):
        self.agent_repo = agent_repo or default_agent_repository
        self.llm_client = llm_client or default_llm_client
        self.elevenlabs_client = elevenlabs_client or default_elevenlabs_client

    async def create_agent(self, data: AgentCreate, owner_id: str) -> AgentResponse:
        agent_dict = {
            "owner_id": owner_id,
            "name": data.name,
            "description": data.description or data.configuration.description,
            "use_case": data.use_case.value,
            "status": AgentStatusEnum.CONFIGURED.value,
            "provider": "elevenlabs",
            "provider_agent_id": None,
            "configuration": data.configuration.model_dump(),
            "published_at": None,
        }
        created = await self.agent_repo.create_agent(agent_dict)
        return self._to_response(created)

    async def get_agent(self, agent_id: str, owner_id: str) -> AgentResponse:
        if owner_id == "public":
            agent = await self.agent_repo.get_agent_by_id(agent_id, owner_id=None)
        else:
            agent = await self.agent_repo.get_agent_by_id(agent_id, owner_id=owner_id)
            if not agent:
                legacy = await self.agent_repo.get_agent_by_id(agent_id, owner_id=None)
                if legacy and not legacy.get("owner_id"):
                    agent = legacy
        if not agent:
            raise NotFoundException(
                f"Agent with ID '{agent_id}' was not found.",
                code="AGENT_NOT_FOUND",
            )
        return self._to_response(agent)

    async def list_agents(
        self, owner_id: str, page: int = 1, page_size: int = 20
    ) -> PaginatedResponse[AgentResponse]:
        page = max(1, page)
        page_size = max(1, min(page_size, 100))
        skip = (page - 1) * page_size

        docs, total = await self.agent_repo.list_agents(owner_id, skip=skip, limit=page_size)
        items = [self._to_response(d) for d in docs]
        has_more = (skip + len(items)) < total

        return PaginatedResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            has_more=has_more,
        )

    async def update_agent(self, agent_id: str, owner_id: str, data: AgentUpdate) -> AgentResponse:
        existing = await self.agent_repo.get_agent_by_id(agent_id, owner_id=owner_id)
        if not existing:
            legacy = await self.agent_repo.get_agent_by_id(agent_id, owner_id=None)
            if legacy and not legacy.get("owner_id"):
                existing = legacy
        if not existing:
            raise NotFoundException(
                f"Agent with ID '{agent_id}' was not found.",
                code="AGENT_NOT_FOUND",
            )

        target_owner_id = existing.get("owner_id", owner_id)

        update_fields: Dict[str, Any] = {}
        if data.name is not None:
            update_fields["name"] = data.name
        if data.description is not None:
            update_fields["description"] = data.description
        if data.use_case is not None:
            update_fields["use_case"] = data.use_case.value

        new_config_dict = None
        if data.configuration is not None:
            new_config_dict = data.configuration.model_dump()
            # If agent was active and configuration was edited locally, status goes back to configured
            if existing.get("status") == AgentStatusEnum.ACTIVE.value:
                update_fields["status"] = AgentStatusEnum.CONFIGURED.value

        # Auto-sync configuration updates (language, prompts, welcome_message) to ElevenLabs remote agent
        elevenlabs_id = existing.get("elevenlabs_agent_id") or existing.get("provider_agent_id")
        if elevenlabs_id and data.configuration is not None:
            try:
                await self.elevenlabs_client.update_agent(
                    provider_agent_id=elevenlabs_id,
                    name=update_fields.get("name", existing.get("name", "Voice Agent")),
                    config=data.configuration,
                )
                logger.info("Auto-synchronized updated configuration to ElevenLabs agent %s", elevenlabs_id)
                # Keep active status since remote ElevenLabs agent is up to date
                update_fields["status"] = AgentStatusEnum.ACTIVE.value
            except Exception as sync_err:
                logger.warning("Could not auto-sync update to ElevenLabs agent %s: %s", elevenlabs_id, sync_err)

        updated = await self.agent_repo.update_agent(
            agent_id=agent_id,
            owner_id=target_owner_id,
            update_fields=update_fields,
            new_version_config=new_config_dict,
            change_description=data.change_description,
        )
        if not updated:
            raise NotFoundException(
                f"Agent '{agent_id}' could not be updated.", code="UPDATE_FAILED"
            )

        return self._to_response(updated)

    async def delete_agent(self, agent_id: str, owner_id: str) -> bool:
        existing = await self.agent_repo.get_agent_by_id(agent_id, owner_id=owner_id)
        if not existing:
            raise NotFoundException(
                f"Agent with ID '{agent_id}' was not found.",
                code="AGENT_NOT_FOUND",
            )

        target_owner_id = existing.get("owner_id", owner_id)
        provider_agent_id = existing.get("provider_agent_id")

        # Sync deletion with ElevenLabs cloud if deployed
        if provider_agent_id and settings.has_elevenlabs:
            try:
                await self.elevenlabs_client.delete_agent(provider_agent_id)
            except Exception as exc:
                logger.warning("Could not delete remote ElevenLabs agent %s: %s", provider_agent_id, exc)

        await self.agent_repo.delete_agent(agent_id, target_owner_id)
        try:
            del_q = self.agent_repo._build_id_query(agent_id)
            await self.agent_repo._agents().delete_one(del_q)
            await self.agent_repo._versions().delete_many({"agent_id": agent_id})
        except Exception:
            pass
        return True

    async def get_versions(self, agent_id: str, owner_id: str) -> List[Dict[str, Any]]:
        agent = await self.agent_repo.get_agent_by_id(agent_id, owner_id=owner_id)
        if not agent:
            legacy = await self.agent_repo.get_agent_by_id(agent_id, owner_id=None)
            if legacy and not legacy.get("owner_id"):
                agent = legacy
        if not agent:
            return []
        target_owner_id = agent.get("owner_id", owner_id)
        return await self.agent_repo.get_agent_versions(agent_id, target_owner_id)

    async def chat_with_agent(
        self,
        agent_id: str,
        owner_id: str,
        message: str,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """Process conversational voice turn and return concise, spoken AI reply."""
        agent = await self.get_agent(agent_id, owner_id)
        config = agent.configuration

        system_prompt = (
            f"You are {agent.name}, an AI conversational voice agent with the following personality:\n"
            f"Tone: {config.personality.tone}\n"
            f"Speaking Style: {config.personality.speaking_style}\n"
            f"Instructions: {config.instructions}\n"
            f"Language: {config.language}\n"
            f"Fallback message: {config.guardrails.fallback_message}\n\n"
            "CRITICAL VOICE RULES:\n"
            "1. Answer in 1 to 2 spoken sentences maximum.\n"
            "2. Be concise, direct, courteous, and natural.\n"
            "3. Do NOT use markdown, bullet points, asterisks, or emojis because your response will be read aloud by a voice synthesizer.\n"
            f"4. If the query is off-topic or disallowed, politely state: '{config.guardrails.fallback_message}'"
        )

        lang_names = {
            "en": "English",
            "hi": "Hindi",
            "es": "Spanish",
            "fr": "French",
            "de": "German",
            "ja": "Japanese",
            "pt": "Portuguese",
            "it": "Italian",
            "ar": "Arabic",
            "zh": "Chinese",
            "nl": "Dutch",
            "ko": "Korean",
            "ru": "Russian",
            "tr": "Turkish",
            "pl": "Polish",
            "sv": "Swedish",
            "id": "Indonesian",
            "hi": "Hindi (हिन्दी)",
            "hi-en": "Hinglish (हिंग्लिश)",
            "ta": "Tamil (தமிழ்)",
            "te": "Telugu (తెలుగు)",
            "bn": "Bengali (বাংলা)",
            "mr": "Marathi (मराठी)",
            "gu": "Gujarati (ગુજરાતી)",
            "kn": "Kannada (ಕನ್ನಡ)",
            "ml": "Malayalam (മലയാളം)",
            "pa": "Punjabi (ਪੰਜਾਬੀ)",
            "or": "Odia (ଓଡ଼ିଆ)",
            "ur": "Urdu (اردو)",
            "as": "Assamese (অসমীয়া)",
            "ne": "Nepali (नेपाली)",
        }
        lang_label = lang_names.get(config.language, config.language or "English")
        if config.language == "hi":
            system_prompt += (
                "\n5. भाषा निर्देश: "
                "आपको पूरी बातचीत केवल और केवल 100% शुद्ध और स्वाभाविक हिंदी में करनी है। "
                "अंग्रेजी शब्दों का मिश्रण (Hinglish) या अंग्रेजी वाक्य न बोलें। "
                "चाहे उपयोगकर्ता अंग्रेजी में बोले या नीचे दी गई संदर्भ सामग्री अंग्रेजी में हो, "
                "आपको उसका उत्तर केवल शुद्ध, सरल और सहज हिंदी में ही 1-2 वाक्यों में देना है।"
            )
        elif config.language == "hi-en":
            system_prompt += (
                "\n5. Language Directive (Hinglish): "
                "Please converse in natural, bilingual Hinglish (a warm, polite conversational mix of Hindi and English) "
                "as spoken in everyday Indian phone calls."
            )
        else:
            system_prompt += (
                f"\n5. Language: You must strictly communicate, understand, and converse in {lang_label} ({config.language}). "
                f"All spoken replies must be delivered in fluent, natural {lang_label}. Keep answers concise (1-2 sentences)."
            )

        # RAG Grounding: Query Qdrant vector database for relevant store/agent knowledge
        try:
            from app.services.knowledge_service import default_knowledge_service
            rag_results = await default_knowledge_service.query_knowledge(
                agent_id=agent_id,
                owner_id=owner_id,
                query=message,
                top_k=2,
                threshold=0.25,
            )
            if rag_results and rag_results.results:
                rag_snippets = [r.text.strip() for r in rag_results.results if r.text]
                if rag_snippets:
                    system_prompt += (
                        "\n\nFACTUAL KNOWLEDGE BASE CONTEXT (Use this factual data to answer store inquiries, translating completely into pure Hindi if responding in Hindi):\n"
                        + "\n---\n".join(rag_snippets)
                    )
        except Exception as e:
            logger.warning("RAG context retrieval notice: %s", e)

        messages: List[Dict[str, str]] = [{"role": "system", "content": system_prompt}]
        if history:
            for turn in history[-6:]:
                role = "assistant" if turn.get("role") in ("agent", "assistant") else "user"
                content = turn.get("content") or turn.get("message") or ""
                if content:
                    messages.append({"role": role, "content": content})

        messages.append({"role": "user", "content": message})

        start_time = time.perf_counter()
        reply: Optional[str] = None
        try:
            client = self.llm_client._get_client()
            res = await client.chat.completions.create(
                model=self.llm_client.model or "openai/gpt-oss-120b",
                messages=messages,
                max_tokens=600,
                temperature=0.6,
            )
            msg = res.choices[0].message
            reply = (msg.content or "").strip()
        except Exception as err:
            logger.error("chat_with_agent LLM error: %s", err)

        if not reply:
            reply = config.welcome_message or "I am listening, how can I assist you today?"

        latency_ms = max(180, round((time.perf_counter() - start_time) * 1000))
        return {
            "reply": reply.strip(),
            "latency_ms": latency_ms,
            "agent_id": agent_id,
        }

    async def transcribe_voice(self, audio_bytes: bytes, filename: str = "audio.webm") -> str:
        """Transcribe audio bytes using Groq Whisper Large v3 Turbo."""
        try:
            client = self.llm_client._get_client()
            res = await client.audio.transcriptions.create(
                file=(filename, audio_bytes),
                model="whisper-large-v3-turbo",
            )
            return res.text.strip()
        except Exception:
            return ""

    async def synthesize_voice(
        self, agent_id: str, text: str, owner_id: str = "default_owner"
    ) -> bytes:
        """Synthesize agent text into realistic ElevenLabs neural audio."""
        agent = await self.get_agent(agent_id, owner_id=owner_id)
        config = agent.configuration
        voice_id = getattr(config, "voice_id", None) or "EXAVITQu4vr4xnSDxMaL"
        return await self.elevenlabs_client.text_to_speech(text=text, voice_id=voice_id)

    def _to_response(self, doc: Dict[str, Any]) -> AgentResponse:
        prov_id = doc.get("provider_agent_id") or doc.get("elevenlabs_agent_id")
        return AgentResponse(
            id=doc["id"],
            owner_id=doc["owner_id"],
            name=doc["name"],
            description=doc.get("description", ""),
            use_case=doc["use_case"],
            status=doc.get("status", AgentStatusEnum.DRAFT.value),
            provider=doc.get("provider", "elevenlabs"),
            provider_agent_id=prov_id,
            elevenlabs_agent_id=prov_id,
            current_version=doc.get("current_version", 1),
            configuration=AgentConfiguration.model_validate(doc["configuration"]),
            created_at=doc["created_at"],
            updated_at=doc["updated_at"],
            published_at=doc.get("published_at"),
        )


default_agent_service = AgentService()
