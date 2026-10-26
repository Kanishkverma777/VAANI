from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ConversationAccessResponse(BaseModel):
    agent_id: str
    provider_agent_id: str
    signed_url: str
    session_format: str = "webrtc_signed_url"
    instructions: str = Field(
        default="Use the official ElevenLabs Conversational AI SDK or WebRTC/WebSocket to connect to the signed URL."
    )


class SessionTranscriptItem(BaseModel):
    role: str
    message: str
    time_in_call_secs: Optional[float] = None


class SessionDetailResponse(BaseModel):
    id: str
    agent_id: str
    owner_id: str
    provider_conversation_id: str
    started_at: Optional[str] = None
    ended_at: Optional[str] = None
    duration_seconds: Optional[float] = None
    status: str
    transcript: List[Dict[str, Any]] = Field(default_factory=list)
    summary: Optional[str] = None
    outcome: Optional[str] = None
    latency_metrics: Optional[Dict[str, Any]] = None
    flagged: bool = False
    created_at: str
