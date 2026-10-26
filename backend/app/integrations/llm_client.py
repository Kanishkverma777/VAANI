import json
import re
from typing import Any, Dict, List, Optional

from groq import APIConnectionError, APIStatusError, AsyncGroq, RateLimitError

from app.config import settings
from app.core.exceptions import (
    ConfigurationException,
    ProviderException,
    RateLimitException,
    ValidationException,
)
from app.core.logging import logger


def _strip_markdown_json(raw_text: str) -> str:
    """Strip markdown code fence blocks if returned by the LLM."""
    text = raw_text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if match:
        return match.group(1).strip()
    return text


class LLMClient:
    """Groq Async Client wrapper for structured AI generation."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or settings.groq_api_key
        self.model = model or settings.groq_model
        self._client: Optional[AsyncGroq] = None

    def _get_client(self) -> AsyncGroq:
        if not self.api_key:
            raise ConfigurationException(
                "Groq API key is not configured. Please set the GROQ_API_KEY environment variable.",
                code="MISSING_GROQ_API_KEY",
            )
        if self._client is None:
            self._client = AsyncGroq(api_key=self.api_key, timeout=45.0)
        return self._client

    async def generate_structured_json(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
        max_tokens: int = 2048,
    ) -> Dict[str, Any]:
        """Generate validated JSON output from the LLM."""
        client = self._get_client()

        messages: List[Dict[str, str]] = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        try:
            logger.info("Calling Groq LLM (model=%s) for structured generation...", self.model)
            response = await client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                response_format={"type": "json_object"},
            )

            choice = response.choices[0]
            content = choice.message.content or ""
            cleaned = _strip_markdown_json(content)

            try:
                parsed_json = json.loads(cleaned)
                return parsed_json
            except json.JSONDecodeError as err:
                logger.error(
                    "Failed to parse LLM JSON response: %s. Raw content: %s", str(err), cleaned
                )
                raise ValidationException(
                    "The AI model returned an unparseable JSON response. Please retry.",
                    code="MALFORMED_LLM_OUTPUT",
                    details={"raw_snippet": cleaned[:200]},
                )

        except RateLimitError as err:
            logger.warning("Groq rate limit exceeded: %s", str(err))
            raise RateLimitException(
                "Groq API rate limit exceeded. Please wait a moment and retry."
            )
        except APIConnectionError as err:
            logger.error("Failed to connect to Groq API: %s", str(err))
            raise ProviderException(
                "Failed to communicate with Groq LLM provider. Connection timeout or network error.",
                code="GROQ_CONNECTION_ERROR",
            )
        except APIStatusError as err:
            logger.error("Groq API error status %s: %s", err.status_code, err.message)
            raise ProviderException(
                f"Groq API error: {err.message}",
                code="GROQ_API_ERROR",
                status_code=err.status_code
                if err.status_code in [400, 401, 403, 404, 429]
                else 502,
            )
        except (ValidationException, ConfigurationException, RateLimitException, ProviderException):
            raise
        except Exception as exc:
            logger.exception("Unexpected error during LLM generation: %s", str(exc))
            raise ProviderException(
                "An unexpected error occurred while generating agent specification.",
                code="LLM_EXECUTION_ERROR",
            )

    async def generate_text(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 250,
        retries: int = 3,
    ) -> str:
        """Generate concise, natural text/speech response from Groq LLM with retries."""
        import asyncio
        client = self._get_client()
        messages: List[Dict[str, str]] = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        for attempt in range(retries):
            try:
                response = await client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                return (response.choices[0].message.content or "").strip()
            except RateLimitError:
                if attempt < retries - 1:
                    await asyncio.sleep(1.0 * (attempt + 1))
                    continue
            except Exception as exc:
                logger.warning("Groq text generation error (attempt %d/%d): %s", attempt + 1, retries, exc)
                if attempt < retries - 1:
                    await asyncio.sleep(0.5)
                    continue
        return ""


default_llm_client = LLMClient()
