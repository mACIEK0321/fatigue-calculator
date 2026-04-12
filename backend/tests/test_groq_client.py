"""Tests for the optional Groq adapter."""

from __future__ import annotations

import asyncio

import httpx
import pytest

from app.core.config import Settings
from app.models.schemas import AIComparisonErrorCode
from app.services.groq_client import GroqClient, GroqClientError
from app.services.groq_prompt import (
    GROQ_DEFAULT_SCHEMA_PROFILE,
    GROQ_FALLBACK_SCHEMA_PROFILE,
    GROQ_FULL_RESPONSE_JSON_SCHEMA,
    GROQ_MINIMAL_RESPONSE_JSON_SCHEMA,
)

REQUEST = httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions")


def build_settings(*, response_format: str = "auto", model: str = "openai/gpt-oss-20b") -> Settings:
    return Settings(
        ENVIRONMENT="development",
        ALLOWED_ORIGINS=["http://localhost:3000"],
        GROQ_API_KEY="test-key",
        GROQ_BASE_URL="https://api.groq.com/openai/v1",
        GROQ_MODEL=model,
        GROQ_RESPONSE_FORMAT=response_format,
        GROQ_TIMEOUT_SECONDS=5.0,
    )


def build_comparison_input() -> dict:
    return {
        "material": {
            "uts": 600.0,
            "yield_strength": 400.0,
            "endurance_limit": 280.0,
            "elastic_modulus": 210.0,
        },
        "sn_curve_source": {
            "mode": "material_basquin",
            "input_points": [],
            "resolved_basquin_parameters": {
                "sigma_f_prime": 1050.0,
                "b": -0.09,
                "source": "material_default_from_uts",
            },
            "resolved_fit": None,
        },
        "stress_state": {
            "input_max_stress": 180.0,
            "input_min_stress": -120.0,
            "corrected_max_stress": 180.0,
            "corrected_min_stress": -120.0,
            "stress_amplitude": 150.0,
            "mean_stress": 30.0,
            "stress_ratio": -0.667,
        },
        "surface_factor": {
            "mode": "empirical_surface_finish",
            "finish_type": "machined",
            "effective_ka": 0.82,
        },
        "marin_factors": {
            "size_factor": 1.0,
            "load_factor": 1.0,
            "temperature_factor": 1.0,
            "reliability_factor": 1.0,
        },
        "selected_mean_stress_model": "goodman",
        "notch_correction": None,
        "loading_blocks": [],
        "flags": {
            "enabled": True,
            "include_interpreted_inputs": True,
            "include_sn_curve_points": True,
            "include_goodman_or_haigh_points": True,
            "max_points_per_series": 25,
        },
    }


def valid_full_message_content() -> str:
    return """
    {
      "summary": "AI comparison summary",
      "assumptions": [],
      "interpreted_inputs": {
        "material_label": null,
        "sn_curve_source": "material_basquin",
        "surface_factor": 0.82,
        "marin_factors": {
          "size_factor": 1.0,
          "load_factor": 1.0,
          "temperature_factor": 1.0,
          "reliability_factor": 1.0
        },
        "notch_correction_factor": null,
        "loading_blocks_count": 0
      },
      "basquin_parameters": {
        "sigma_f_prime": 1050.0,
        "b": -0.09,
        "source": "material_default_from_uts"
      },
      "modified_endurance_limit": 229.6,
      "stress_state": {
        "max_stress": 180.0,
        "min_stress": -120.0,
        "mean_stress": 30.0,
        "stress_amplitude": 150.0,
        "stress_ratio": -0.667
      },
      "mean_stress_result": {
        "model_name": "goodman",
        "effective_mean_stress": 30.0,
        "equivalent_alternating_stress": 158.3,
        "is_safe": true
      },
      "life": {
        "status": "finite",
        "cycles": 2200000.0,
        "reason": "Computed from Basquin response."
      },
      "safety_factor": 1.12,
      "sn_curve_points": [{"x": 10000.0, "y": 390.0}, {"x": 1000000.0, "y": 240.0}],
      "goodman_or_haigh_points": [{"x": 0.0, "y": 229.6}, {"x": 400.0, "y": 0.0}],
      "warnings": [],
      "raw_model_name": "openai/gpt-oss-20b"
    }
    """


def valid_minimal_message_content() -> str:
    return """
    {
      "summary": "AI comparison summary",
      "basquin_parameters": {
        "sigma_f_prime": 1050.0,
        "b": -0.09,
        "source": "material_default_from_uts"
      },
      "modified_endurance_limit": 229.6,
      "stress_state": {
        "max_stress": 180.0,
        "min_stress": -120.0,
        "mean_stress": 30.0,
        "stress_amplitude": 150.0,
        "stress_ratio": -0.667
      },
      "life": {
        "status": "finite",
        "cycles": 2200000.0,
        "reason": "Computed from Basquin response."
      },
      "safety_factor": 1.12,
      "warnings": [],
      "raw_model_name": "openai/gpt-oss-20b"
    }
    """


def full_message_with_sn_curve_shape_error() -> str:
    return """
    {
      "summary": "AI comparison summary",
      "assumptions": [],
      "interpreted_inputs": {
        "material_label": null,
        "sn_curve_source": "material_basquin",
        "surface_factor": 0.82,
        "marin_factors": {
          "size_factor": 1.0,
          "load_factor": 1.0,
          "temperature_factor": 1.0,
          "reliability_factor": 1.0
        },
        "notch_correction_factor": null,
        "loading_blocks_count": 0
      },
      "basquin_parameters": {
        "sigma_f_prime": 1050.0,
        "b": -0.09,
        "source": "material_default_from_uts"
      },
      "modified_endurance_limit": 229.6,
      "stress_state": {
        "max_stress": 180.0,
        "min_stress": -120.0,
        "mean_stress": 30.0,
        "stress_amplitude": 150.0,
        "stress_ratio": -0.667
      },
      "mean_stress_result": {
        "model_name": "goodman",
        "effective_mean_stress": 30.0,
        "equivalent_alternating_stress": 158.3,
        "is_safe": true
      },
      "life": {
        "status": "finite",
        "cycles": 2200000.0,
        "reason": "Computed from Basquin response."
      },
      "safety_factor": 1.12,
      "sn_curve_points": [{"x": 10000.0}],
      "goodman_or_haigh_points": [{"x": 0.0, "y": 229.6}],
      "warnings": [],
      "raw_model_name": "openai/gpt-oss-20b"
    }
    """


def build_completion_response(content: str) -> httpx.Response:
    return httpx.Response(
        200,
        request=REQUEST,
        json={
            "choices": [
                {
                    "message": {
                        "content": content,
                    }
                }
            ]
        },
    )


def install_fake_async_client(
    monkeypatch: pytest.MonkeyPatch,
    responses: list[httpx.Response | Exception],
    captured_payloads: list[dict],
) -> None:
    class FakeAsyncClient:
        def __init__(self, *args, **kwargs) -> None:
            pass

        async def __aenter__(self) -> "FakeAsyncClient":
            return self

        async def __aexit__(self, exc_type, exc, tb) -> None:
            return None

        async def post(self, *args, **kwargs) -> httpx.Response:
            captured_payloads.append(kwargs["json"])
            next_item = responses.pop(0)
            if isinstance(next_item, Exception):
                raise next_item
            return next_item

    monkeypatch.setattr("app.services.groq_client.httpx.AsyncClient", FakeAsyncClient)


def assert_object_schema_is_groq_strict(schema: dict) -> None:
    schema_type = schema.get("type")
    normalized_types = schema_type if isinstance(schema_type, list) else [schema_type]

    if "object" in normalized_types:
        properties = schema["properties"]
        assert schema["additionalProperties"] is False
        assert sorted(schema["required"]) == sorted(properties.keys())
        for property_schema in properties.values():
            if isinstance(property_schema, dict):
                assert_object_schema_is_groq_strict(property_schema)

    if "array" in normalized_types:
        items = schema.get("items")
        if isinstance(items, dict):
            assert_object_schema_is_groq_strict(items)


def test_full_response_schema_is_valid_for_groq_strict_mode() -> None:
    assert_object_schema_is_groq_strict(GROQ_FULL_RESPONSE_JSON_SCHEMA)


def test_minimal_response_schema_is_valid_for_groq_strict_mode() -> None:
    assert_object_schema_is_groq_strict(GROQ_MINIMAL_RESPONSE_JSON_SCHEMA)


def test_build_chat_payload_uses_full_json_schema_contract() -> None:
    client = GroqClient(build_settings())

    payload = client.build_chat_payload(build_comparison_input(), response_format="json_schema")

    assert payload["model"] == "openai/gpt-oss-20b"
    assert payload["response_format"]["type"] == "json_schema"
    assert payload["response_format"]["json_schema"]["strict"] is True
    assert payload["response_format"]["json_schema"]["schema"] == GROQ_FULL_RESPONSE_JSON_SCHEMA
    assert payload["messages"][0]["role"] == "system"
    assert "Every listed key must be present." in payload["messages"][1]["content"]
    assert "raw_model_name" in payload["messages"][1]["content"]


def test_build_chat_payload_disables_strict_for_non_strict_models() -> None:
    client = GroqClient(build_settings(model="llama-3.3-70b-versatile"))

    payload = client.build_chat_payload(build_comparison_input(), response_format="json_schema")

    assert payload["response_format"]["type"] == "json_schema"
    assert payload["response_format"]["json_schema"]["strict"] is False


def test_build_chat_payload_supports_json_object_mode_with_minimal_profile() -> None:
    client = GroqClient(build_settings(response_format="json_object"))

    payload = client.build_chat_payload(build_comparison_input(), response_format="json_object")

    assert payload["response_format"] == {"type": "json_object"}
    assert "first character must be '{'" in payload["messages"][0]["content"]
    assert "Keep the response minimal." in payload["messages"][1]["content"]


def test_compare_fatigue_analysis_parses_valid_full_json_schema_response(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = GroqClient(build_settings())
    captured_payloads: list[dict] = []
    install_fake_async_client(
        monkeypatch,
        responses=[build_completion_response(valid_full_message_content())],
        captured_payloads=captured_payloads,
    )

    result = asyncio.run(client.compare_fatigue_analysis(build_comparison_input()))

    assert result.result.summary == "AI comparison summary"
    assert result.result.life.cycles == 2200000.0
    assert result.result.sn_curve_points[0].x == 10000.0
    assert result.result.sn_curve_points[0].y == 390.0
    assert result.result.interpreted_inputs is not None
    assert result.result.mean_stress_result is not None
    assert result.metadata.response_format == "json_schema"
    assert result.metadata.schema_profile == GROQ_DEFAULT_SCHEMA_PROFILE
    assert result.metadata.schema_simplified is False
    assert result.metadata.attempted_response_formats == ["json_schema"]
    assert result.metadata.fallback_used is False
    assert result.metadata.omitted_or_null_fields == []
    assert result.metadata.problematic_fields == []
    assert result.metadata.validation_issue_count == 0
    assert captured_payloads[0]["response_format"]["type"] == "json_schema"


def test_compare_fatigue_analysis_falls_back_to_json_object_on_unsupported_json_schema(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = GroqClient(build_settings())
    captured_payloads: list[dict] = []
    install_fake_async_client(
        monkeypatch,
        responses=[
            httpx.Response(
                400,
                request=REQUEST,
                json={
                    "error": {
                        "message": 'This model does not support response format "json_schema".'
                    }
                },
            ),
            build_completion_response(valid_minimal_message_content()),
        ],
        captured_payloads=captured_payloads,
    )

    result = asyncio.run(client.compare_fatigue_analysis(build_comparison_input()))

    assert result.result.summary == "AI comparison summary"
    assert result.metadata.response_format == "json_object"
    assert result.metadata.schema_profile == GROQ_FALLBACK_SCHEMA_PROFILE
    assert result.metadata.schema_simplified is True
    assert result.metadata.attempted_response_formats == ["json_schema", "json_object"]
    assert result.metadata.fallback_used is True
    assert "assumptions" in result.metadata.omitted_or_null_fields
    assert captured_payloads[0]["response_format"]["type"] == "json_schema"
    assert captured_payloads[1]["response_format"]["type"] == "json_object"


def test_compare_fatigue_analysis_falls_back_to_json_object_on_provider_json_validation_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = GroqClient(build_settings())
    captured_payloads: list[dict] = []
    install_fake_async_client(
        monkeypatch,
        responses=[
            httpx.Response(
                400,
                request=REQUEST,
                json={"error": {"message": "Failed to validate JSON. Please adjust your prompt."}},
            ),
            build_completion_response(valid_minimal_message_content()),
        ],
        captured_payloads=captured_payloads,
    )

    result = asyncio.run(client.compare_fatigue_analysis(build_comparison_input()))

    assert result.metadata.response_format == "json_object"
    assert result.metadata.schema_profile == GROQ_FALLBACK_SCHEMA_PROFILE
    assert result.metadata.fallback_used is True
    assert captured_payloads[1]["response_format"]["type"] == "json_object"


def test_compare_fatigue_analysis_preserves_validation_diagnostics_when_fallback_succeeds(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = GroqClient(build_settings())
    captured_payloads: list[dict] = []
    install_fake_async_client(
        monkeypatch,
        responses=[
            build_completion_response(full_message_with_sn_curve_shape_error()),
            build_completion_response(valid_minimal_message_content()),
        ],
        captured_payloads=captured_payloads,
    )

    result = asyncio.run(client.compare_fatigue_analysis(build_comparison_input()))

    assert result.metadata.response_format == "json_object"
    assert result.metadata.schema_profile == GROQ_FALLBACK_SCHEMA_PROFILE
    assert result.metadata.problematic_fields == ["sn_curve_points"]
    assert result.metadata.validation_issue_count == 1
    assert result.metadata.validation_issues[0].field_path == "sn_curve_points[0].y"
    assert result.metadata.validation_issues[0].missing is True
    assert result.metadata.validation_issues[0].expected_type == "number"
    assert captured_payloads[1]["response_format"]["type"] == "json_object"


def test_compare_fatigue_analysis_validates_fallback_json_object_response(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = GroqClient(build_settings())
    captured_payloads: list[dict] = []
    install_fake_async_client(
        monkeypatch,
        responses=[
            httpx.Response(
                400,
                request=REQUEST,
                json={
                    "error": {
                        "message": 'This model does not support response format "json_schema".'
                    }
                },
            ),
            build_completion_response('{"summary":"missing required fields"}'),
        ],
        captured_payloads=captured_payloads,
    )

    with pytest.raises(GroqClientError) as exc_info:
        asyncio.run(client.compare_fatigue_analysis(build_comparison_input()))

    assert exc_info.value.code == AIComparisonErrorCode.schema_validation
    assert exc_info.value.attempted_response_formats == ("json_schema", "json_object")
    assert exc_info.value.response_format == "json_object"
    assert exc_info.value.schema_profile == GROQ_FALLBACK_SCHEMA_PROFILE
    assert exc_info.value.fallback_used is True
    assert captured_payloads[1]["response_format"]["type"] == "json_object"


def test_compare_fatigue_analysis_rejects_invalid_json_content_after_fallback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = GroqClient(build_settings())
    captured_payloads: list[dict] = []
    install_fake_async_client(
        monkeypatch,
        responses=[
            httpx.Response(
                400,
                request=REQUEST,
                json={
                    "error": {
                        "message": 'This model does not support response format "json_schema".'
                    }
                },
            ),
            build_completion_response("not-json"),
        ],
        captured_payloads=captured_payloads,
    )

    with pytest.raises(GroqClientError) as exc_info:
        asyncio.run(client.compare_fatigue_analysis(build_comparison_input()))

    assert exc_info.value.code == AIComparisonErrorCode.invalid_json
    assert exc_info.value.attempted_response_formats == ("json_schema", "json_object")
    assert exc_info.value.response_format == "json_object"
    assert exc_info.value.schema_profile == GROQ_FALLBACK_SCHEMA_PROFILE
    assert exc_info.value.fallback_used is True
    assert captured_payloads[1]["response_format"]["type"] == "json_object"


def test_compare_fatigue_analysis_maps_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    client = GroqClient(build_settings())
    captured_payloads: list[dict] = []
    install_fake_async_client(
        monkeypatch,
        responses=[httpx.ReadTimeout("boom")],
        captured_payloads=captured_payloads,
    )

    with pytest.raises(GroqClientError) as exc_info:
        asyncio.run(client.compare_fatigue_analysis(build_comparison_input()))

    assert exc_info.value.code == AIComparisonErrorCode.timeout
    assert exc_info.value.retriable is True
    assert exc_info.value.schema_profile == GROQ_DEFAULT_SCHEMA_PROFILE
    assert exc_info.value.attempted_response_formats == ("json_schema",)


def test_compare_fatigue_analysis_includes_upstream_http_message(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = GroqClient(build_settings())
    captured_payloads: list[dict] = []
    install_fake_async_client(
        monkeypatch,
        responses=[
            httpx.Response(
                402,
                request=REQUEST,
                json={"error": {"message": "Insufficient Credits"}},
            )
        ],
        captured_payloads=captured_payloads,
    )

    with pytest.raises(GroqClientError) as exc_info:
        asyncio.run(client.compare_fatigue_analysis(build_comparison_input()))

    assert exc_info.value.code == AIComparisonErrorCode.http_error
    assert "Insufficient Credits" in exc_info.value.message
    assert exc_info.value.schema_profile == GROQ_DEFAULT_SCHEMA_PROFILE
    assert exc_info.value.attempted_response_formats == ("json_schema",)


def test_compare_fatigue_analysis_rejects_invalid_json_content(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = GroqClient(build_settings(response_format="json_object"))
    captured_payloads: list[dict] = []
    install_fake_async_client(
        monkeypatch,
        responses=[build_completion_response("not-json")],
        captured_payloads=captured_payloads,
    )

    with pytest.raises(GroqClientError) as exc_info:
        asyncio.run(client.compare_fatigue_analysis(build_comparison_input()))

    assert exc_info.value.code == AIComparisonErrorCode.invalid_json
    assert exc_info.value.schema_profile == GROQ_FALLBACK_SCHEMA_PROFILE
    assert exc_info.value.attempted_response_formats == ("json_object",)
    assert captured_payloads[0]["response_format"]["type"] == "json_object"


@pytest.mark.parametrize(
    ("content", "expected_field", "expected_type", "expected_actual_type", "expected_error_type"),
    [
        (
            '{"summary":"ok","basquin_parameters":{"sigma_f_prime":1050.0,"b":-0.09,"source":"material_default_from_uts"},"modified_endurance_limit":229.6,"stress_state":{"max_stress":180.0,"min_stress":-120.0,"mean_stress":30.0,"stress_amplitude":150.0,"stress_ratio":-0.667},"safety_factor":1.12,"warnings":[],"raw_model_name":"openai/gpt-oss-20b"}',
            "life",
            "object",
            None,
            "missing",
        ),
        (
            '{"summary":"ok","basquin_parameters":{"sigma_f_prime":1050.0,"b":-0.09,"source":"material_default_from_uts"},"modified_endurance_limit":229.6,"stress_state":{"max_stress":180.0,"min_stress":-120.0,"mean_stress":30.0,"stress_amplitude":150.0,"stress_ratio":-0.667},"life":{"status":"finite","cycles":2200000.0,"reason":"Computed"},"safety_factor":"high","warnings":[],"raw_model_name":"openai/gpt-oss-20b"}',
            "safety_factor",
            "number",
            "string",
            "float_parsing",
        ),
        (
            '{"summary":"ok","basquin_parameters":{"sigma_f_prime":1050.0,"b":-0.09,"source":"material_default_from_uts"},"modified_endurance_limit":229.6,"stress_state":{"max_stress":180.0,"min_stress":-120.0,"mean_stress":30.0,"stress_amplitude":150.0,"stress_ratio":-0.667},"life":{"status":"finite","cycles":2200000.0,"reason":"Computed"},"safety_factor":1.12,"warnings":"none","raw_model_name":"openai/gpt-oss-20b"}',
            "warnings",
            "array<string>",
            "string",
            "list_type",
        ),
    ],
)
def test_compare_fatigue_analysis_reports_validation_issue_details(
    monkeypatch: pytest.MonkeyPatch,
    content: str,
    expected_field: str,
    expected_type: str,
    expected_actual_type: str | None,
    expected_error_type: str,
) -> None:
    client = GroqClient(build_settings(response_format="json_object"))
    captured_payloads: list[dict] = []
    install_fake_async_client(
        monkeypatch,
        responses=[build_completion_response(content)],
        captured_payloads=captured_payloads,
    )

    with pytest.raises(GroqClientError) as exc_info:
        asyncio.run(client.compare_fatigue_analysis(build_comparison_input()))

    assert exc_info.value.code == AIComparisonErrorCode.schema_validation
    assert exc_info.value.problematic_fields[0] == expected_field
    assert exc_info.value.validation_issues[0].field_path == expected_field
    assert exc_info.value.validation_issues[0].expected_type == expected_type
    assert exc_info.value.validation_issues[0].actual_type == expected_actual_type
    assert exc_info.value.validation_issues[0].error_type == expected_error_type
    assert exc_info.value.validation_issues[0].missing is (expected_error_type == "missing")
    assert captured_payloads[0]["response_format"]["type"] == "json_object"


def test_compare_fatigue_analysis_reports_bad_sn_curve_point_shape(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = GroqClient(build_settings(response_format="json_object"))
    captured_payloads: list[dict] = []
    install_fake_async_client(
        monkeypatch,
        responses=[
            build_completion_response(
                '{"summary":"ok","assumptions":[],"interpreted_inputs":null,"basquin_parameters":{"sigma_f_prime":1050.0,"b":-0.09,"source":"material_default_from_uts"},"modified_endurance_limit":229.6,"stress_state":{"max_stress":180.0,"min_stress":-120.0,"mean_stress":30.0,"stress_amplitude":150.0,"stress_ratio":-0.667},"mean_stress_result":null,"life":{"status":"finite","cycles":2200000.0,"reason":"Computed"},"safety_factor":1.12,"sn_curve_points":[{"x":10000.0}],"goodman_or_haigh_points":null,"warnings":[],"raw_model_name":"openai/gpt-oss-20b"}'
            )
        ],
        captured_payloads=captured_payloads,
    )

    with pytest.raises(GroqClientError) as exc_info:
        asyncio.run(client.compare_fatigue_analysis(build_comparison_input()))

    assert exc_info.value.code == AIComparisonErrorCode.schema_validation
    assert exc_info.value.problematic_fields[0] == "sn_curve_points"
    assert exc_info.value.validation_issues[0].field_path == "sn_curve_points[0].y"
    assert exc_info.value.validation_issues[0].expected_type == "number"
    assert exc_info.value.validation_issues[0].missing is True
    assert exc_info.value.validation_issues[0].wrong_shape is True


def test_compare_fatigue_analysis_accepts_minimal_schema_in_json_object_mode(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = GroqClient(build_settings(response_format="json_object"))
    captured_payloads: list[dict] = []
    install_fake_async_client(
        monkeypatch,
        responses=[build_completion_response(valid_minimal_message_content())],
        captured_payloads=captured_payloads,
    )

    result = asyncio.run(client.compare_fatigue_analysis(build_comparison_input()))

    assert result.metadata.response_format == "json_object"
    assert result.metadata.schema_profile == GROQ_FALLBACK_SCHEMA_PROFILE
    assert result.metadata.schema_simplified is True
    assert result.result.summary == "AI comparison summary"
    assert result.result.warnings == []
    assert captured_payloads[0]["response_format"]["type"] == "json_object"
