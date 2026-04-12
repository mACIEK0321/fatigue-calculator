"""Prompt templates for the optional DeepSeek comparison adapter."""

from __future__ import annotations

import json

DEEPSEEK_SYSTEM_PROMPT = """You are a fatigue-analysis comparison engine.
Return exactly one JSON object and nothing else.
Do not return markdown.
Do not use code fences.
Do not add prose before or after the JSON.
Use only the schema requested by the user.
Keep all chart point collections numeric.
If a value cannot be derived confidently, set it to null and explain why in warnings.
Always include explicit assumptions and warnings, even if they are empty arrays.
Prefer quantitative outputs over qualitative wording.
"""


def build_deepseek_user_prompt(payload: dict) -> str:
    """Build the user prompt with a strict JSON contract and normalized inputs."""
    schema_description = {
        "summary": "string",
        "assumptions": ["string"],
        "interpreted_inputs": {
            "material_label": "string|null",
            "sn_curve_source": "string",
            "surface_factor": "number|null",
            "marin_factors": {
                "size_factor": "number",
                "load_factor": "number",
                "temperature_factor": "number",
                "reliability_factor": "number",
            },
            "notch_correction_factor": "number|null",
            "loading_blocks_count": "integer",
        },
        "basquin_parameters": {
            "sigma_f_prime": "number|null",
            "b": "number|null",
            "source": "string|null",
        },
        "modified_endurance_limit": "number|null",
        "stress_state": {
            "max_stress": "number",
            "min_stress": "number",
            "mean_stress": "number",
            "stress_amplitude": "number",
            "stress_ratio": "number|null",
        },
        "mean_stress_result": {
            "model_name": "goodman|gerber|soderberg|morrow",
            "effective_mean_stress": "number|null",
            "equivalent_alternating_stress": "number|null",
            "is_safe": "boolean|null",
        },
        "life": {
            "status": "finite|infinite",
            "cycles": "number|null",
            "reason": "string|null",
        },
        "safety_factor": "number|null",
        "sn_curve_points": [[1.0, 100.0]],
        "goodman_or_haigh_points": [[0.0, 100.0]],
        "warnings": ["string"],
        "raw_model_name": "string",
    }
    normalized_payload = json.dumps(payload, ensure_ascii=True, indent=2)
    expected_schema = json.dumps(schema_description, ensure_ascii=True, indent=2)

    return (
        "Analyze the following normalized fatigue input and return only JSON.\n"
        "Requirements:\n"
        "1. Use the exact JSON keys shown below.\n"
        "2. Do not include markdown.\n"
        "3. `sn_curve_points` must be an array of numeric [cycles, stress] pairs.\n"
        "4. `goodman_or_haigh_points` must be an array of numeric [mean_stress, stress_amplitude] pairs.\n"
        "5. Include explicit assumptions and warnings.\n"
        "6. Avoid vague descriptions without numbers.\n"
        "7. Respect the requested point limit in the input flags.\n"
        "8. Use `raw_model_name` for the exact upstream model identifier you are running.\n\n"
        f"Expected JSON schema:\n{expected_schema}\n\n"
        f"Normalized fatigue input:\n{normalized_payload}"
    )
