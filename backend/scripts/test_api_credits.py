import asyncio
import pathlib
import sys
import httpx

# Ensure project root is in sys.path
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from app.config import settings
from groq import AsyncGroq


async def main():
    print("=" * 60)
    print("  VAANI - API Key & Credit Diagnostic Checker")
    print("=" * 60)

    # 1. ElevenLabs Check
    print("\n[1/2] Checking ElevenLabs API Key...")
    if not settings.elevenlabs_api_key:
        print("  ✗ ELEVENLABS_API_KEY is not set in backend/.env")
    else:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.get(
                    f"{settings.elevenlabs_base_url}/v1/user/subscription",
                    headers={"xi-api-key": settings.elevenlabs_api_key.strip()},
                )
                if r.status_code == 200:
                    data = r.json()
                    used = data.get("character_count", 0)
                    limit = data.get("character_limit", 0)
                    remaining = max(0, limit - used)
                    tier = data.get("tier", "unknown")
                    status = data.get("status", "unknown")
                    print(f"  ✓ ElevenLabs Key: VALID!")
                    print(f"    - Tier:            {tier}")
                    print(f"    - Status:          {status}")
                    print(f"    - Characters Used: {used:,} / {limit:,}")
                    print(f"    - Remaining:       {remaining:,} characters")
                    if remaining <= 1000:
                        print("    ⚠️ WARNING: Low character balance remaining!")
                    else:
                        print("    ✓ Credits healthy and ready for voice synthesis.")
                elif r.status_code == 401:
                    print("  ✗ ElevenLabs Error: 401 Unauthorized (Invalid API Key)")
                else:
                    print(f"  ✗ ElevenLabs Error ({r.status_code}): {r.text[:200]}")
        except Exception as exc:
            print(f"  ✗ ElevenLabs Connection Failed: {exc}")

    # 2. Groq LLM Check
    print("\n[2/2] Checking Groq LLM API Key...")
    if not settings.groq_api_key:
        print("  ✗ GROQ_API_KEY is not set in backend/.env")
    else:
        try:
            client = AsyncGroq(api_key=settings.groq_api_key.strip())
            resp = await client.chat.completions.create(
                messages=[{"role": "user", "content": "Respond with 'OK'"}],
                model=settings.groq_model,
                max_tokens=10,
            )
            content = resp.choices[0].message.content.strip()
            print(f"  ✓ Groq Key: VALID!")
            print(f"    - Model:           {settings.groq_model}")
            print(f"    - Test Response:   {content}")
            print("    ✓ LLM prompt generation is fully active.")
        except Exception as exc:
            print(f"  ✗ Groq Error: {exc}")

    print("\n" + "=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
