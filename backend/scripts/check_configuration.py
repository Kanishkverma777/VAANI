import asyncio
import pathlib
import sys

# Ensure project root is in sys.path
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from app.config import settings


def mask_secret(secret: str | None) -> str:
    if not secret:
        return "[NOT CONFIGURED]"
    if len(secret) <= 8:
        return "****"
    return f"{secret[:4]}...{secret[-4:]}"


async def check_all() -> int:
    print("=" * 65)
    print("  VoiceForge AI - System Configuration Diagnostic Tool")
    print("=" * 65)
    print(f"  Environment:   {settings.app_env}")
    print(f"  Debug Mode:    {settings.debug}")
    print(f"  API Prefix:    {settings.api_v1_prefix}")
    print("-" * 65)

    # 1. Secret Key
    if settings.auth_secret_key.startswith("development-secret-key"):
        print("  [!] AUTH_SECRET_KEY: Using default development secret (change for production)")
    else:
        print("  [✓] AUTH_SECRET_KEY: Configured securely")

    # 2. MongoDB
    print(f"  [*] MongoDB URI: {settings.mongodb_uri}")
    print(f"  [*] MongoDB DB:  {settings.mongodb_database}")
    try:
        from pymongo import AsyncMongoClient

        client = AsyncMongoClient(
            settings.mongodb_uri,
            serverSelectionTimeoutMS=3000,
        )
        try:
            db = client.get_default_database(default=settings.mongodb_database)
        except Exception:
            db = client[settings.mongodb_database]
        await db.command("ping")
        print("  [✓] MongoDB Connection: SUCCESSFUL (Ping verified)")
    except Exception as exc:
        print(f"  [✗] MongoDB Connection: FAILED ({str(exc)})")
        print("      Note: Live persistence requires a running MongoDB instance.")

    # 3. Groq LLM
    print("-" * 65)
    print(f"  [*] Groq Model:   {settings.groq_model}")
    print(f"  [*] Groq API Key: {mask_secret(settings.groq_api_key)}")
    if settings.has_groq:
        print("  [✓] Groq Provider: Key detected. Prompt generation and refinement enabled.")
    else:
        print("  [!] Groq Provider: Key NOT set. Generation/refinement will require GROQ_API_KEY.")

    # 4. ElevenLabs
    print("-" * 65)
    print(f"  [*] ElevenLabs Base:    {settings.elevenlabs_base_url}")
    print(f"  [*] ElevenLabs API Key: {mask_secret(settings.elevenlabs_api_key)}")
    if settings.has_elevenlabs:
        print("  [✓] ElevenLabs Provider: Key detected. Voice agent creation and sync enabled.")
    else:
        print(
            "  [!] ElevenLabs Provider: Key NOT set. Live Conversational AI requires ELEVENLABS_API_KEY."
        )

    # 5. Qdrant
    print("-" * 65)
    print(f"  [*] Qdrant URL:        {settings.qdrant_url}")
    print(f"  [*] Qdrant Collection: {settings.qdrant_collection}")
    print(f"  [*] Embedding Model:   {settings.embedding_model}")
    if settings.has_qdrant:
        print("  [✓] Qdrant Configuration: Configured.")
    else:
        print("  [!] Qdrant: Not configured. Falling back to in-memory vector indexing.")

    print("=" * 65)
    print("  Diagnostic check completed.")
    print("=" * 65)
    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(check_all())
    sys.exit(exit_code)
