"""Async Groq adapter for optional fatigue comparison responses."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass

import httpx
from pydantic import ValidationError

from app.core.config import Settings
from app.models.schemas import (
    AIComparisonErrorCode,
    AIComparisonMetadata,
    AIComparisonResult,
)
from app.services.groq_prompt import (
    GROQ_RESPONSE_JSON_SCHEMA,
    GROQ_SCHEMA_PROFILE,
    GroqResponseFormat,
    build_groq_system_prompt,
    build_groq_user_prompt,
    get_optional_top_level_fields,
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
    should_fallback: bool = False
    response_format: str | None = None
    attempted_response_formats: tuple[str, ...] = ()
    fallback_used: bool = False

    def __str__(self) -> str:
        return self.message


@dataclass(frozen=True)
class GroqComparisonResponse:
    result: AIComparisonResult
    metadata: AIComparisonMetadata


class GroqClient:
    """Thin OpenAI-compatible client for Groq chat completions."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    @property
    def is_configured(self) -> bool:
        return bool(self._settings.GROQ_API_KEY)

    def build_chat_payload(
        self,
        comparison_input: dict,
        *,
        response_format: GroqResponseFormat | None = None,
    ) -> dict:
        selected_response_format = response_format or self._resolve_response_formats()[0]
        payload = {
            "model": self._settings.GROQ_MODEL,
            "temperature": 0.1,
            "response_format": self._build_response_format_payload(selected_response_format),
            "messages": [
                {
                    "role": "system",
                    "content": build_groq_system_prompt(selected_response_format),
                },
                {
                    "role": "user",
                    "content": build_groq_user_prompt(
                        comparison_input,
                        response_format=selected_response_format,
                        model_name=self._settings.GROQ_MODEL,
                    ),
                },
            ],
        }
        return payload

    async def compare_fatigue_analysis(self, comparison_input: dict) -> GroqComparisonResponse:
        if not self.is_configured:
            raise GroqClientError(
                code=AIComparisonErrorCode.not_configured,
                message="AI comparison is not configured on the backend.",
                retriable=False,
            )

        response_formats = self._resolve_response_formats()
        attempted_response_formats: list[str] = []

        for index, response_format in enumerate(response_formats):
            attempted_response_formats.append(response_format)
            payload = self.build_chat_payload(
                comparison_input,
                response_format=response_format,
            )

            try:
                response_payload = await self._post_chat_completion(
                    payload,
                    response_format=response_format,
                )
                result, omitted_or_null_fields = self._validate_response_payload(
                    response_payload
                )
            except GroqClientError as exc:
                if (
                    self._should_try_fallback(exc, response_format, response_formats, index)
                ):
                    logger.info(
                        "Groq model=%s retrying response_format=%s -> json_object after code=%s",
                        self._settings.GROQ_MODEL,
                        response_format,
                        exc.code.value,
                    )
                    continue

                raise self._attach_attempt_diagnostics(
                    exc,
                    attempted_response_formats,
                    response_format=response_format,
                ) from exc

            return GroqComparisonResponse(
                result=result,
                metadata=self._build_metadata(
                    attempted_response_formats,
                    response_format=response_format,
                    omitted_or_null_fields=omitted_or_null_fields,
                ),
            )

        raise GroqClientError(
            code=AIComparisonErrorCode.unexpected_error,
            message="AI comparison failed before a final response format could be selected.",
            retriable=False,
            attempted_response_formats=tuple(attempted_response_formats),
            fallback_used=len(attempted_response_formats) > 1,
        )

    def _resolve_response_formats(self) -> tuple[GroqResponseFormat, ...]:
        if self._settings.GROQ_RESPONSE_FORMAT == "json_schema":
            return ("json_schema",)
        if self._settings.GROQ_RESPONSE_FORMAT == "json_object":
            return ("json_object",)
        return ("json_schema", "json_object")

    def _build_response_format_payload(self, response_format: GroqResponseFormat) -> dict:
        if response_format == "json_object":
            return {"type": "json_object"}

        strict_mode = self._settings.GROQ_MODEL in _STRICT_JSON_SCHEMA_MODELS
        return {
            "type": "json_schema",
            "json_schema": {
                "name": "fatigue_ai_comparison",
                "strict": strict_mode,
                "schema": GROQ_RESPONSE_JSON_SCHEMA,
            },
        }

    async def _post_chat_completion(
        self,
        payload: dict,
        *,
        response_format: GroqResponseFormat,
    ) -> dict:
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
            should_fallback = response_format == "json_schema" and (
                self._is_unsupported_json_schema_error(status_code, error_message)
                or self._is_provider_json_validation_error(status_code, error_message)
            )
            logger.warning(
                "Groq HTTP error status=%s response_format=%s",
                status_code,
                response_format,
            )
            raise GroqClientError(
                code=AIComparisonErrorCode.http_error,
                message=(
                    f"AI comparison failed with HTTP {status_code}: {error_message}"
                    if error_message
                    else f"AI comparison failed with HTTP {status_code}."
                ),
                retriable=status_code >= 500,
                should_fallback=should_fallback,
            ) from exc
        except httpx.HTTPError as exc:
            raise GroqClientError(
                code=AIComparisonErrorCode.http_error,
                message="AI comparison failed due to a network error.",
                retriable=True,
            ) from exc

        try:
            return response.json()
        except json.JSONDecodeError as exc:
            raise GroqClientError(
                code=AIComparisonErrorCode.invalid_json,
                message="The AI provider returned a non-JSON HTTP payload.",
                retriable=False,
            ) from exc

    def _validate_response_payload(
        self,
        response_payload: dict,
    ) -> tuple[AIComparisonResult, list[str]]:
        content = self._extract_message_content(response_payload)
        try:
            parsed_content = json.loads(content)
        except json.JSONDecodeError as exc:
            raise GroqClientError(
                code=AIComparisonErrorCode.invalid_json,
                message="The AI provider returned message content that was not valid JSON.",
                retriable=False,
            ) from exc

        omitted_or_null_fields = self._collect_omitted_or_null_fields(parsed_content)

        try:
            return AIComparisonResult.model_validate(parsed_content), omitted_or_null_fields
        except ValidationError as exc:
            logger.warning("Groq schema validation failed: %s", exc)
            raise GroqClientError(
                code=AIComparisonErrorCode.schema_validation,
                message="The AI provider returned JSON that did not match the expected schema.",
                retriable=False,
                should_fallback=True,
            ) from exc

    def _build_metadata(
        self,
        attempted_response_formats: list[str],
        *,
        response_format: str,
        omitted_or_null_fields: list[str],
    ) -> AIComparisonMetadata:
        return AIComparisonMetadata(
            response_format=response_format,
            schema_profile=GROQ_SCHEMA_PROFILE,
            schema_simplified=True,
            attempted_response_formats=attempted_response_formats,
            fallback_used=len(attempted_response_formats) > 1,
            omitted_or_null_fields=omitted_or_null_fields,
        )

    def _attach_attempt_diagnostics(
        self,
        exc: GroqClientError,
        attempted_response_formats: list[str],
        *,
        response_format: str,
    ) -> GroqClientError:
        return GroqClientError(
            code=exc.code,
            message=exc.message,
            retriable=exc.retriable,
            should_fallback=exc.should_fallback,
            response_format=response_format,
            attempted_response_formats=tuple(attempted_response_formats),
            fallback_used=len(attempted_response_formats) > 1,
        )

    def _should_try_fallback(
        self,
        exc: GroqClientError,
        response_format: str,
        response_formats: tuple[GroqResponseFormat, ...],
        index: int,
    ) -> bool:
        return (
            exc.should_fallback
            and response_format == "json_schema"
            and index + 1 < len(response_formats)
            and response_formats[index + 1] == "json_object"
        )

    def _is_unsupported_json_schema_error(
        self,
        status_code: int,
        error_message: str | None,
    ) -> bool:
        if status_code != 400 or not error_message:
            return False

        normalized_message = error_message.lower()
        return (
            "json_schema" in normalized_message
            and "response format" in normalized_message
            and (
                "does not support" in normalized_message
                or "not support" in normalized_message
                or "unsupported" in normalized_message
            )
        )

    def _is_provider_json_validation_error(
        self,
        status_code: int,
        error_message: str | None,
    ) -> bool:
        if status_code != 400 or not error_message:
            return False

        normalized_message = error_message.lower()
        return "failed to validate json" in normalized_message

    def _collect_omitted_or_null_fields(self, parsed_content: object) -> list[str]:
        if not isinstance(parsed_content, dict):
            return list(get_optional_top_level_fields())

        omitted_or_null_fields: list[str] = []
        for field_name in get_optional_top_level_fields():
            if field_name not in parsed_content or parsed_content[field_name] is None:
                omitted_or_null_fields.append(field_name)

        return omitted_or_null_fields

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
