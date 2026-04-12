"""Async DeepSeek adapter for optional fatigue comparison responses."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass

import httpx
from pydantic import ValidationError

from app.core.config import Settings
from app.models.schemas import (
    AIComparisonErrorCode,
    AIComparisonResult,
)
from app.services.deepseek_prompt import (
    DEEPSEEK_SYSTEM_PROMPT,
    build_deepseek_user_prompt,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class DeepSeekClientError(Exception):
    code: AIComparisonErrorCode
    message: str
    retriable: bool = False

    def __str__(self) -> str:
        return self.message


class DeepSeekClient:
    """Thin OpenAI-compatible client for DeepSeek chat completions."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    @property
    def is_configured(self) -> bool:
        return bool(self._settings.DEEPSEEK_API_KEY)

    def build_chat_payload(self, comparison_input: dict) -> dict:
        return {
            "model": self._settings.DEEPSEEK_MODEL,
            "temperature": 0.1,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": DEEPSEEK_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": build_deepseek_user_prompt(comparison_input),
                },
            ],
        }

    async def compare_fatigue_analysis(
        self,
        comparison_input: dict,
    ) -> AIComparisonResult:
        if not self.is_configured:
            raise DeepSeekClientError(
                code=AIComparisonErrorCode.not_configured,
                message="DeepSeek comparison is not configured on the backend.",
                retriable=False,
            )

        payload = self.build_chat_payload(comparison_input)
        endpoint = f"{self._settings.DEEPSEEK_BASE_URL.rstrip('/')}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self._settings.DEEPSEEK_API_KEY}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(
                timeout=self._settings.DEEPSEEK_TIMEOUT_SECONDS
            ) as client:
                response = await client.post(endpoint, json=payload, headers=headers)
                response.raise_for_status()
        except httpx.TimeoutException as exc:
            raise DeepSeekClientError(
                code=AIComparisonErrorCode.timeout,
                message="DeepSeek comparison timed out before a valid response arrived.",
                retriable=True,
            ) from exc
        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code
            logger.warning("DeepSeek HTTP error status=%s", status_code)
            raise DeepSeekClientError(
                code=AIComparisonErrorCode.http_error,
                message=f"DeepSeek comparison failed with HTTP {status_code}.",
                retriable=status_code >= 500,
            ) from exc
        except httpx.HTTPError as exc:
            raise DeepSeekClientError(
                code=AIComparisonErrorCode.http_error,
                message="DeepSeek comparison failed due to a network error.",
                retriable=True,
            ) from exc

        try:
            response_payload = response.json()
        except json.JSONDecodeError as exc:
            raise DeepSeekClientError(
                code=AIComparisonErrorCode.invalid_json,
                message="DeepSeek returned a non-JSON HTTP payload.",
                retriable=False,
            ) from exc

        content = self._extract_message_content(response_payload)
        try:
            parsed_content = json.loads(content)
        except json.JSONDecodeError as exc:
            raise DeepSeekClientError(
                code=AIComparisonErrorCode.invalid_json,
                message="DeepSeek returned message content that was not valid JSON.",
                retriable=False,
            ) from exc

        try:
            return AIComparisonResult.model_validate(parsed_content)
        except ValidationError as exc:
            logger.warning("DeepSeek schema validation failed: %s", exc)
            raise DeepSeekClientError(
                code=AIComparisonErrorCode.schema_validation,
                message="DeepSeek returned JSON that did not match the expected schema.",
                retriable=False,
            ) from exc

    def _extract_message_content(self, response_payload: dict) -> str:
        try:
            choices = response_payload["choices"]
            message = choices[0]["message"]
            content = message["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise DeepSeekClientError(
                code=AIComparisonErrorCode.empty_response,
                message="DeepSeek returned no usable message content.",
                retriable=False,
            ) from exc

        if isinstance(content, list):
            text_fragments = []
            for item in content:
                if isinstance(item, dict) and item.get("type") == "text":
                    text_value = item.get("text")
                    if isinstance(text_value, str):
                        text_fragments.append(text_value)
            content = "".join(text_fragments)

        if not isinstance(content, str) or not content.strip():
            raise DeepSeekClientError(
                code=AIComparisonErrorCode.empty_response,
                message="DeepSeek returned an empty completion message.",
                retriable=False,
            )

        return content.strip()
