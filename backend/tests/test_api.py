"""API-level tests for fatigue analysis endpoints."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers import analysis

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
