"""API-level tests for fatigue analysis endpoints."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.schemas import (
    AIComparisonMetadata,
    AIComparisonResult,
    AIComparisonValidationIssue,
    AIInterpretationMetadata,
    AIInterpretationResult,
)
from app.routers import analysis
from app.services.groq_client import (
    GroqComparisonResponse,
    GroqInterpretationResponse,
)

client = TestClient(app)


def valid_payload() -> dict:
    return {
        "max_stress": 180.0,
        "min_stress": -120.0,
        "material": {
            "uts": 600.0,
            "yield_strength": 400.0,
            "endurance_limit": 280.0,
            "elastic_modulus": 210.0,
        },
        "sn_curve_source": {
            "mode": "material_basquin",
        },
        "surface_factor_selection": {
            "mode": "empirical_surface_finish",
            "finish_type": "machined",
        },
        "marin_factors": {
            "size_factor": 1.0,
            "load_factor": 1.0,
            "temperature_factor": 1.0,
            "reliability_factor": 1.0,
        },
        "selected_mean_stress_model": "goodman",
    }


def compare_payload(enabled: bool = True) -> dict:
    payload = valid_payload()
    payload["ai_comparison"] = {
        "enabled": enabled,
        "include_interpreted_inputs": True,
        "include_sn_curve_points": True,
        "include_goodman_or_haigh_points": True,
        "max_points_per_series": 25,
    }
    return payload


def interpret_payload(enabled: bool = True) -> dict:
    payload = valid_payload()
    payload["ai_interpretation"] = {
        "enabled": enabled,
    }
    payload["vision_context"] = {
        "success": True,
        "detected_quantity": "von_mises",
        "detected_label": "Equivalent Stress",
        "detected_unit": "MPa",
        "max_value": 182.4,
        "min_value": 12.0,
        "confidence": "high",
        "notes": ["Legend visible"],
        "is_usable_for_prefill": True,
    }
    return payload


def test_analyze_endpoint_returns_new_contract() -> None:
    response = client.post("/api/analyze", json=valid_payload())

    assert response.status_code == 200
    payload = response.json()
    assert payload["selected_life"]["status"] == "infinite"
    assert payload["sn_curve_source"]["mode"] == "material_basquin"
    assert "stress_state" in payload
    assert "sn_chart" in payload
    assert "haigh_diagram" in payload


def test_analyze_endpoint_supports_points_fit() -> None:
    payload = valid_payload()
    payload["sn_curve_source"] = {
        "mode": "points_fit",
        "points": [
            {"cycles": 1e4, "stress": 420.0},
            {"cycles": 1e5, "stress": 320.0},
            {"cycles": 1e6, "stress": 245.0},
        ],
    }

    response = client.post("/api/analyze", json=payload)

    assert response.status_code == 200
    assert response.json()["sn_curve_source"]["mode"] == "points_fit"


def test_compare_endpoint_returns_native_and_ai_sections(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeGroqClient:
        async def compare_fatigue_analysis(self, comparison_input: dict):
            assert comparison_input["surface_factor"]["effective_ka"] > 0
            return GroqComparisonResponse(
                result=AIComparisonResult(
                    summary="AI comparison summary",
                    assumptions=[],
                    interpreted_inputs={
                        "material_label": None,
                        "sn_curve_source": "material_basquin",
                        "surface_factor": 0.82,
                        "marin_factors": {
                            "size_factor": 1.0,
                            "load_factor": 1.0,
                            "temperature_factor": 1.0,
                            "reliability_factor": 1.0,
                        },
                        "notch_correction_factor": None,
                        "loading_blocks_count": 0,
                    },
                    basquin_parameters={
                        "sigma_f_prime": 1050.0,
                        "b": -0.09,
                        "source": "material_default_from_uts",
                    },
                    modified_endurance_limit=229.6,
                    stress_state={
                        "max_stress": 180.0,
                        "min_stress": -120.0,
                        "mean_stress": 30.0,
                        "stress_amplitude": 150.0,
                        "stress_ratio": -0.667,
                    },
                    mean_stress_result={
                        "model_name": "goodman",
                        "effective_mean_stress": 30.0,
                        "equivalent_alternating_stress": 158.3,
                        "is_safe": True,
                    },
                    life={
                        "status": "finite",
                        "cycles": 2200000.0,
                        "reason": "Computed from Basquin response.",
                    },
                    safety_factor=1.12,
                    sn_curve_points=[{"x": 1e4, "y": 390.0}, {"x": 1e6, "y": 240.0}],
                    goodman_or_haigh_points=[{"x": 0.0, "y": 229.6}, {"x": 600.0, "y": 0.0}],
                    warnings=[],
                    raw_model_name="openai/gpt-oss-20b",
                ),
                metadata=AIComparisonMetadata(
                    response_format="json_schema",
                    schema_profile="full_v1",
                    schema_simplified=False,
                    attempted_response_formats=["json_schema"],
                    fallback_used=False,
                    omitted_or_null_fields=[],
                    problematic_fields=[],
                    validation_issue_count=0,
                    validation_issues=[],
                ),
            )

    monkeypatch.setattr(analysis, "get_groq_client", lambda: FakeGroqClient())

    response = client.post("/api/analyze/compare", json=compare_payload())

    assert response.status_code == 200
    body = response.json()
    assert "native_analysis" in body
    assert body["native_analysis"]["selected_life"]["status"] == "infinite"
    assert body["ai_comparison"]["status"] == "success"
    assert body["ai_comparison"]["provider"] == "groq"
    assert body["ai_comparison"]["result"]["raw_model_name"] == "openai/gpt-oss-20b"
    assert body["ai_comparison"]["metadata"]["response_format"] == "json_schema"
    assert body["ai_comparison"]["metadata"]["schema_profile"] == "full_v1"
    assert body["ai_comparison"]["metadata"]["schema_simplified"] is False
    assert body["ai_comparison"]["metadata"]["validation_issue_count"] == 0


def test_compare_endpoint_preserves_native_analysis_when_ai_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeGroqClient:
        async def compare_fatigue_analysis(self, comparison_input: dict):
            raise analysis.GroqClientError(
                code=analysis.AIComparisonErrorCode.timeout,
                message="AI comparison timed out before a valid response arrived.",
                retriable=True,
            )

    monkeypatch.setattr(analysis, "get_groq_client", lambda: FakeGroqClient())

    response = client.post("/api/analyze/compare", json=compare_payload())

    assert response.status_code == 200
    body = response.json()
    assert body["native_analysis"]["selected_life"]["status"] == "infinite"
    assert body["ai_comparison"]["status"] == "error"
    assert body["ai_comparison"]["error"]["code"] == "timeout"
    assert body["ai_comparison"]["error"]["retriable"] is True
    assert body["ai_comparison"]["metadata"]["attempted_response_formats"] == []
    assert body["ai_comparison"]["metadata"]["schema_simplified"] is False
    assert body["ai_comparison"]["metadata"]["validation_issue_count"] == 0


def test_compare_endpoint_marks_skipped_when_ai_disabled() -> None:
    response = client.post("/api/analyze/compare", json=compare_payload(enabled=False))

    assert response.status_code == 200
    body = response.json()
    assert body["native_analysis"]["selected_life"]["status"] == "infinite"
    assert body["ai_comparison"]["status"] == "skipped"
    assert body["ai_comparison"]["error"]["code"] == "disabled"
    assert body["ai_comparison"]["metadata"]["fallback_used"] is False
    assert body["ai_comparison"]["metadata"]["schema_profile"] == "full_v1"
    assert body["ai_comparison"]["metadata"]["validation_issue_count"] == 0


def test_compare_endpoint_preserves_native_analysis_when_ai_schema_validation_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeGroqClient:
        async def compare_fatigue_analysis(self, comparison_input: dict):
            raise analysis.GroqClientError(
                code=analysis.AIComparisonErrorCode.schema_validation,
                message="The AI provider returned JSON that did not match the expected schema.",
                retriable=False,
                response_format="json_object",
                schema_profile="minimal_v1",
                schema_simplified=True,
                attempted_response_formats=("json_schema", "json_object"),
                fallback_used=True,
                problematic_fields=("warnings",),
                validation_issues=(
                    AIComparisonValidationIssue(
                        field_path="warnings",
                        expected_type="array<string>",
                        actual_type="string",
                        error_type="list_type",
                        missing=False,
                        wrong_shape=True,
                    ),
                ),
            )

    monkeypatch.setattr(analysis, "get_groq_client", lambda: FakeGroqClient())

    response = client.post("/api/analyze/compare", json=compare_payload())

    assert response.status_code == 200
    body = response.json()
    assert body["native_analysis"]["selected_life"]["status"] == "infinite"
    assert body["ai_comparison"]["status"] == "error"
    assert body["ai_comparison"]["error"]["code"] == "schema_validation"
    assert body["ai_comparison"]["metadata"]["schema_profile"] == "minimal_v1"
    assert body["ai_comparison"]["metadata"]["problematic_fields"] == ["warnings"]
    assert body["ai_comparison"]["metadata"]["validation_issue_count"] == 1
    assert body["ai_comparison"]["metadata"]["validation_issues"][0]["field_path"] == "warnings"


def test_interpret_endpoint_returns_native_and_ai_sections(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeGroqClient:
        async def interpret_fatigue_analysis(self, interpretation_input: dict):
            assert interpretation_input["vision_context"]["max_value"] == 182.4
            return GroqInterpretationResponse(
                result=AIInterpretationResult(
                    summary="Finite-life result is governed mainly by mean-stress corrected amplitude.",
                    key_findings=[
                        "Selected Goodman result remains below the modified endurance limit.",
                        "No loading blocks or notch correction materially degrade the case.",
                    ],
                    warnings=[],
                    engineering_notes=[
                        "Verify that the uploaded screenshot uses the same unit basis as the solver input."
                    ],
                    raw_model_name="openai/gpt-oss-20b",
                ),
                metadata=AIInterpretationMetadata(
                    response_format="json_schema",
                    attempted_response_formats=["json_schema"],
                    fallback_used=False,
                    problematic_fields=[],
                    validation_issue_count=0,
                    validation_issues=[],
                ),
            )

    monkeypatch.setattr(analysis, "get_groq_client", lambda: FakeGroqClient())

    response = client.post("/api/analyze/interpret", json=interpret_payload())

    assert response.status_code == 200
    body = response.json()
    assert body["native_analysis"]["selected_life"]["status"] == "infinite"
    assert body["ai_interpretation"]["status"] == "success"
    assert body["ai_interpretation"]["result"]["summary"].startswith("Finite-life result")
    assert body["ai_interpretation"]["metadata"]["response_format"] == "json_schema"


def test_interpret_endpoint_preserves_native_analysis_when_ai_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeGroqClient:
        async def interpret_fatigue_analysis(self, interpretation_input: dict):
            raise analysis.GroqClientError(
                code=analysis.AIComparisonErrorCode.timeout,
                message="AI interpretation timed out before a valid response arrived.",
                retriable=True,
            )

    monkeypatch.setattr(analysis, "get_groq_client", lambda: FakeGroqClient())

    response = client.post("/api/analyze/interpret", json=interpret_payload())

    assert response.status_code == 200
    body = response.json()
    assert body["native_analysis"]["selected_life"]["status"] == "infinite"
    assert body["ai_interpretation"]["status"] == "error"
    assert body["ai_interpretation"]["error"]["code"] == "timeout"
    assert body["ai_interpretation"]["error"]["retriable"] is True


def test_interpret_endpoint_marks_skipped_when_ai_disabled() -> None:
    response = client.post("/api/analyze/interpret", json=interpret_payload(enabled=False))

    assert response.status_code == 200
    body = response.json()
    assert body["native_analysis"]["selected_life"]["status"] == "infinite"
    assert body["ai_interpretation"]["status"] == "skipped"
    assert body["ai_interpretation"]["error"]["code"] == "disabled"


def test_vision_endpoint_returns_structured_reading(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeGroqClient:
        async def extract_stress_from_image(
            self,
            *,
            image_bytes: bytes,
            content_type: str,
            filename: str | None = None,
        ):
            assert image_bytes == b"fake-image-bytes"
            assert content_type == "image/png"
            assert filename == "stress.png"
            return {
                "success": True,
                "detected_quantity": "von_mises",
                "detected_label": "Equivalent Stress",
                "detected_unit": "MPa",
                "max_value": 312.6,
                "min_value": 14.2,
                "confidence": "high",
                "notes": ["Legend visible"],
                "is_usable_for_prefill": True,
            }

    monkeypatch.setattr(analysis, "get_groq_client", lambda: FakeGroqClient())

    response = client.post(
        "/api/vision/stress-from-image",
        files={"file": ("stress.png", b"fake-image-bytes", "image/png")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["detected_quantity"] == "von_mises"
    assert body["max_value"] == 312.6
    assert body["detected_unit"] == "MPa"


def test_vision_endpoint_returns_unusable_low_confidence_reading(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeGroqClient:
        async def extract_stress_from_image(
            self,
            *,
            image_bytes: bytes,
            content_type: str,
            filename: str | None = None,
        ):
            return {
                "success": False,
                "detected_quantity": "unknown",
                "detected_label": None,
                "detected_unit": "unknown",
                "max_value": None,
                "min_value": None,
                "confidence": "low",
                "notes": ["Image too low resolution"],
                "is_usable_for_prefill": False,
            }

    monkeypatch.setattr(analysis, "get_groq_client", lambda: FakeGroqClient())

    response = client.post(
        "/api/vision/stress-from-image",
        files={"file": ("stress.png", b"fake-image-bytes", "image/png")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is False
    assert body["confidence"] == "low"
    assert body["is_usable_for_prefill"] is False
    assert "low resolution" in body["notes"][0]


def test_analyze_endpoint_supports_notch_with_points_fit_and_loading_blocks() -> None:
    payload = valid_payload()
    payload["sn_curve_source"] = {
        "mode": "points_fit",
        "points": [
            {"cycles": 1e4, "stress": 420.0},
            {"cycles": 1e5, "stress": 320.0},
            {"cycles": 1e6, "stress": 245.0},
        ],
    }
    payload["surface_factor_selection"] = {
        "mode": "manual_factor",
        "surface_factor": 0.9,
    }
    payload["notch"] = {
        "model": "neuber",
        "kt": 2.2,
        "notch_radius_mm": 0.8,
        "notch_constant_mm": 0.25,
    }
    payload["loading_blocks"] = [
        {"max_stress": 320.0, "min_stress": 40.0, "cycles": 2e5, "repeats": 1},
        {"max_stress": 270.0, "min_stress": -20.0, "cycles": 3e5, "repeats": 1},
    ]

    response = client.post("/api/analyze", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["notch_result"]["model"] == "neuber"
    assert body["miner_damage"]["block_results"][0]["corrected_max_stress"] > 320.0


def test_analyze_endpoint_rejects_missing_points_for_points_fit() -> None:
    payload = valid_payload()
    payload["sn_curve_source"] = {"mode": "points_fit"}

    response = client.post("/api/analyze", json=payload)

    assert response.status_code == 422


def test_analyze_endpoint_rejects_partial_material_basquin_parameters() -> None:
    payload = valid_payload()
    payload["material"]["fatigue_strength_coefficient"] = 1000.0

    response = client.post("/api/analyze", json=payload)

    assert response.status_code == 422
    assert "fatigue_strength_coefficient" in response.text


def test_analyze_endpoint_rejects_invalid_stress_bounds() -> None:
    payload = valid_payload()
    payload["max_stress"] = 50.0
    payload["min_stress"] = 100.0

    response = client.post("/api/analyze", json=payload)

    assert response.status_code == 422


def test_analyze_endpoint_hides_internal_server_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    def _boom(**_kwargs: object) -> dict:
        raise RuntimeError("secret backend internals")

    monkeypatch.setattr(analysis, "run_full_analysis", _boom)

    response = client.post("/api/analyze", json=valid_payload())

    assert response.status_code == 500
    assert response.json()["detail"] == "Fatigue analysis failed due to an internal server error."


def test_health_endpoint_returns_service_metadata() -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_material_presets_endpoint_returns_presets() -> None:
    response = client.get("/api/materials/presets")

    assert response.status_code == 200
    body = response.json()
    assert len(body) >= 1
    assert body[0]["name"]


def test_cors_allows_local_frontend_origin() -> None:
    response = client.options(
        "/api/health",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
