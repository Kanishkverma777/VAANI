from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class UseCaseEnum(str, Enum):
    APPOINTMENTS = "appointments"
    CUSTOMER_SUPPORT = "customer_support"
    LEAD_GENERATION = "lead_generation"
    EDUCATION = "education"
    RESTAURANT = "restaurant"
    RECRUITMENT = "recruitment"
    COLLECTIONS = "collections"
    NEGOTIATION = "negotiation"
    CUSTOM = "custom"


class AgentStatusEnum(str, Enum):
    DRAFT = "draft"
    CONFIGURED = "configured"
    PROVISIONING = "provisioning"
    ACTIVE = "active"
    DEPLOYMENT_FAILED = "deployment_failed"
    ARCHIVED = "archived"


class Personality(BaseModel):
    tone: str = Field(default="professional and friendly", max_length=150)
    speaking_style: str = Field(default="concise, polite, and natural", max_length=200)
    pace: str = Field(default="normal", max_length=50)
    traits: List[str] = Field(default_factory=lambda: ["empathetic", "helpful", "clear"])


class ConversationFlowStep(BaseModel):
    step_id: str = Field(..., max_length=50)
    title: str = Field(..., max_length=100)
    goal: str = Field(..., max_length=250)
    example_phrases: List[str] = Field(default_factory=list)
    fallback: Optional[str] = Field(default=None, max_length=200)


class ConversationFlow(BaseModel):
    steps: List[ConversationFlowStep] = Field(default_factory=list)
    fallback_policy: str = Field(
        default="Politely ask the user to clarify if the intent is not recognized.",
        max_length=300,
    )


class Guardrails(BaseModel):
    prohibited_topics: List[str] = Field(
        default_factory=lambda: [
            "financial advice",
            "medical diagnosis",
            "legal counsel",
            "politics",
        ]
    )
    max_turn_count: int = Field(default=30, ge=1, le=100)
    fallback_message: str = Field(
        default="I am unable to answer questions regarding that topic. Let me know how else I can assist you with our services.",
        max_length=300,
    )
    data_privacy_rules: List[str] = Field(
        default_factory=lambda: [
            "Never request sensitive payment credentials or passwords over voice.",
            "Protect personal contact information.",
        ]
    )


class ToolDefinition(BaseModel):
    name: str = Field(..., max_length=80)
    description: str = Field(..., max_length=300)
    parameters: dict = Field(default_factory=dict)
    enabled: bool = Field(default=True)


class KnowledgeSettings(BaseModel):
    rag_enabled: bool = Field(default=False)
    top_k: int = Field(default=3, ge=1, le=10)
    confidence_threshold: float = Field(default=0.6, ge=0.0, le=1.0)
    source_identifiers: List[str] = Field(default_factory=list)


class EscalationSettings(BaseModel):
    human_handoff_enabled: bool = Field(default=True)
    escalation_contact: Optional[str] = Field(default=None, max_length=150)
    trigger_phrases: List[str] = Field(
        default_factory=lambda: [
            "speak to a human",
            "talk to representative",
            "agent",
            "manager",
        ]
    )
    escalation_message: str = Field(
        default="I will connect you with a representative right away. Please hold.",
        max_length=250,
    )


class AgentConfiguration(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=1, max_length=500)
    purpose: str = Field(..., min_length=1, max_length=1000)
    use_case: UseCaseEnum
    personality: Personality = Field(default_factory=Personality)
    instructions: str = Field(..., min_length=10, max_length=5000)
    welcome_message: str = Field(..., min_length=1, max_length=500)
    language: str = Field(default="en", max_length=10)
    additional_languages: List[str] = Field(default_factory=list)
    voice_id: str = Field(default="hpp4J3VqNfWAUOO0d1Us", max_length=100)
    conversation_flow: ConversationFlow = Field(default_factory=ConversationFlow)
    guardrails: Guardrails = Field(default_factory=Guardrails)
    tools: List[ToolDefinition] = Field(default_factory=list)
    knowledge_settings: KnowledgeSettings = Field(default_factory=KnowledgeSettings)
    escalation_settings: EscalationSettings = Field(default_factory=EscalationSettings)


class AgentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(default="", max_length=500)
    use_case: UseCaseEnum
    configuration: AgentConfiguration


class AgentUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)
    use_case: Optional[UseCaseEnum] = None
    configuration: Optional[AgentConfiguration] = None
    change_description: Optional[str] = Field(default="Manual configuration update", max_length=300)


class AgentResponse(BaseModel):
    id: str
    owner_id: str
    name: str
    description: str
    use_case: UseCaseEnum
    status: AgentStatusEnum
    provider: str
    provider_agent_id: Optional[str] = None
    elevenlabs_agent_id: Optional[str] = None
    current_version: int
    configuration: AgentConfiguration
    created_at: str
    updated_at: str
    published_at: Optional[str] = None


class AgentChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000, description="User spoken or typed input text")
    history: List[Dict[str, str]] = Field(default_factory=list, description="Prior conversation dialogue turns")


class AgentChatResponse(BaseModel):
    reply: str
    latency_ms: int
    agent_id: str
    session_id: Optional[str] = None

