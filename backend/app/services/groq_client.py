"""Async Groq adapter for optional fatigue comparison responses."""

from __future__ import annotations

import base64
from collections import Counter
import json
import logging
from dataclasses import dataclass
from typing import Any

import httpx
from pydantic import BaseModel, ValidationError

from app.core.config import Settings
from app.models.schemas import (
    AIComparisonErrorCode,
    AIInterpretationMetadata,
    AIInterpretationResult,
    AIComparisonMetadata,
    AIComparisonResult,
    AIComparisonValidationIssue,
    StressImageReadResponse,
)
from app.services.groq_interpretation import (
    GROQ_INTERPRETATION_JSON_SCHEMA,
    INTERPRETATION_TOP_LEVEL_FIELDS,
    build_interpretation_system_prompt,
    build_interpretation_user_prompt,
)
from app.services.groq_prompt import (
    GROQ_DEFAULT_SCHEMA_PROFILE,
    GROQ_FALLBACK_SCHEMA_PROFILE,
    GroqResponseFormat,
    GroqSchemaProfile,
    build_groq_system_prompt,
    build_groq_user_prompt,
    get_schema_for_profile,
    get_tracked_top_level_fields,
    is_simplified_schema_profile,
)
from app.services.groq_vision import (
    GROQ_VISION_JSON_SCHEMA,
    VISION_TRACKED_TOP_LEVEL_FIELDS,
    build_vision_system_prompt,
    build_vision_user_text,
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
    schema_profile: str | None = None
    schema_simplified: bool = False
    attempted_response_formats: tuple[str, ...] = ()
    fallback_used: bool = False
    validation_issues: tuple[AIComparisonValidationIssue, ...] = ()
    problematic_fields: tuple[str, ...] = ()

    def __str__(self) -> str:
        return self.message


@dataclass(frozen=True)
class GroqComparisonResponse:
    result: AIComparisonResult
    metadata: AIComparisonMetadata


@dataclass(frozen=True)
class GroqInterpretationResponse:
    result: AIInterpretationResult
    metadata: AIInterpretationMetadata


@dataclass(frozen=True)
class GroqResponseAttempt:
    response_format: GroqResponseFormat
    schema_profile: GroqSchemaProfile


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
        schema_profile: GroqSchemaProfile | None = None,
    ) -> dict:
        default_attempt = self._resolve_response_attempts()[0]
        selected_response_format = response_format or default_attempt.response_format
        selected_schema_profile = schema_profile or default_attempt.schema_profile

        return {
            "model": self._settings.GROQ_MODEL,
            "temperature": 0.1,
            "response_format": self._build_response_format_payload(
                selected_response_format,
                schema_profile=selected_schema_profile,
            ),
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
                        schema_profile=selected_schema_profile,
                    ),
                },
            ],
        }

    async def interpret_fatigue_analysis(
        self,
        interpretation_input: dict,
    ) -> GroqInterpretationResponse:
        if not self.is_configured:
            raise GroqClientError(
                code=AIComparisonErrorCode.not_configured,
                message="AI interpretation is not configured on the backend.",
                retriable=False,
            )

        attempted_response_formats: list[str] = []
        validation_issues: list[AIComparisonValidationIssue] = []
        problematic_fields: list[str] = []

        for response_format in self._resolve_response_formats():
            attempted_response_formats.append(response_format)
            payload = self._build_generic_chat_payload(
                model_name=self._settings.GROQ_MODEL,
                response_format=response_format,
                schema_name="fatigue_ai_interpretation",
                schema=GROQ_INTERPRETATION_JSON_SCHEMA,
                messages=[
                    {
                        "role": "system",
                        "content": build_interpretation_system_prompt(response_format),
                    },
                    {
                        "role": "user",
                        "content": build_interpretation_user_prompt(
                            interpretation_input,
                            model_name=self._settings.GROQ_MODEL,
                        ),
                    },
                ],
            )

            try:
                response_payload = await self._post_chat_completion(
                    payload,
                    response_format=response_format,
                    schema_profile="interpretation_v1",
                )
                result, _ = self._validate_typed_response_payload(
                    response_payload,
                    response_model=AIInterpretationResult,
                    tracked_fields=INTERPRETATION_TOP_LEVEL_FIELDS,
                    schema_profile="interpretation_v1",
                )
            except GroqClientError as exc:
                if exc.validation_issues:
                    validation_issues = list(exc.validation_issues)
                    problematic_fields = list(exc.problematic_fields)
                if self._should_try_json_object_fallback(
                    exc,
                    response_format=response_format,
                    attempted_response_formats=attempted_response_formats,
                ):
                    continue

                raise self._attach_attempt_diagnostics(
                    exc,
                    attempted_response_formats,
                    response_format=response_format,
                    schema_profile="interpretation_v1",
                ) from exc

            return GroqInterpretationResponse(
                result=result,
                metadata=AIInterpretationMetadata(
                    response_format=response_format,
                    attempted_response_formats=attempted_response_formats,
                    fallback_used=len(attempted_response_formats) > 1,
                    problematic_fields=problematic_fields,
                    validation_issue_count=len(validation_issues),
                    validation_issues=validation_issues,
                ),
            )

        raise GroqClientError(
            code=AIComparisonErrorCode.unexpected_error,
            message="AI interpretation failed before a final response format could be selected.",
            retriable=False,
            attempted_response_formats=tuple(attempted_response_formats),
            fallback_used=len(attempted_response_formats) > 1,
        )

    async def extract_stress_from_image(
        self,
        *,
        image_bytes: bytes,
        content_type: str,
        filename: str | None = None,
    ) -> StressImageReadResponse:
        if not self.is_configured:
            raise GroqClientError(
                code=AIComparisonErrorCode.not_configured,
                message="AI vision is not configured on the backend.",
                retriable=False,
            )

        encoded_image = base64.b64encode(image_bytes).decode("ascii")
        image_url = f"data:{content_type};base64,{encoded_image}"
        attempted_response_formats: list[str] = []

        for response_format in self._resolve_response_formats():
            attempted_response_formats.append(response_format)
            payload = self._build_generic_chat_payload(
                model_name=self._settings.GROQ_VISION_MODEL,
                response_format=response_format,
                schema_name="stress_from_image",
                schema=GROQ_VISION_JSON_SCHEMA,
                messages=[
                    {
                        "role": "system",
                        "content": build_vision_system_prompt(response_format),
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": build_vision_user_text(filename),
                            },
                            {
                                "type": "image_url",
                                "image_url": {"url": image_url},
                            },
                        ],
                    },
                ],
            )

            try:
                response_payload = await self._post_chat_completion(
                    payload,
                    response_format=response_format,
                    schema_profile="vision_v1",
                )
                result, _ = self._validate_typed_response_payload(
                    response_payload,
                    response_model=StressImageReadResponse,
                    tracked_fields=VISION_TRACKED_TOP_LEVEL_FIELDS,
                    schema_profile="vision_v1",
                )
                return result
            except GroqClientError as exc:
                if self._should_try_json_object_fallback(
                    exc,
                    response_format=response_format,
                    attempted_response_formats=attempted_response_formats,
                ):
                    continue
                raise self._attach_attempt_diagnostics(
                    exc,
                    attempted_response_formats,
                    response_format=response_format,
                    schema_profile="vision_v1",
                ) from exc

        raise GroqClientError(
            code=AIComparisonErrorCode.unexpected_error,
            message="AI vision failed before a final response format could be selected.",
            retriable=False,
            attempted_response_formats=tuple(attempted_response_formats),
            fallback_used=len(attempted_response_formats) > 1,
        )

    async def compare_fatigue_analysis(self, comparison_input: dict) -> GroqComparisonResponse:
        if not self.is_configured:
            raise GroqClientError(
                code=AIComparisonErrorCode.not_configured,
                message="AI comparison is not configured on the backend.",
                retriable=False,
            )

        attempts = self._resolve_response_attempts()
        attempted_response_formats: list[str] = []
        validation_issues: list[AIComparisonValidationIssue] = []
        problematic_fields: list[str] = []

        for index, attempt in enumerate(attempts):
            attempted_response_formats.append(attempt.response_format)
            payload = self.build_chat_payload(
                comparison_input,
                response_format=attempt.response_format,
                schema_profile=attempt.schema_profile,
            )

            try:
                response_payload = await self._post_chat_completion(
                    payload,
                    response_format=attempt.response_format,
                    schema_profile=attempt.schema_profile,
                )
                result, omitted_or_null_fields = self._validate_response_payload(
                    response_payload,
                    schema_profile=attempt.schema_profile,
                )
            except GroqClientError as exc:
                if exc.validation_issues:
                    validation_issues = list(exc.validation_issues)
                    problematic_fields = list(exc.problematic_fields)
                if self._should_try_fallback(exc, attempt, attempts, index):
                    logger.info(
                        "Groq model=%s retrying response_format=%s schema_profile=%s after code=%s",
                        self._settings.GROQ_MODEL,
                        attempt.response_format,
                        attempt.schema_profile,
                        exc.code.value,
                    )
                    continue

                raise self._attach_attempt_diagnostics(
                    exc,
                    attempted_response_formats,
                    response_format=attempt.response_format,
                    schema_profile=attempt.schema_profile,
                ) from exc

            return GroqComparisonResponse(
                result=result,
                metadata=self._build_metadata(
                    attempted_response_formats,
                    response_format=attempt.response_format,
                    schema_profile=attempt.schema_profile,
                    omitted_or_null_fields=omitted_or_null_fields,
                    problematic_fields=problematic_fields,
                    validation_issues=validation_issues,
                ),
            )

        raise GroqClientError(
            code=AIComparisonErrorCode.unexpected_error,
            message="AI comparison failed before a final response format could be selected.",
            retriable=False,
            attempted_response_formats=tuple(attempted_response_formats),
            fallback_used=len(attempted_response_formats) > 1,
        )

    def _resolve_response_attempts(self) -> tuple[GroqResponseAttempt, ...]:
        if self._settings.GROQ_RESPONSE_FORMAT == "json_schema":
            return (
                GroqResponseAttempt(
                    response_format="json_schema",
                    schema_profile=GROQ_DEFAULT_SCHEMA_PROFILE,
                ),
            )
        if self._settings.GROQ_RESPONSE_FORMAT == "json_object":
            return (
                GroqResponseAttempt(
                    response_format="json_object",
                    schema_profile=GROQ_FALLBACK_SCHEMA_PROFILE,
                ),
            )
        return (
            GroqResponseAttempt(
                response_format="json_schema",
                schema_profile=GROQ_DEFAULT_SCHEMA_PROFILE,
            ),
            GroqResponseAttempt(
                response_format="json_object",
                schema_profile=GROQ_FALLBACK_SCHEMA_PROFILE,
            ),
        )

    def _resolve_response_formats(self) -> tuple[GroqResponseFormat, ...]:
        if self._settings.GROQ_RESPONSE_FORMAT == "json_schema":
            return ("json_schema",)
        if self._settings.GROQ_RESPONSE_FORMAT == "json_object":
            return ("json_object",)
        return ("json_schema", "json_object")

    def _build_generic_chat_payload(
        self,
        *,
        model_name: str,
        response_format: GroqResponseFormat,
        schema_name: str,
        schema: dict,
        messages: list[dict[str, Any]],
    ) -> dict:
        return {
            "model": model_name,
            "temperature": 0.1,
            "response_format": self._build_generic_response_format_payload(
                response_format,
                schema_name=schema_name,
                schema=schema,
                model_name=model_name,
            ),
            "messages": messages,
        }

    def _build_response_format_payload(
        self,
        response_format: GroqResponseFormat,
        *,
        schema_profile: GroqSchemaProfile,
    ) -> dict:
        if response_format == "json_object":
            return {"type": "json_object"}

        strict_mode = self._settings.GROQ_MODEL in _STRICT_JSON_SCHEMA_MODELS
        return {
            "type": "json_schema",
            "json_schema": {
                "name": "fatigue_ai_comparison",
                "strict": strict_mode,
                "schema": get_schema_for_profile(schema_profile),
            },
        }

    def _build_generic_response_format_payload(
        self,
        response_format: GroqResponseFormat,
        *,
        schema_name: str,
        schema: dict,
        model_name: str,
    ) -> dict:
        if response_format == "json_object":
            return {"type": "json_object"}

        strict_mode = model_name in _STRICT_JSON_SCHEMA_MODELS
        return {
            "type": "json_schema",
            "json_schema": {
                "name": schema_name,
                "strict": strict_mode,
                "schema": schema,
            },
        }

    async def _post_chat_completion(
        self,
        payload: dict,
        *,
        response_format: GroqResponseFormat,
        schema_profile: GroqSchemaProfile,
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
                response_format=response_format,
                schema_profile=schema_profile,
                schema_simplified=is_simplified_schema_profile(schema_profile),
            ) from exc
        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code
            error_message = self._extract_error_message(exc.response)
            should_fallback = response_format == "json_schema" and (
                self._is_unsupported_json_schema_error(status_code, error_message)
                or self._is_provider_json_validation_error(status_code, error_message)
            )
            logger.warning(
                "Groq HTTP error status=%s response_format=%s schema_profile=%s",
                status_code,
                response_format,
                schema_profile,
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
                response_format=response_format,
                schema_profile=schema_profile,
                schema_simplified=is_simplified_schema_profile(schema_profile),
            ) from exc
        except httpx.HTTPError as exc:
            raise GroqClientError(
                code=AIComparisonErrorCode.http_error,
                message="AI comparison failed due to a network error.",
                retriable=True,
                response_format=response_format,
                schema_profile=schema_profile,
                schema_simplified=is_simplified_schema_profile(schema_profile),
            ) from exc

        try:
            return response.json()
        except json.JSONDecodeError as exc:
            raise GroqClientError(
                code=AIComparisonErrorCode.invalid_json,
                message="The AI provider returned a non-JSON HTTP payload.",
                retriable=False,
                response_format=response_format,
                schema_profile=schema_profile,
                schema_simplified=is_simplified_schema_profile(schema_profile),
            ) from exc

    def _validate_response_payload(
        self,
        response_payload: dict,
        *,
        schema_profile: GroqSchemaProfile,
    ) -> tuple[AIComparisonResult, list[str]]:
        return self._validate_typed_response_payload(
            response_payload,
            response_model=AIComparisonResult,
            tracked_fields=get_tracked_top_level_fields(),
            schema_profile=schema_profile,
        )

    def _validate_typed_response_payload(
        self,
        response_payload: dict,
        *,
        response_model: type[BaseModel],
        tracked_fields: tuple[str, ...],
        schema_profile: str,
    ) -> tuple[Any, list[str]]:
        content = self._extract_message_content(response_payload)
        try:
            parsed_content = json.loads(content)
        except json.JSONDecodeError as exc:
            raise GroqClientError(
                code=AIComparisonErrorCode.invalid_json,
                message="The AI provider returned message content that was not valid JSON.",
                retriable=False,
                schema_profile=schema_profile,
                schema_simplified=is_simplified_schema_profile(schema_profile),
            ) from exc

        omitted_or_null_fields = self._collect_omitted_or_null_fields(
            parsed_content,
            tracked_fields,
        )

        try:
            return response_model.model_validate(parsed_content), omitted_or_null_fields
        except ValidationError as exc:
            validation_issues = self._build_validation_issues(response_model, exc)
            problematic_fields = self._extract_problematic_fields(validation_issues)
            logger.warning(
                "Groq schema validation failed schema_profile=%s problematic_fields=%s issues=%s",
                schema_profile,
                problematic_fields,
                [issue.model_dump() for issue in validation_issues],
            )
            raise GroqClientError(
                code=AIComparisonErrorCode.schema_validation,
                message="The AI provider returned JSON that did not match the expected schema.",
                retriable=False,
                should_fallback=True,
                schema_profile=schema_profile,
                schema_simplified=is_simplified_schema_profile(schema_profile),
                validation_issues=tuple(validation_issues),
                problematic_fields=tuple(problematic_fields),
            ) from exc

    def _build_metadata(
        self,
        attempted_response_formats: list[str],
        *,
        response_format: str,
        schema_profile: GroqSchemaProfile,
        omitted_or_null_fields: list[str],
        problematic_fields: list[str],
        validation_issues: list[AIComparisonValidationIssue],
    ) -> AIComparisonMetadata:
        return AIComparisonMetadata(
            response_format=response_format,
            schema_profile=schema_profile,
            schema_simplified=is_simplified_schema_profile(schema_profile),
            attempted_response_formats=attempted_response_formats,
            fallback_used=len(attempted_response_formats) > 1,
            omitted_or_null_fields=omitted_or_null_fields,
            problematic_fields=problematic_fields,
            validation_issue_count=len(validation_issues),
            validation_issues=validation_issues,
        )

    def _attach_attempt_diagnostics(
        self,
        exc: GroqClientError,
        attempted_response_formats: list[str],
        *,
        response_format: str,
        schema_profile: GroqSchemaProfile,
    ) -> GroqClientError:
        return GroqClientError(
            code=exc.code,
            message=exc.message,
            retriable=exc.retriable,
            should_fallback=exc.should_fallback,
            response_format=response_format,
            schema_profile=schema_profile,
            schema_simplified=is_simplified_schema_profile(schema_profile),
            attempted_response_formats=tuple(attempted_response_formats),
            fallback_used=len(attempted_response_formats) > 1,
            validation_issues=exc.validation_issues,
            problematic_fields=exc.problematic_fields,
        )

    def _build_validation_issues(
        self,
        response_model: type[BaseModel],
        exc: ValidationError,
    ) -> list[AIComparisonValidationIssue]:
        validation_issues: list[AIComparisonValidationIssue] = []
        for error in exc.errors(include_url=False):
            loc = error.get("loc", ())
            error_type = str(error.get("type", "unknown"))
            validation_issues.append(
                AIComparisonValidationIssue(
                    field_path=self._format_field_path(loc),
                    expected_type=self._lookup_expected_type_for_model(
                        response_model,
                        loc,
                    ),
                    actual_type=(
                        None
                        if error_type == "missing"
                        else self._describe_input_type(error.get("input"))
                    ),
                    error_type=error_type,
                    missing=error_type == "missing",
                    wrong_shape=self._is_shape_validation_error(error_type),
                )
            )
        return validation_issues

    def _extract_problematic_fields(
        self,
        validation_issues: list[AIComparisonValidationIssue],
    ) -> list[str]:
        counts: Counter[str] = Counter()
        for issue in validation_issues:
            top_level_field = issue.field_path.split(".", 1)[0].split("[", 1)[0]
            if top_level_field:
                counts[top_level_field] += 1

        return [field for field, _count in counts.most_common()]

    def _format_field_path(self, loc: tuple[Any, ...] | Any) -> str:
        if not isinstance(loc, tuple):
            return str(loc)

        parts: list[str] = []
        for part in loc:
            if isinstance(part, int):
                if parts:
                    parts[-1] = f"{parts[-1]}[{part}]"
                else:
                    parts.append(f"[{part}]")
                continue
            parts.append(str(part))

        return ".".join(parts) if parts else "<root>"

    def _lookup_expected_type(self, loc: tuple[Any, ...] | Any) -> str | None:
        return self._lookup_expected_type_for_model(AIComparisonResult, loc)

    def _lookup_expected_type_for_model(
        self,
        response_model: type[BaseModel],
        loc: tuple[Any, ...] | Any,
    ) -> str | None:
        if not isinstance(loc, tuple):
            return None

        schema = response_model.model_json_schema()
        defs = schema.get("$defs", {})
        node = self._resolve_schema_node(schema, defs, loc)
        return self._describe_schema_type(node, defs)

    def _resolve_schema_node(
        self,
        node: dict[str, Any] | None,
        defs: dict[str, Any],
        loc: tuple[Any, ...],
    ) -> dict[str, Any] | None:
        current = self._dereference_schema_node(node, defs)
        for part in loc:
            current = self._select_non_null_schema_variant(current, defs)
            if current is None:
                return None

            if isinstance(part, int):
                items = current.get("items")
                if not isinstance(items, dict):
                    return None
                current = items
                continue

            properties = current.get("properties")
            if not isinstance(properties, dict):
                return None
            child = properties.get(str(part))
            if not isinstance(child, dict):
                return None
            current = child

        return self._dereference_schema_node(current, defs)

    def _dereference_schema_node(
        self,
        node: dict[str, Any] | None,
        defs: dict[str, Any],
    ) -> dict[str, Any] | None:
        current = node
        while isinstance(current, dict) and "$ref" in current:
            ref = current["$ref"]
            if not isinstance(ref, str) or not ref.startswith("#/$defs/"):
                return current
            current = defs.get(ref.split("/")[-1])
        return current

    def _select_non_null_schema_variant(
        self,
        node: dict[str, Any] | None,
        defs: dict[str, Any],
    ) -> dict[str, Any] | None:
        current = self._dereference_schema_node(node, defs)
        if not isinstance(current, dict):
            return None

        variants = current.get("anyOf") or current.get("oneOf")
        if not isinstance(variants, list):
            return current

        resolved_variants = [
            self._dereference_schema_node(variant, defs)
            for variant in variants
            if isinstance(variant, dict)
        ]
        non_null_variants = [
            variant
            for variant in resolved_variants
            if isinstance(variant, dict) and variant.get("type") != "null"
        ]
        return non_null_variants[0] if non_null_variants else current

    def _describe_schema_type(
        self,
        node: dict[str, Any] | None,
        defs: dict[str, Any],
    ) -> str | None:
        current = self._select_non_null_schema_variant(node, defs)
        if not isinstance(current, dict):
            return None

        if current.get("enum") is not None:
            base_type = current.get("type")
            if isinstance(base_type, str):
                return f"enum<{base_type}>"
            return "enum"

        schema_type = current.get("type")
        if isinstance(schema_type, list):
            normalized = [item for item in schema_type if item != "null"]
            return " | ".join(normalized) if normalized else "null"
        if schema_type == "array":
            items = current.get("items")
            if isinstance(items, dict):
                item_type = self._describe_schema_type(items, defs)
                return f"array<{item_type or 'unknown'}>"
            return "array"
        if schema_type == "object":
            properties = current.get("properties")
            if isinstance(properties, dict) and set(properties.keys()) == {"x", "y"}:
                return "array_point<object{x:number,y:number}>"
            return "object"
        if isinstance(schema_type, str):
            return schema_type

        variants = current.get("anyOf") or current.get("oneOf")
        if isinstance(variants, list):
            described = []
            for variant in variants:
                if isinstance(variant, dict):
                    variant_type = self._describe_schema_type(variant, defs)
                    if variant_type and variant_type not in described:
                        described.append(variant_type)
            if described:
                return " | ".join(described)

        return None

    def _describe_input_type(self, value: Any) -> str | None:
        if value is None:
            return None
        if isinstance(value, bool):
            return "boolean"
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return "number"
        if isinstance(value, str):
            return "string"
        if isinstance(value, list):
            return "array"
        if isinstance(value, dict):
            return "object"
        return type(value).__name__

    def _is_shape_validation_error(self, error_type: str) -> bool:
        return error_type in {
            "missing",
            "list_type",
            "tuple_type",
            "dict_type",
            "model_type",
            "too_long",
            "too_short",
        }

    def _should_try_json_object_fallback(
        self,
        exc: GroqClientError,
        *,
        response_format: GroqResponseFormat,
        attempted_response_formats: list[str],
    ) -> bool:
        return (
            exc.should_fallback
            and response_format == "json_schema"
            and "json_object" not in attempted_response_formats
        )

    def _should_try_fallback(
        self,
        exc: GroqClientError,
        attempt: GroqResponseAttempt,
        attempts: tuple[GroqResponseAttempt, ...],
        index: int,
    ) -> bool:
        return (
            exc.should_fallback
            and attempt.response_format == "json_schema"
            and index + 1 < len(attempts)
            and attempts[index + 1].response_format == "json_object"
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

        return "failed to validate json" in error_message.lower()

    def _collect_omitted_or_null_fields(
        self,
        parsed_content: object,
        tracked_fields: tuple[str, ...],
    ) -> list[str]:
        if not isinstance(parsed_content, dict):
            return list(tracked_fields)

        omitted_or_null_fields: list[str] = []
        for field_name in tracked_fields:
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
