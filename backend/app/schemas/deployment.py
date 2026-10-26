from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class DeploymentStateEnum(str, Enum):
    PENDING = "pending"
    PROVISIONING = "provisioning"
    ACTIVE = "active"
    FAILED = "failed"


class PhoneDeploymentInfo(BaseModel):
    status: str = Field(
        default="simulated",
        description="Status of phone/telephony deployment. Clearly labelled as 'simulated' if live SIP/Twilio is not provisioned.",
    )
    is_simulated: bool = Field(
        default=True,
        description="Explicit flag indicating whether phone testing uses browser voice simulation vs live carrier PSTN.",
    )
    simulated_number: Optional[str] = Field(
        default="+1 (555) 019-VOICE",
        description="Virtual simulation number for browser sandbox testing.",
    )
    note: str = Field(
        default="Live carrier telephony requires dedicated SIP trunk or Twilio number credentials. Using browser voice simulation sandbox."
    )


class DeployAgentResponse(BaseModel):
    agent_id: str
    status: DeploymentStateEnum
    provider: str = "elevenlabs"
    provider_agent_id: Optional[str] = None
    elevenlabs_agent_id: Optional[str] = None
    version_deployed: int
    shareable_url: Optional[str] = None
    phone_deployment: PhoneDeploymentInfo = Field(default_factory=PhoneDeploymentInfo)
    deployed_at: str


class DeploymentStatusResponse(BaseModel):
    agent_id: str
    status: DeploymentStateEnum
    provider: str = "elevenlabs"
    provider_agent_id: Optional[str] = None
    elevenlabs_agent_id: Optional[str] = None
    version_deployed: int
    shareable_url: Optional[str] = None
    phone_deployment: PhoneDeploymentInfo = Field(default_factory=PhoneDeploymentInfo)
    last_deployed_at: Optional[str] = None
    error_message: Optional[str] = None
