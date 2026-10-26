from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class VoiceModel(BaseModel):
    voice_id: str
    name: str
    category: Optional[str] = None
    description: Optional[str] = None
    preview_url: Optional[str] = None
    labels: Dict[str, str] = Field(default_factory=dict)


class VoiceListResponse(BaseModel):
    voices: List[VoiceModel]
    total: int
