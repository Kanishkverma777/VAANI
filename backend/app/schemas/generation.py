from typing import List, Optional

from pydantic import BaseModel, Field

from app.schemas.agent import AgentConfiguration, UseCaseEnum


class GenerateAgentRequest(BaseModel):
    description: str = Field(
        ...,
        min_length=10,
        max_length=5000,
        description="Natural language description of the voice AI agent and its desired behavior.",
    )
    use_case: UseCaseEnum = Field(
        ...,
        description="Target business domain or use case for the voice agent.",
    )
    preferred_language: str = Field(
        default="en",
        max_length=10,
        description="Primary spoken language ISO code (e.g. 'en', 'es', 'hi').",
    )
    additional_requirements: Optional[str] = Field(
        default=None,
        max_length=2000,
        description="Specific constraints, guardrails, or flow details.",
    )
    preferred_voice_id: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Optional preferred ElevenLabs voice ID.",
    )


class GenerateAgentResponse(BaseModel):
    configuration: AgentConfiguration
    generation_summary: str
    warnings: List[str] = Field(default_factory=list)
