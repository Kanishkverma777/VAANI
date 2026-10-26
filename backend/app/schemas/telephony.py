from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class OutboundCallRequest(BaseModel):
    to_number: str = Field(
        ...,
        description="Destination real phone number in international E.164 format (e.g. +91 98765 43210 or +1 555 123 4567)",
        json_schema_extra={"example": "+15551234567"},
    )
    from_number: Optional[str] = Field(
        None,
        description="Optional registered caller ID to display on recipient's phone",
        json_schema_extra={"example": "+15559876543"},
    )


class OutboundCallResponse(BaseModel):
    success: bool
    status: str
    to_number: str
    provider: str
    message: str
    call_id: Optional[str] = None
    requires_setup: bool = False
    setup_guide: Optional[Dict[str, Any]] = None
    details: Optional[Dict[str, Any]] = None


class TelephonyStatusResponse(BaseModel):
    has_twilio: bool
    twilio_phone_number: Optional[str] = None
    registered_numbers_count: int = 0
    available_providers: list[str] = []
    ready_for_real_calls: bool
