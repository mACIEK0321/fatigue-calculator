"""Tests for the optional Groq adapter."""

from __future__ import annotations

import asyncio

import httpx
import pytest

from app.core.config import Settings
from app.models.schemas import AIComparisonErrorCode
from app.services.groq_client import GroqClient, GroqClientError

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


def valid_message_content() -> str:
    return """
    {
      "summary": "AI comparison summary",
      "assumptions": ["Assume room temperature."],
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
      "sn_curve_points": [[10000.0, 390.0], [1000000.0, 240.0]],
      "goodman_or_haigh_points": [[0.0, 229.6], [400.0, 0.0]],
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


def test_build_chat_payload_uses_json_schema_contract() -> None:
    client = GroqClient(build_settings())

    payload = client.build_chat_payload(build_comparison_input(), response_format="json_schema")

    assert payload["model"] == "openai/gpt-oss-20b"
    assert payload["response_format"]["type"] == "json_schema"
    assert payload["response_format"]["json_schema"]["strict"] is True
    assert payload["response_format"]["json_schema"]["schema"]["additionalProperties"] is False
    assert payload["messages"][0]["role"] == "system"
    assert "structured JSON response" in payload["messages"][0]["content"]
    assert "raw_model_name" in payload["messages"][1]["content"]


def test_build_chat_payload_disables_strict_for_non_strict_models() -> None:
    client = GroqClient(build_settings(model="llama-3.3-70b-versatile"))

    payload = client.build_chat_payload(build_comparison_input(), response_format="json_schema")

    assert payload["response_format"]["type"] == "json_schema"
    assert payload["response_format"]["json_schema"]["strict"] is False


def test_build_chat_payload_supports_json_object_mode() -> None:
    client = GroqClient(build_settings(response_format="json_object"))

    payload = client.build_chat_payload(build_comparison_input(), response_format="json_object")

    assert payload["response_format"] == {"type": "json_object"}
    assert "single valid JSON object" in payload["messages"][0]["content"]
    assert "Return exactly one JSON object and nothing else." in payload["messages"][1]["content"]


def test_compare_fatigue_analysis_parses_valid_json_schema_response(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = GroqClient(build_settings())
    captured_payloads: list[dict] = []
    install_fake_async_client(
        monkeypatch,
        responses=[build_completion_response(valid_message_content())],
        captured_payloads=captured_payloads,
    )

    result = asyncio.run(client.compare_fatigue_analysis(build_comparison_input()))

    assert result.result.summary == "AI comparison summary"
    assert result.result.life.cycles == 2200000.0
    assert result.result.sn_curve_points[0] == (10000.0, 390.0)
    assert result.metadata.response_format == "json_schema"
    assert result.metadata.attempted_response_formats == ["json_schema"]
    assert result.metadata.fallback_used is False
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
            build_completion_response(valid_message_content()),
        ],
        captured_payloads=captured_payloads,
    )

    result = asyncio.run(client.compare_fatigue_analysis(build_comparison_input()))

    assert result.result.summary == "AI comparison summary"
    assert result.metadata.response_format == "json_object"
    assert result.metadata.attempted_response_formats == ["json_schema", "json_object"]
    assert result.metadata.fallback_used is True
    assert captured_payloads[0]["response_format"]["type"] == "json_schema"
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
    assert exc_info.value.attempted_response_formats == ("json_object",)
    assert captured_payloads[0]["response_format"]["type"] == "json_object"
