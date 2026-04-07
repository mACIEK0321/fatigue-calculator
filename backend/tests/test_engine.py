"""Engine-level tests for fatigue analysis."""

import pytest

from app.core.fatigue_engine import (
    LoadingBlock,
    SNDataPoint,
    basquin_cycles_to_failure,
    basquin_stress_amplitude,
    calculate_modified_endurance_limit,
    calculate_notch_sensitivity,
    calculate_surface_factor,
    fit_basquin_from_points,
    generate_goodman_envelope,
    generate_gerber_envelope,
    generate_morrow_envelope,
    generate_sn_curve,
    generate_soderberg_envelope,
    goodman_correction,
    palmgren_miner_damage,
    run_full_analysis,
)


def test_modified_endurance_limit_uses_half_uts_by_default() -> None:
    assert calculate_modified_endurance_limit(uts_mpa=800.0) == pytest.approx(400.0)


def test_surface_factor_rejects_unknown_finish() -> None:
    with pytest.raises(ValueError, match="Unknown surface finish"):
        calculate_surface_factor("polished", 400.0)


def test_basquin_roundtrip() -> None:
    sigma_f_prime = 1200.0
    b = -0.085
    cycles = 1e5
    stress = basquin_stress_amplitude(cycles, sigma_f_prime, b)
    assert basquin_cycles_to_failure(stress, sigma_f_prime, b) == pytest.approx(cycles)


def test_fit_basquin_from_points_requires_negative_exponent() -> None:
    with pytest.raises(ValueError, match="negative"):
        fit_basquin_from_points(
            [
                SNDataPoint(cycles=1e4, stress=100.0),
                SNDataPoint(cycles=1e5, stress=110.0),
            ]
        )


def test_goodman_ignores_compressive_mean_stress() -> None:
    negative_mean = goodman_correction(
        stress_amplitude=100.0,
        mean_stress=-50.0,
        se=300.0,
        sut=600.0,
    )
    zero_mean = goodman_correction(
        stress_amplitude=100.0,
        mean_stress=0.0,
        se=300.0,
        sut=600.0,
    )
    assert negative_mean.effective_mean_stress == 0.0
    assert negative_mean.safety_factor == pytest.approx(zero_mean.safety_factor)


def test_generate_sn_curve_can_include_endurance_plateau() -> None:
    points = generate_sn_curve(sigma_f_prime=1000.0, b=-0.1, se=250.0, num_points=40)
    assert len(points) == 40
    assert points[-1].stress >= 250.0


def test_envelopes_use_expected_limits() -> None:
    assert generate_goodman_envelope(300.0, 600.0)[-1]["mean_stress"] == pytest.approx(600.0)
    assert generate_gerber_envelope(300.0, 600.0)[-1]["mean_stress"] == pytest.approx(600.0)
    assert generate_soderberg_envelope(300.0, 450.0)[-1]["mean_stress"] == pytest.approx(450.0)
    assert generate_morrow_envelope(300.0, 1000.0)[-1]["mean_stress"] == pytest.approx(1000.0)


def test_material_basquin_mode_is_explicit() -> None:
    result = run_full_analysis(
        max_stress=280.0,
        min_stress=-40.0,
        uts=600.0,
        yield_strength=400.0,
        sn_curve_source_mode="material_basquin",
        fatigue_strength_coefficient=950.0,
        fatigue_strength_exponent=-0.09,
    )
    assert result["sn_curve_source"]["mode"] == "material_basquin"
    assert result["sn_curve_source"]["basquin_parameters"]["source"] == "material_input"
    assert result["sn_curve_source"]["basquin_fit"] is None


def test_points_fit_mode_is_explicit() -> None:
    result = run_full_analysis(
        max_stress=280.0,
        min_stress=-40.0,
        uts=600.0,
        yield_strength=400.0,
        sn_curve_source_mode="points_fit",
        sn_fit_points=[
            {"cycles": 1e4, "stress": 420.0},
            {"cycles": 1e5, "stress": 320.0},
            {"cycles": 1e6, "stress": 245.0},
        ],
    )
    assert result["sn_curve_source"]["mode"] == "points_fit"
    assert result["sn_curve_source"]["basquin_parameters"]["source"] == "points_fit"
    assert result["sn_curve_source"]["basquin_fit"]["points_used"] == 3


def test_infinite_life_is_returned_semantically_when_sa_below_se() -> None:
    result = run_full_analysis(
        max_stress=160.0,
        min_stress=-160.0,
        uts=600.0,
        yield_strength=400.0,
        selected_mean_stress_model="goodman",
    )
    assert result["selected_life"]["status"] == "infinite"
    assert result["selected_life"]["cycles"] is None
    assert result["sn_chart"]["selected_point"]["status"] == "infinite"


def test_invalid_positive_b_is_rejected() -> None:
    with pytest.raises(ValueError, match="negative"):
        run_full_analysis(
            max_stress=250.0,
            min_stress=50.0,
            uts=600.0,
            yield_strength=400.0,
            sn_curve_source_mode="material_basquin",
            fatigue_strength_coefficient=1000.0,
            fatigue_strength_exponent=0.01,
        )


def test_invalid_max_less_than_min_is_rejected() -> None:
    with pytest.raises(ValueError, match="max_stress"):
        run_full_analysis(
            max_stress=10.0,
            min_stress=20.0,
            uts=600.0,
            yield_strength=400.0,
        )


def test_notch_is_applied_to_loading_blocks() -> None:
    baseline = run_full_analysis(
        max_stress=280.0,
        min_stress=-20.0,
        uts=650.0,
        yield_strength=450.0,
        selected_mean_stress_model="goodman",
        loading_blocks=[
            {"max_stress": 320.0, "min_stress": 40.0, "cycles": 2e5, "repeats": 1},
        ],
    )
    with_notch = run_full_analysis(
        max_stress=280.0,
        min_stress=-20.0,
        uts=650.0,
        yield_strength=450.0,
        selected_mean_stress_model="goodman",
        notch={
            "model": "neuber",
            "kt": 2.2,
            "notch_radius_mm": 0.8,
            "notch_constant_mm": 0.25,
        },
        loading_blocks=[
            {"max_stress": 320.0, "min_stress": 40.0, "cycles": 2e5, "repeats": 1},
        ],
    )
    baseline_block = baseline["miner_damage"]["block_results"][0]
    notched_block = with_notch["miner_damage"]["block_results"][0]
    assert notched_block["corrected_max_stress"] > baseline_block["corrected_max_stress"]
    assert notched_block["damage"] is not None
    assert baseline_block["damage"] is not None
    assert notched_block["damage"] > baseline_block["damage"]


def test_palmgren_miner_damage_reports_infinite_sequence_when_blocks_are_safe() -> None:
    notch = calculate_notch_sensitivity(
        kt=1.5,
        notch_radius_mm=2.0,
        notch_constant_mm=0.25,
        model="neuber",
    )
    result = palmgren_miner_damage(
        blocks=[LoadingBlock(max_stress=100.0, min_stress=-100.0, cycles=1e5, repeats=1)],
        sigma_f_prime=1050.0,
        b=-0.085,
        se=300.0,
        sut=600.0,
        sy=400.0,
        model="goodman",
        notch_result=notch,
    )
    assert result.sequence_life.status == "infinite"
    assert result.total_damage == pytest.approx(0.0)
