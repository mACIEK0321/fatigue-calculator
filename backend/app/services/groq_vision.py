"""Prompt and schema helpers for extracting stress readings from screenshots."""

from __future__ import annotations

GROQ_VISION_JSON_SCHEMA: dict = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "success",
        "detected_quantity",
        "detected_label",
        "detected_unit",
        "max_value",
        "min_value",
        "confidence",
        "notes",
        "is_usable_for_prefill",
    ],
    "properties": {
        "success": {"type": "boolean"},
        "detected_quantity": {
            "type": "string",
            "enum": ["von_mises", "equivalent_stress", "unknown"],
        },
        "detected_label": {"type": ["string", "null"]},
        "detected_unit": {"type": "string"},
        "max_value": {"type": ["number", "null"]},
        "min_value": {"type": ["number", "null"]},
        "confidence": {
            "type": "string",
            "enum": ["high", "medium", "low"],
        },
        "notes": {
            "type": "array",
            "items": {"type": "string"},
        },
        "is_usable_for_prefill": {"type": "boolean"},
    },
}

VISION_TRACKED_TOP_LEVEL_FIELDS = (
    "success",
    "detected_quantity",
    "detected_label",
    "detected_unit",
    "max_value",
    "min_value",
    "confidence",
    "notes",
    "is_usable_for_prefill",
)


def build_vision_system_prompt(response_format: str) -> str:
    base = """You read finite element analysis screenshots.
Return exactly one valid JSON object.
Do not add markdown.
Do not add code fences.
Do not add any text before or after the JSON.
Use only the allowed keys.
Do not guess aggressively.
If the image is blurry, cropped, or ambiguous, lower confidence and mark the result unusable for prefill.
Prefer von Mises or equivalent stress when visible.
"""
    if response_format == "json_object":
        return base + "The first character must be '{' and the last character must be '}'."
    return base


def build_vision_user_text(filename: str | None = None) -> str:
    context = f"File name: {filename}.\n" if filename else ""
    return (
        context
        + "Analyze this single screenshot from MESA, Ansys, Abaqus, or another FEA tool.\n"
        + "Return detected_quantity as von_mises, equivalent_stress, or unknown.\n"
        + "Return detected_unit as a short unit token like MPa, Pa, psi, or unknown.\n"
        + "Return max_value only when it is readable from the legend, color bar, table, or explicit annotation.\n"
        + "Return min_value when readable, otherwise null.\n"
        + "Set success=false and is_usable_for_prefill=false when the maximum stress cannot be read reliably.\n"
        + "Keep notes short and factual, for example: Legend visible, Unit not clearly readable, Maximum value inferred from color bar, Image too low resolution."
    )
