"""Tests for the optional DeepSeek adapter."""

from __future__ import annotations

import asyncio

import httpx
import pytest

from app.core.config import Settings
from app.models.schemas import AIComparisonErrorCode
from app.services.deepseek_client import DeepSeekClient, DeepSeekClientError


REQUEST = httpx.Request("POST", "https://api.deepseek.com/chat/completions")


def build_settings() -> Settings:
    return Settings(
        ENVIRONMENT="development",
        ALLOWED_ORIGINS=["http://localhost:3000"],
        DEEPSEEK_API_KEY="test-key",
        DEEPSEEK_BASE_URL="https://api.deepseek.com",
        DEEPSEEK_MODEL="deepseek-chat",
        DEEPSEEK_TIMEOUT_SECONDS=5.0,
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


def test_build_chat_payload_uses_json_output_contract() -> None:
    client = DeepSeekClient(build_settings())

    payload = client.build_chat_payload(build_comparison_input())

    assert payload["model"] == "deepseek-chat"
    assert payload["response_format"] == {"type": "json_object"}
    assert payload["messages"][0]["role"] == "system"
    assert "Return exactly one JSON object" in payload["messages"][0]["content"]
    assert "sn_curve_points" in payload["messages"][1]["content"]


def test_compare_fatigue_analysis_parses_valid_json(monkeypatch: pytest.MonkeyPatch) -> None:
    client = DeepSeekClient(build_settings())

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs) -> None:
            pass

        async def __aenter__(self) -> "FakeAsyncClient":
            return self

        async def __aexit__(self, exc_type, exc, tb) -> None:
            return None

        async def post(self, *args, **kwargs) -> httpx.Response:
            return httpx.Response(
                200,
                request=REQUEST,
                json={
                    "choices": [
                        {
                            "message": {
                                "content": """
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
                                  "raw_model_name": "deepseek-chat"
                                }
                                """,
                            }
                        }
                    ]
                },
            )

    monkeypatch.setattr("app.services.deepseek_client.httpx.AsyncClient", FakeAsyncClient)

    result = asyncio.run(client.compare_fatigue_analysis(build_comparison_input()))

    assert result.summary == "AI comparison summary"
    assert result.life.cycles == 2200000.0
    assert result.sn_curve_points[0] == (10000.0, 390.0)


def test_compare_fatigue_analysis_maps_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    client = DeepSeekClient(build_settings())

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs) -> None:
            pass

        async def __aenter__(self) -> "FakeAsyncClient":
            return self

        async def __aexit__(self, exc_type, exc, tb) -> None:
            return None

        async def post(self, *args, **kwargs) -> httpx.Response:
            raise httpx.ReadTimeout("boom")

    monkeypatch.setattr("app.services.deepseek_client.httpx.AsyncClient", FakeAsyncClient)

    with pytest.raises(DeepSeekClientError) as exc_info:
        asyncio.run(client.compare_fatigue_analysis(build_comparison_input()))

    assert exc_info.value.code == AIComparisonErrorCode.timeout
    assert exc_info.value.retriable is True


def test_compare_fatigue_analysis_rejects_schema_mismatch(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = DeepSeekClient(build_settings())

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs) -> None:
            pass

        async def __aenter__(self) -> "FakeAsyncClient":
            return self

        async def __aexit__(self, exc_type, exc, tb) -> None:
            return None

        async def post(self, *args, **kwargs) -> httpx.Response:
            return httpx.Response(
                200,
                request=REQUEST,
                json={
                    "choices": [
                        {
                            "message": {
                                "content": '{"summary":"missing required fields"}',
                            }
                        }
                    ]
                },
            )

    monkeypatch.setattr("app.services.deepseek_client.httpx.AsyncClient", FakeAsyncClient)

    with pytest.raises(DeepSeekClientError) as exc_info:
        asyncio.run(client.compare_fatigue_analysis(build_comparison_input()))

    assert exc_info.value.code == AIComparisonErrorCode.schema_validation


def test_compare_fatigue_analysis_rejects_invalid_json_content(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = DeepSeekClient(build_settings())

    class FakeAsyncClient:
        def __init__(self, *args, **kwargs) -> None:
            pass

        async def __aenter__(self) -> "FakeAsyncClient":
            return self

        async def __aexit__(self, exc_type, exc, tb) -> None:
            return None

        async def post(self, *args, **kwargs) -> httpx.Response:
            return httpx.Response(
                200,
                request=REQUEST,
                json={
                    "choices": [
                        {
                            "message": {
                                "content": "not-json",
                            }
                        }
                    ]
                },
            )

    monkeypatch.setattr("app.services.deepseek_client.httpx.AsyncClient", FakeAsyncClient)

    with pytest.raises(DeepSeekClientError) as exc_info:
        asyncio.run(client.compare_fatigue_analysis(build_comparison_input()))

    assert exc_info.value.code == AIComparisonErrorCode.invalid_json
