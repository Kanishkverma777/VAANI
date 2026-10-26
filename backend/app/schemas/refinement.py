from typing import Any, Dict, Optional

from pydantic import BaseModel, Field

from app.schemas.agent import AgentConfiguration


class RefineAgentRequest(BaseModel):
    instruction: str = Field(
        ...,
        min_length=3,
        max_length=2000,
        description="Natural language instruction describing desired changes to the agent.",
        examples=["Make the greeting shorter, use a warmer tone, and add Spanish support."],
    )
    configuration_version: Optional[int] = Field(
        default=None,
        description="Optional version number for optimistic concurrency conflict detection.",
    )


class RefineAgentResponse(BaseModel):
    agent_id: str
    previous_version: int
    current_version: int
    configuration: AgentConfiguration
    change_summary: str
    diff: Dict[str, Any] = Field(default_factory=dict)
