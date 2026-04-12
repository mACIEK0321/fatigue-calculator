"""Prompt and schema definitions for the optional Groq comparison adapter."""

from __future__ import annotations

import json
from typing import Literal

GroqResponseFormat = Literal["json_schema", "json_object"]
GroqSchemaProfile = Literal["full_v1", "minimal_v1"]

GROQ_DEFAULT_SCHEMA_PROFILE: GroqSchemaProfile = "full_v1"
GROQ_FALLBACK_SCHEMA_PROFILE: GroqSchemaProfile = "minimal_v1"

_FULL_TOP_LEVEL_FIELDS = (
    "summary",
    "assumptions",
    "interpreted_inputs",
    "basquin_parameters",
    "modified_endurance_limit",
    "stress_state",
    "mean_stress_result",
    "life",
    "safety_factor",
    "sn_curve_points",
    "goodman_or_haigh_points",
    "warnings",
    "raw_model_name",
)

_MINIMAL_TOP_LEVEL_FIELDS = (
    "summary",
    "basquin_parameters",
    "modified_endurance_limit",
    "stress_state",
    "life",
    "safety_factor",
    "warnings",
    "raw_model_name",
)

_TRACKED_TOP_LEVEL_FIELDS = _FULL_TOP_LEVEL_FIELDS

_GROQ_SYSTEM_PROMPT_BASE = """You are a fatigue-analysis comparison engine.
Return exactly one valid JSON object.
Do not add markdown.
Do not add code fences.
Do not add any text before or after the JSON.
Use only the allowed keys.
Use null when a nullable field cannot be derived reliably.
"""

_POINT_PAIR_SCHEMA = {
    "type": "array",
    "items": {"type": "number"},
    "minItems": 2,
    "maxItems": 2,
}

_AI_INTERPRETED_INPUTS_SCHEMA = {
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
        "sn_curve_source": {"type": ["string", "null"]},
        "surface_factor": {"type": ["number", "null"]},
        "marin_factors": {
            "type": ["object", "null"],
            "additionalProperties": False,
            "required": [
                "size_factor",
                "load_factor",
                "temperature_factor",
                "reliability_factor",
            ],
            "properties": {
                "size_factor": {"type": ["number", "null"]},
                "load_factor": {"type": ["number", "null"]},
                "temperature_factor": {"type": ["number", "null"]},
                "reliability_factor": {"type": ["number", "null"]},
            },
        },
        "notch_correction_factor": {"type": ["number", "null"]},
        "loading_blocks_count": {"type": ["integer", "null"]},
    },
}

_AI_BASQUIN_PARAMETERS_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["sigma_f_prime", "b", "source"],
    "properties": {
        "sigma_f_prime": {"type": ["number", "null"]},
        "b": {"type": ["number", "null"]},
        "source": {"type": ["string", "null"]},
    },
}

_AI_STRESS_STATE_SCHEMA = {
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
}

_AI_MEAN_STRESS_RESULT_SCHEMA = {
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
            "type": ["string", "null"],
            "enum": ["goodman", "gerber", "soderberg", "morrow", None],
        },
        "effective_mean_stress": {"type": ["number", "null"]},
        "equivalent_alternating_stress": {"type": ["number", "null"]},
        "is_safe": {"type": ["boolean", "null"]},
    },
}

_AI_LIFE_SCHEMA = {
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
}

GROQ_FULL_RESPONSE_JSON_SCHEMA: dict = {
    "type": "object",
    "additionalProperties": False,
    "required": list(_FULL_TOP_LEVEL_FIELDS),
    "properties": {
        "summary": {"type": "string"},
        "assumptions": {
            "type": ["array", "null"],
            "items": {"type": "string"},
        },
        "interpreted_inputs": _AI_INTERPRETED_INPUTS_SCHEMA,
        "basquin_parameters": _AI_BASQUIN_PARAMETERS_SCHEMA,
        "modified_endurance_limit": {"type": ["number", "null"]},
        "stress_state": _AI_STRESS_STATE_SCHEMA,
        "mean_stress_result": _AI_MEAN_STRESS_RESULT_SCHEMA,
        "life": _AI_LIFE_SCHEMA,
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

GROQ_MINIMAL_RESPONSE_JSON_SCHEMA: dict = {
    "type": "object",
    "additionalProperties": False,
    "required": list(_MINIMAL_TOP_LEVEL_FIELDS),
    "properties": {
        "summary": {"type": "string"},
        "basquin_parameters": _AI_BASQUIN_PARAMETERS_SCHEMA,
        "modified_endurance_limit": {"type": ["number", "null"]},
        "stress_state": _AI_STRESS_STATE_SCHEMA,
        "life": _AI_LIFE_SCHEMA,
        "safety_factor": {"type": ["number", "null"]},
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
    schema_profile: GroqSchemaProfile,
) -> str:
    """Build the user prompt aligned with the selected Groq response format."""
    normalized_payload = json.dumps(payload, ensure_ascii=True, separators=(",", ":"))
    required_keys = ",".join(get_required_top_level_fields(schema_profile))

    instructions = [
        "Return one JSON object only.",
        f"Required keys: {required_keys}.",
        "Do not output markdown.",
        "Do not output any extra keys.",
        f'Set "raw_model_name" to "{model_name}" exactly.',
    ]

    if schema_profile == GROQ_DEFAULT_SCHEMA_PROFILE:
        instructions.append(
            "Every listed key must be present. Use null for nullable fields instead of omitting them."
        )
        instructions.append(
            'Use [] for "assumptions", "warnings", "sn_curve_points", and "goodman_or_haigh_points" when there is no data.'
        )
    else:
        instructions.append(
            "Keep the response minimal. Omit the extended comparison fields."
        )

    if response_format == "json_object":
        instructions.append("Reply with JSON only.")

    return "\n".join(instructions) + f"\nInput:{normalized_payload}"


def get_schema_for_profile(schema_profile: GroqSchemaProfile) -> dict:
    """Return the Groq JSON schema for the selected profile."""
    if schema_profile == GROQ_DEFAULT_SCHEMA_PROFILE:
        return GROQ_FULL_RESPONSE_JSON_SCHEMA
    return GROQ_MINIMAL_RESPONSE_JSON_SCHEMA


def get_required_top_level_fields(
    schema_profile: GroqSchemaProfile,
) -> tuple[str, ...]:
    """Return required top-level fields for the selected schema profile."""
    if schema_profile == GROQ_DEFAULT_SCHEMA_PROFILE:
        return _FULL_TOP_LEVEL_FIELDS
    return _MINIMAL_TOP_LEVEL_FIELDS


def is_simplified_schema_profile(schema_profile: GroqSchemaProfile) -> bool:
    """Return whether the selected schema profile is the simplified fallback."""
    return schema_profile != GROQ_DEFAULT_SCHEMA_PROFILE


def get_tracked_top_level_fields() -> tuple[str, ...]:
    """Return top-level fields tracked for diagnostics."""
    return _TRACKED_TOP_LEVEL_FIELDS
