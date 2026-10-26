from typing import Dict, Optional

from pydantic import BaseModel, Field


class AgentAnalyticsResponse(BaseModel):
    agent_id: str
    total_sessions: int = Field(
        default=0, description="Total number of recorded conversation sessions."
    )
    completed_sessions: int = Field(default=0, description="Sessions completed normally.")
    total_duration_seconds: float = Field(
        default=0.0, description="Total duration across all sessions."
    )
    average_duration_seconds: float = Field(
        default=0.0, description="Mean session duration in seconds."
    )
    outcomes_breakdown: Dict[str, int] = Field(
        default_factory=dict, description="Distribution of conversation outcomes."
    )
    average_latency_ms: Optional[float] = Field(
        default=None, description="Average measured turn latency in milliseconds if available."
    )
    flagged_sessions_count: int = Field(
        default=0, description="Count of sessions flagged for review."
    )
    calculated_at: str


class SyncSessionRequest(BaseModel):
    provider_conversation_id: str = Field(
        ..., description="ElevenLabs conversation ID to synchronize."
    )


class AnalyticsOverviewResponse(BaseModel):
    total_conversations: int = 0
    average_duration_seconds: int = 0
    total_duration_seconds: float = 0.0
    completion_rate_percent: float = 0.0
    resolution_rate_percent: float = 0.0
    average_latency_ms: int = 0
    active_agents_count: int = 0
    total_agents_count: int = 0

