import json
from typing import Optional

from pydantic import ValidationError

from app.core.exceptions import ValidationException
from app.core.logging import logger
from app.integrations.llm_client import LLMClient, default_llm_client
from app.schemas.agent import AgentConfiguration
from app.schemas.generation import GenerateAgentRequest, GenerateAgentResponse

GENERATION_SYSTEM_PROMPT = """You are an expert Voice AI Architect for VAANI.
Your task is to take a natural-language description of a voice agent and generate a comprehensive, structured internal agent specification.

STRICT RULES:
1. Generate valid JSON ONLY that conforms directly to the required schema. Never return code, markdown explanations, or commentary outside the JSON object.
2. Voice AI conversational agents speak live out loud. Write instructions, welcome messages, and flow steps that sound warm, human, natural, and spoken (1-2 sentences at a time). Never use bullet points, markdown symbols, or robotic AI disclaimers so conversations flow smoothly without clutter.
3. Guardrails:
   - Prohibit topics outside the agent's domain.
   - Do not invent real personal, financial, or proprietary business data.
   - For unknown inquiries, provide a polite fallback acknowledging limitation.
   - Define sensible conversation flow with clear, goal-oriented steps.
4. Avoid promising capabilities that require unconfigured third-party integrations (e.g. do not promise live credit card processing unless a dedicated tool is provided).
5. Output MUST match this JSON structure:
{
  "name": "Short Descriptive Name",
  "description": "Clear summary of what this voice agent does",
  "purpose": "Primary objective of the agent",
  "use_case": "<one of: appointments, customer_support, lead_generation, education, restaurant, recruitment, collections, custom>",
  "personality": {
    "tone": "e.g., friendly and professional",
    "speaking_style": "e.g., natural, conversational, polite, concise",
    "pace": "normal",
    "traits": ["empathetic", "helpful", "patient"]
  },
  "instructions": "Detailed prompt instructions guiding how the agent must converse, handle edge cases, and maintain safety.",
  "welcome_message": "Opening greeting spoken by the agent when the call starts.",
  "language": "en",
  "additional_languages": [],
  "voice_id": "EXAVITQu4vr4xnSDxMaL",
  "conversation_flow": {
    "steps": [
      {
        "step_id": "greeting",
        "title": "Welcome and Identify Need",
        "goal": "Greet the caller and ask how we can assist them today.",
        "example_phrases": ["Hello! How can I help you today?"],
        "fallback": "Apologize and ask the caller to repeat their request."
      }
    ],
    "fallback_policy": "Acknowledge the ambiguity and ask clarifying questions."
  },
  "guardrails": {
    "prohibited_topics": ["medical advice", "financial speculation", "political opinions"],
    "max_turn_count": 30,
    "fallback_message": "I apologize, but I am unable to assist with that topic. Is there anything else related to our services I can help with?",
    "data_privacy_rules": [
      "Do not ask for credit card numbers or passwords.",
      "Safeguard caller privacy."
    ]
  },
  "tools": [],
  "knowledge_settings": {
    "rag_enabled": false,
    "top_k": 3,
    "confidence_threshold": 0.6,
    "source_identifiers": []
  },
  "escalation_settings": {
    "human_handoff_enabled": true,
    "escalation_contact": null,
    "trigger_phrases": ["speak to human", "talk to representative", "agent"],
    "escalation_message": "I understand. Let me transfer you to a human team member. Please stay on the line."
  }
}
"""


class GenerationService:
    def __init__(self, llm_client: Optional[LLMClient] = None):
        self.llm_client = llm_client or default_llm_client

    async def generate_agent_config(self, request: GenerateAgentRequest) -> GenerateAgentResponse:
        """Process user prompt and generate validated AgentConfiguration."""
        user_prompt_data = {
            "description": request.description,
            "use_case": request.use_case.value,
            "preferred_language": request.preferred_language,
            "additional_requirements": request.additional_requirements,
            "preferred_voice_id": request.preferred_voice_id,
        }

        user_prompt = (
            "Generate an internal VAANI agent configuration for the following request:\n"
            f"{json.dumps(user_prompt_data, indent=2)}\n\n"
            "Ensure the output conforms exactly to the JSON schema."
        )

        raw_json = await self.llm_client.generate_structured_json(
            system_prompt=GENERATION_SYSTEM_PROMPT,
            user_prompt=user_prompt,
        )

        # Apply voice override if user specified preferred_voice_id
        if request.preferred_voice_id and "voice_id" in raw_json:
            raw_json["voice_id"] = request.preferred_voice_id

        # Enforce preferred language if user explicitly selected one
        if request.preferred_language:
            raw_json["language"] = request.preferred_language

        # Validate with Pydantic
        try:
            config = AgentConfiguration.model_validate(raw_json)
        except ValidationError as err:
            logger.error("Generated configuration failed schema validation: %s", str(err))
            raise ValidationException(
                "AI generation produced an invalid configuration structure. Please refine your description and retry.",
                code="INVALID_GENERATED_SCHEMA",
                details=err.errors(),
            )

        warnings = []
        if not config.guardrails.prohibited_topics:
            warnings.append("Guardrails have no prohibited topics configured.")

        summary = (
            f"Successfully generated voice agent configuration '{config.name}' "
            f"tailored for the {config.use_case.value} domain."
        )

        return GenerateAgentResponse(
            configuration=config,
            generation_summary=summary,
            warnings=warnings,
        )


default_generation_service = GenerationService()
