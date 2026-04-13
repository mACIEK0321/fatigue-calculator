"""Prompt and schema helpers for AI interpretation of native fatigue results."""

from __future__ import annotations

import json
from typing import Literal

GroqInterpretationResponseFormat = Literal["json_schema", "json_object"]

INTERPRETATION_TOP_LEVEL_FIELDS = (
    "summary",
    "key_findings",
    "warnings",
    "engineering_notes",
    "raw_model_name",
)

GROQ_INTERPRETATION_JSON_SCHEMA: dict = {
    "type": "object",
    "additionalProperties": False,
    "required": list(INTERPRETATION_TOP_LEVEL_FIELDS),
    "properties": {
        "summary": {"type": "string"},
        "key_findings": {
            "type": "array",
            "items": {"type": "string"},
        },
        "warnings": {
            "type": "array",
            "items": {"type": "string"},
        },
        "engineering_notes": {
            "type": "array",
            "items": {"type": "string"},
        },
        "raw_model_name": {"type": "string"},
    },
}


def build_interpretation_system_prompt(
    response_format: GroqInterpretationResponseFormat,
) -> str:
    base = """You are an engineering assistant interpreting a native fatigue-analysis result.
The native solver is the source of truth.
Do not recompute the physics.
Do not invent missing values.
Return exactly one valid JSON object.
Do not add markdown.
Do not add code fences.
Do not add any text before or after the JSON.
Use only the allowed keys.
"""
    if response_format == "json_object":
        return base + "The first character must be '{' and the last character must be '}'."
    return base


def build_interpretation_user_prompt(
    payload: dict,
    *,
    model_name: str,
) -> str:
    normalized_payload = json.dumps(payload, ensure_ascii=True, separators=(",", ":"))
    required_keys = ",".join(INTERPRETATION_TOP_LEVEL_FIELDS)

    return "\n".join(
        [
            "Interpret the backend result in concise engineering language.",
            "Prefer short, specific points over generic advice.",
            "Mention whether the result appears safe or unsafe according to the native result.",
            "Call out drivers such as mean stress correction, Marin factors, notch correction, loading blocks, and suspicious inputs when relevant.",
            "If optional vision data is present, treat it only as supporting context, not as a replacement for solver inputs.",
            f"Required keys: {required_keys}.",
            "Return arrays as [] when there is nothing useful to say for that field.",
            "Do not include chart data or derived point series.",
            f'Set "raw_model_name" to "{model_name}" exactly.',
            f"Input:{normalized_payload}",
        ]
    )
