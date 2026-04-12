"""Prompt and schema definitions for the optional Groq comparison adapter."""

from __future__ import annotations

import json
from typing import Literal

GroqResponseFormat = Literal["json_schema", "json_object"]

GROQ_SCHEMA_PROFILE = "minimal_v1"
_OPTIONAL_TOP_LEVEL_FIELDS = (
    "assumptions",
    "interpreted_inputs",
    "mean_stress_result",
    "sn_curve_points",
    "goodman_or_haigh_points",
)

_GROQ_SYSTEM_PROMPT_BASE = """You are a fatigue-analysis comparison engine.
Return exactly one valid JSON object.
Do not add markdown.
Do not add code fences.
Do not add any text before or after the JSON.
Use only the allowed keys.
Use null when a value cannot be derived reliably.
"""

_POINT_PAIR_SCHEMA = {
    "type": "array",
    "items": {"type": "number"},
    "minItems": 2,
    "maxItems": 2,
}

GROQ_RESPONSE_JSON_SCHEMA: dict = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "summary",
        "basquin_parameters",
        "modified_endurance_limit",
        "stress_state",
        "life",
        "safety_factor",
        "warnings",
        "raw_model_name",
    ],
    "properties": {
        "summary": {"type": "string"},
        "assumptions": {"type": ["array", "null"], "items": {"type": "string"}},
        "interpreted_inputs": {
            "type": ["object", "null"],
            "additionalProperties": False,
            "required": [
                "material_label",
                "sn_curve_source",
                "surface_factor",
                "marin_factors",
                "notch_correction_factor",
                "loading_blocks_count",
            ],
            "properties": {
                "material_label": {"type": ["string", "null"]},
                "sn_curve_source": {"type": "string"},
                "surface_factor": {"type": ["number", "null"]},
                "marin_factors": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": [
                        "size_factor",
                        "load_factor",
                        "temperature_factor",
                        "reliability_factor",
                    ],
                    "properties": {
                        "size_factor": {"type": "number"},
                        "load_factor": {"type": "number"},
                        "temperature_factor": {"type": "number"},
                        "reliability_factor": {"type": "number"},
                    },
                },
                "notch_correction_factor": {"type": ["number", "null"]},
                "loading_blocks_count": {"type": "integer"},
            },
        },
        "basquin_parameters": {
            "type": "object",
            "additionalProperties": False,
            "required": ["sigma_f_prime", "b", "source"],
            "properties": {
                "sigma_f_prime": {"type": ["number", "null"]},
                "b": {"type": ["number", "null"]},
                "source": {"type": ["string", "null"]},
            },
        },
        "modified_endurance_limit": {"type": ["number", "null"]},
        "stress_state": {
            "type": "object",
            "additionalProperties": False,
            "required": [
                "max_stress",
                "min_stress",
                "mean_stress",
                "stress_amplitude",
                "stress_ratio",
            ],
            "properties": {
                "max_stress": {"type": "number"},
                "min_stress": {"type": "number"},
                "mean_stress": {"type": "number"},
                "stress_amplitude": {"type": "number"},
                "stress_ratio": {"type": ["number", "null"]},
            },
        },
        "mean_stress_result": {
            "type": ["object", "null"],
            "additionalProperties": False,
            "required": [
                "model_name",
                "effective_mean_stress",
                "equivalent_alternating_stress",
                "is_safe",
            ],
            "properties": {
                "model_name": {
                    "type": "string",
                    "enum": ["goodman", "gerber", "soderberg", "morrow"],
                },
                "effective_mean_stress": {"type": ["number", "null"]},
                "equivalent_alternating_stress": {"type": ["number", "null"]},
                "is_safe": {"type": ["boolean", "null"]},
            },
        },
        "life": {
            "type": "object",
            "additionalProperties": False,
            "required": ["status", "cycles", "reason"],
            "properties": {
                "status": {
                    "type": "string",
                    "enum": ["finite", "infinite"],
                },
                "cycles": {"type": ["number", "null"]},
                "reason": {"type": ["string", "null"]},
            },
        },
        "safety_factor": {"type": ["number", "null"]},
        "sn_curve_points": {
            "type": ["array", "null"],
            "items": _POINT_PAIR_SCHEMA,
        },
        "goodman_or_haigh_points": {
            "type": ["array", "null"],
            "items": _POINT_PAIR_SCHEMA,
        },
        "warnings": {"type": "array", "items": {"type": "string"}},
        "raw_model_name": {"type": "string"},
    },
}


def build_groq_system_prompt(response_format: GroqResponseFormat) -> str:
    """Build the system prompt for the requested Groq response format."""
    if response_format == "json_object":
        return (
            _GROQ_SYSTEM_PROMPT_BASE
            + "The first character must be '{' and the last character must be '}'."
        )

    return _GROQ_SYSTEM_PROMPT_BASE


def build_groq_user_prompt(
    payload: dict,
    *,
    response_format: GroqResponseFormat,
    model_name: str,
) -> str:
    """Build the user prompt aligned with the selected Groq response format."""
    normalized_payload = json.dumps(payload, ensure_ascii=True, separators=(",", ":"))
    allowed_keys = ",".join(
        [
            "summary",
            "basquin_parameters",
            "modified_endurance_limit",
            "stress_state",
            "life",
            "safety_factor",
            "warnings",
            "raw_model_name",
        ]
    )
    optional_keys = ",".join(_OPTIONAL_TOP_LEVEL_FIELDS)

    instructions = (
        "Return one JSON object only.\n"
        f"Required keys: {allowed_keys}.\n"
        f"Optional keys: {optional_keys}.\n"
        "Do not output markdown.\n"
        "Do not output any extra keys.\n"
        "If a value is uncertain, return null for that field.\n"
        f'Set "raw_model_name" to "{model_name}" exactly.\n'
    )

    if response_format == "json_object":
        instructions += "Reply with JSON only.\n"

    return f"{instructions}Input:{normalized_payload}"


def get_optional_top_level_fields() -> tuple[str, ...]:
    """Return optional top-level fields used by the simplified schema."""
    return _OPTIONAL_TOP_LEVEL_FIELDS
