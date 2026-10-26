from typing import List, Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Core Application
    app_name: str = Field(default="VAANI Backend", alias="APP_NAME")
    app_env: str = Field(default="development", alias="APP_ENV")
    debug: bool = Field(default=False, alias="DEBUG")
    api_v1_prefix: str = Field(default="/api/v1", alias="API_V1_PREFIX")
    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8000, alias="PORT")

    # Security
    auth_secret_key: str = Field(
        default="development-secret-key-32-bytes-minimum-length-voiceforge",
        alias="AUTH_SECRET_KEY",
    )
    access_token_expire_minutes: int = Field(default=1440, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    allowed_origins_raw: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000",
        alias="ALLOWED_ORIGINS",
    )

    # MongoDB
    mongodb_uri: str = Field(default="mongodb://localhost:27017", alias="MONGODB_URI")
    mongodb_database: str = Field(default="voiceforge", alias="MONGODB_DATABASE")
    mongodb_server_selection_timeout_ms: int = Field(
        default=3000, alias="MONGODB_SERVER_SELECTION_TIMEOUT_MS"
    )

    # Groq LLM
    groq_api_key: Optional[str] = Field(default=None, alias="GROQ_API_KEY")
    groq_model: str = Field(default="qwen/qwen3.8-27b", alias="GROQ_MODEL")

    # ElevenLabs
    elevenlabs_api_key: Optional[str] = Field(default=None, alias="ELEVENLABS_API_KEY")
    elevenlabs_base_url: str = Field(
        default="https://api.elevenlabs.io", alias="ELEVENLABS_BASE_URL"
    )

    # Qdrant Vector Storage
    qdrant_url: Optional[str] = Field(default="http://localhost:6333", alias="QDRANT_URL")
    qdrant_api_key: Optional[str] = Field(default=None, alias="QDRANT_API_KEY")
    qdrant_collection: str = Field(default="voiceforge_knowledge", alias="QDRANT_COLLECTION")
    embedding_model: str = Field(
        default="sentence-transformers/all-MiniLM-L6-v2", alias="EMBEDDING_MODEL"
    )
    embedding_dimension: int = Field(default=384, alias="EMBEDDING_DIMENSION")

    # Limits
    max_upload_size_mb: int = Field(default=10, alias="MAX_UPLOAD_SIZE_MB")
    max_prompt_length: int = Field(default=5000, alias="MAX_PROMPT_LENGTH")

    # Telephony (Twilio / Carrier SIP)
    twilio_account_sid: Optional[str] = Field(default=None, alias="TWILIO_ACCOUNT_SID")
    twilio_auth_token: Optional[str] = Field(default=None, alias="TWILIO_AUTH_TOKEN")
    twilio_phone_number: Optional[str] = Field(default=None, alias="TWILIO_PHONE_NUMBER")

    @property
    def allowed_origins(self) -> List[str]:
        return [origin.strip() for origin in self.allowed_origins_raw.split(",") if origin.strip()]

    @property
    def has_groq(self) -> bool:
        return bool(self.groq_api_key and self.groq_api_key.strip())

    @property
    def has_elevenlabs(self) -> bool:
        return bool(self.elevenlabs_api_key and self.elevenlabs_api_key.strip())

    @property
    def has_qdrant(self) -> bool:
        return bool(self.qdrant_url and self.qdrant_url.strip())

    @property
    def has_twilio(self) -> bool:
        return bool(
            self.twilio_account_sid
            and self.twilio_account_sid.strip()
            and self.twilio_auth_token
            and self.twilio_auth_token.strip()
            and self.twilio_phone_number
            and self.twilio_phone_number.strip()
        )


settings = Settings()
