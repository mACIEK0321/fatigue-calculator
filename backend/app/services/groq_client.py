"""Async Groq adapter for optional fatigue comparison responses."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass

import httpx
from pydantic import ValidationError

from app.core.config import Settings
from app.models.schemas import AIComparisonErrorCode, AIComparisonResult
from app.services.groq_prompt import (
    GROQ_RESPONSE_JSON_SCHEMA,
    GROQ_SYSTEM_PROMPT,
    build_groq_user_prompt,
)

logger = logging.getLogger(__name__)

_STRICT_JSON_SCHEMA_MODELS = {
    "openai/gpt-oss-20b",
    "openai/gpt-oss-120b",
}


@dataclass(frozen=True)
class GroqClientError(Exception):
    code: AIComparisonErrorCode
    message: str
    retriable: bool = False

    def __str__(self) -> str:
        return self.message


class GroqClient:
    """Thin OpenAI-compatible client for Groq chat completions."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    @property
    def is_configured(self) -> bool:
        return bool(self._settings.GROQ_API_KEY)

    def build_chat_payload(self, comparison_input: dict) -> dict:
        strict_mode = self._settings.GROQ_MODEL in _STRICT_JSON_SCHEMA_MODELS
        return {
            "model": self._settings.GROQ_MODEL,
            "temperature": 0.1,
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": "fatigue_ai_comparison",
                    "strict": strict_mode,
                    "schema": GROQ_RESPONSE_JSON_SCHEMA,
                },
            },
            "messages": [
                {"role": "system", "content": GROQ_SYSTEM_PROMPT},
                {"role": "user", "content": build_groq_user_prompt(comparison_input)},
            ],
        }

    async def compare_fatigue_analysis(self, comparison_input: dict) -> AIComparisonResult:
        if not self.is_configured:
            raise GroqClientError(
                code=AIComparisonErrorCode.not_configured,
                message="AI comparison is not configured on the backend.",
                retriable=False,
            )

        payload = self.build_chat_payload(comparison_input)
        endpoint = f"{self._settings.GROQ_BASE_URL.rstrip('/')}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self._settings.GROQ_API_KEY}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=self._settings.GROQ_TIMEOUT_SECONDS) as client:
                response = await client.post(endpoint, json=payload, headers=headers)
                response.raise_for_status()
        except httpx.TimeoutException as exc:
            raise GroqClientError(
                code=AIComparisonErrorCode.timeout,
                message="AI comparison timed out before a valid response arrived.",
                retriable=True,
            ) from exc
        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code
            error_message = self._extract_error_message(exc.response)
            logger.warning("Groq HTTP error status=%s", status_code)
            raise GroqClientError(
                code=AIComparisonErrorCode.http_error,
                message=(
                    f"AI comparison failed with HTTP {status_code}: {error_message}"
                    if error_message
                    else f"AI comparison failed with HTTP {status_code}."
                ),
                retriable=status_code >= 500,
            ) from exc
        except httpx.HTTPError as exc:
            raise GroqClientError(
                code=AIComparisonErrorCode.http_error,
                message="AI comparison failed due to a network error.",
                retriable=True,
            ) from exc

        try:
            response_payload = response.json()
        except json.JSONDecodeError as exc:
            raise GroqClientError(
                code=AIComparisonErrorCode.invalid_json,
                message="The AI provider returned a non-JSON HTTP payload.",
                retriable=False,
            ) from exc

        content = self._extract_message_content(response_payload)
        try:
            parsed_content = json.loads(content)
        except json.JSONDecodeError as exc:
            raise GroqClientError(
                code=AIComparisonErrorCode.invalid_json,
                message="The AI provider returned message content that was not valid JSON.",
                retriable=False,
            ) from exc

        try:
            return AIComparisonResult.model_validate(parsed_content)
        except ValidationError as exc:
            logger.warning("Groq schema validation failed: %s", exc)
            raise GroqClientError(
                code=AIComparisonErrorCode.schema_validation,
                message="The AI provider returned JSON that did not match the expected schema.",
                retriable=False,
            ) from exc

    def _extract_message_content(self, response_payload: dict) -> str:
        try:
            choices = response_payload["choices"]
            message = choices[0]["message"]
            content = message["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise GroqClientError(
                code=AIComparisonErrorCode.empty_response,
                message="The AI provider returned no usable message content.",
                retriable=False,
            ) from exc

        refusal = message.get("refusal") if isinstance(message, dict) else None
        if isinstance(refusal, str) and refusal.strip():
            raise GroqClientError(
                code=AIComparisonErrorCode.empty_response,
                message=f"The AI provider refused the comparison request: {refusal.strip()}",
                retriable=False,
            )

        if isinstance(content, list):
            text_fragments = []
            for item in content:
                if isinstance(item, dict) and item.get("type") == "text":
                    text_value = item.get("text")
                    if isinstance(text_value, str):
                        text_fragments.append(text_value)
            content = "".join(text_fragments)

        if not isinstance(content, str) or not content.strip():
            raise GroqClientError(
                code=AIComparisonErrorCode.empty_response,
                message="The AI provider returned an empty completion message.",
                retriable=False,
            )

        return content.strip()

    def _extract_error_message(self, response: httpx.Response) -> str | None:
        try:
            payload = response.json()
        except Exception:
            return None

        error_payload = payload.get("error")
        if isinstance(error_payload, dict):
            message = error_payload.get("message")
            if isinstance(message, str) and message.strip():
                return message.strip()

        detail = payload.get("detail")
        if isinstance(detail, str) and detail.strip():
            return detail.strip()

        return None
