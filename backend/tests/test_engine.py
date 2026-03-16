"""Tests for the fatigue analysis engine.

Covers:
- Modified endurance limit (Marin equation)
- Surface factor calculation
- Basquin equation (S-N curve, cycles to failure)
- Coffin-Manson strain-life
- Mean stress correction models (Goodman, Gerber, Soderberg, Morrow)
- S-N curve generation
- Edge cases (zero mean stress, high stress, compressive mean)
"""

import math

import pytest

from app.core.fatigue_engine import (
    SNDataPoint,
    LoadingBlock,
    basquin_cycles_to_failure,
    basquin_stress_amplitude,
    calculate_modified_endurance_limit,
    calculate_notch_sensitivity,
    calculate_surface_factor,
    coffin_manson_strain_amplitude,
    fit_basquin_from_points,
    generate_gerber_envelope,
    generate_goodman_envelope,
    generate_morrow_envelope,
    generate_sn_curve,
    generate_soderberg_envelope,
    gerber_correction,
    goodman_correction,
    morrow_correction,
    palmgren_miner_damage,
    run_full_analysis,
    soderberg_correction,
)


# ---------------------------------------------------------------------------
# Modified endurance limit
# ---------------------------------------------------------------------------
class TestModifiedEnduranceLimit:
    """Tests for Marin equation endurance limit calculation."""

    def test_basic_endurance_limit_low_uts(self) -> None:
        """Se' = 0.5 * Sut for Sut <= 1400 MPa, with all factors = 1."""
        se = calculate_modified_endurance_limit(uts_mpa=800.0)
        assert se == pytest.approx(400.0, rel=1e-6)

    def test_basic_endurance_limit_high_uts(self) -> None:
        """Se' capped at 700 MPa for Sut > 1400 MPa."""
        se = calculate_modified_endurance_limit(uts_mpa=1600.0)
        assert se == pytest.approx(700.0, rel=1e-6)

    def test_endurance_limit_at_boundary(self) -> None:
        """Se' = 0.5 * 1400 = 700 at the boundary."""
        se = calculate_modified_endurance_limit(uts_mpa=1400.0)
        assert se == pytest.approx(700.0, rel=1e-6)

    def test_with_marin_factors(self) -> None:
        """Se = ka * kb * kc * kd * ke * Se'."""
        se = calculate_modified_endurance_limit(
            uts_mpa=800.0, ka=0.8, kb=0.9, kc=1.0, kd=1.0, ke=0.95
        )
        expected = 0.8 * 0.9 * 1.0 * 1.0 * 0.95 * 400.0
        assert se == pytest.approx(expected, rel=1e-6)

    def test_with_known_endurance_limit(self) -> None:
        """If endurance_limit is provided, use it as Se'."""
        se = calculate_modified_endurance_limit(
            uts_mpa=800.0, endurance_limit=250.0, ka=0.9
        )
        assert se == pytest.approx(0.9 * 250.0, rel=1e-6)


# ---------------------------------------------------------------------------
# Surface factor
# ---------------------------------------------------------------------------
class TestSurfaceFactor:
    """Tests for Marin surface factor ka calculation."""

    def test_ground_finish(self) -> None:
        """Ground finish should give ka close to 1.0."""
        ka = calculate_surface_factor("ground", 400.0)
        assert 0.85 < ka <= 1.0

    def test_machined_finish(self) -> None:
        """Machined finish for moderate UTS steel."""
        ka = calculate_surface_factor("machined", 500.0)
        assert 0.6 < ka < 1.0

    def test_forged_finish(self) -> None:
        """Forged finish produces lowest ka."""
        ka = calculate_surface_factor("forged", 500.0)
        assert 0.0 < ka < 0.8

    def test_invalid_finish_type(self) -> None:
        """Unknown finish type raises ValueError."""
        with pytest.raises(ValueError, match="Unknown surface finish"):
            calculate_surface_factor("polished", 400.0)

    def test_surface_factor_monotonic_with_uts(self) -> None:
        """Higher UTS generally gives lower ka for same finish."""
        ka_low = calculate_surface_factor("machined", 400.0)
        ka_high = calculate_surface_factor("machined", 1000.0)
        assert ka_high < ka_low


# ---------------------------------------------------------------------------
# Basquin equation
# ---------------------------------------------------------------------------
class TestBasquinEquation:
    """Tests for Basquin high-cycle fatigue equation."""

    def test_stress_amplitude_calculation(self) -> None:
        """sigma_a = sigma_f' * (2N)^b for known values."""
        sigma_f_prime = 1000.0
        b = -0.1
        n = 1e6
        expected = sigma_f_prime * (2.0 * n) ** b
        result = basquin_stress_amplitude(n, sigma_f_prime, b)
        assert result == pytest.approx(expected, rel=1e-9)

    def test_cycles_to_failure_roundtrip(self) -> None:
        """cycles_to_failure should invert stress_amplitude."""
        sigma_f_prime = 1200.0
        b = -0.085
        original_n = 1e5
        sa = basquin_stress_amplitude(original_n, sigma_f_prime, b)
        recovered_n = basquin_cycles_to_failure(sa, sigma_f_prime, b)
        assert recovered_n is not None
        assert recovered_n == pytest.approx(original_n, rel=1e-6)

    def test_cycles_to_failure_zero_stress(self) -> None:
        """Zero stress amplitude should return None."""
        result = basquin_cycles_to_failure(0.0, 1000.0, -0.1)
        assert result is None

    def test_cycles_to_failure_negative_stress(self) -> None:
        """Negative stress amplitude should return None."""
        result = basquin_cycles_to_failure(-100.0, 1000.0, -0.1)
        assert result is None


# ---------------------------------------------------------------------------
# Coffin-Manson
# ---------------------------------------------------------------------------
class TestCoffinManson:
    """Tests for Coffin-Manson strain-life equation."""

    def test_strain_amplitude_positive(self) -> None:
        """Strain amplitude should be positive for valid inputs."""
        eps = coffin_manson_strain_amplitude(
            n_cycles=1e4,
            sigma_f_prime=1000.0,
            b=-0.085,
            elastic_modulus_mpa=210000.0,
            epsilon_f_prime=0.25,
            c=-0.6,
        )
        assert eps > 0.0

    def test_strain_decreases_with_cycles(self) -> None:
        """Higher cycle count means lower strain amplitude."""
        params = dict(
            sigma_f_prime=1000.0,
            b=-0.085,
            elastic_modulus_mpa=210000.0,
            epsilon_f_prime=0.25,
            c=-0.6,
        )
        eps_low_n = coffin_manson_strain_amplitude(n_cycles=1e2, **params)
        eps_high_n = coffin_manson_strain_amplitude(n_cycles=1e6, **params)
        assert eps_low_n > eps_high_n


# ---------------------------------------------------------------------------
# Mean stress correction models
# ---------------------------------------------------------------------------
class TestGoodmanCorrection:
    """Tests for the modified Goodman mean stress correction."""

    def test_zero_mean_stress(self) -> None:
        """With zero mean stress, n = Se / Sa."""
        result = goodman_correction(
            stress_amplitude=100.0, mean_stress=0.0, se=300.0, sut=600.0
        )
        assert result.safety_factor == pytest.approx(3.0, rel=1e-6)
        assert result.equivalent_alternating_stress == pytest.approx(100.0, rel=1e-6)
        assert result.is_safe is True

    def test_known_values(self) -> None:
        """Goodman: n = 1 / (Sa/Se + Sm/Sut)."""
        sa, sm, se, sut = 150.0, 200.0, 300.0, 600.0
        expected_n = 1.0 / (sa / se + sm / sut)
        result = goodman_correction(sa, sm, se, sut)
        assert result.safety_factor == pytest.approx(expected_n, rel=1e-6)
        assert result.model_name == "Goodman"

    def test_mean_stress_exceeds_uts(self) -> None:
        """When Sm >= Sut, safety factor should be 0."""
        result = goodman_correction(100.0, 700.0, 300.0, 600.0)
        assert result.safety_factor == 0.0
        assert result.is_safe is False

    def test_compressive_mean_treated_as_zero(self) -> None:
        """Negative mean stress treated as zero (conservative)."""
        result_neg = goodman_correction(100.0, -50.0, 300.0, 600.0)
        result_zero = goodman_correction(100.0, 0.0, 300.0, 600.0)
        assert result_neg.safety_factor == pytest.approx(
            result_zero.safety_factor, rel=1e-6
        )


class TestGerberCorrection:
    """Tests for the Gerber parabolic mean stress correction."""

    def test_zero_mean_stress(self) -> None:
        """With zero mean, same as Goodman: n = Se / Sa."""
        result = gerber_correction(
            stress_amplitude=100.0, mean_stress=0.0, se=300.0, sut=600.0
        )
        assert result.safety_factor == pytest.approx(3.0, rel=1e-6)

    def test_less_conservative_than_goodman(self) -> None:
        """Gerber is generally less conservative than Goodman for tensile mean."""
        sa, sm, se, sut = 150.0, 200.0, 300.0, 600.0
        goodman = goodman_correction(sa, sm, se, sut)
        gerber = gerber_correction(sa, sm, se, sut)
        assert gerber.safety_factor > goodman.safety_factor

    def test_known_values(self) -> None:
        """Gerber: n = 1 / (Sa/Se + (Sm/Sut)^2)."""
        sa, sm, se, sut = 150.0, 200.0, 300.0, 600.0
        expected_n = 1.0 / (sa / se + (sm / sut) ** 2)
        result = gerber_correction(sa, sm, se, sut)
        assert result.safety_factor == pytest.approx(expected_n, rel=1e-6)


class TestSoderbergCorrection:
    """Tests for the Soderberg mean stress correction."""

    def test_zero_mean_stress(self) -> None:
        """With zero mean, n = Se / Sa."""
        result = soderberg_correction(
            stress_amplitude=100.0, mean_stress=0.0, se=300.0, sy=500.0
        )
        assert result.safety_factor == pytest.approx(3.0, rel=1e-6)

    def test_more_conservative_than_goodman(self) -> None:
        """Soderberg uses Sy < Sut, so it is more conservative."""
        sa, sm, se = 150.0, 200.0, 300.0
        sut, sy = 600.0, 450.0
        goodman = goodman_correction(sa, sm, se, sut)
        soderberg = soderberg_correction(sa, sm, se, sy)
        assert soderberg.safety_factor < goodman.safety_factor

    def test_known_values(self) -> None:
        """Soderberg: n = 1 / (Sa/Se + Sm/Sy)."""
        sa, sm, se, sy = 150.0, 200.0, 300.0, 500.0
        expected_n = 1.0 / (sa / se + sm / sy)
        result = soderberg_correction(sa, sm, se, sy)
        assert result.safety_factor == pytest.approx(expected_n, rel=1e-6)

    def test_mean_stress_exceeds_yield(self) -> None:
        """When Sm >= Sy, safety factor should be 0."""
        result = soderberg_correction(100.0, 500.0, 300.0, 450.0)
        assert result.safety_factor == 0.0
        assert result.is_safe is False


class TestMorrowCorrection:
    """Tests for the Morrow mean stress correction."""

    def test_zero_mean_stress(self) -> None:
        """With zero mean, n = Se / Sa."""
        result = morrow_correction(
            stress_amplitude=100.0, mean_stress=0.0, se=300.0, sigma_f_prime=1000.0
        )
        assert result.safety_factor == pytest.approx(3.0, rel=1e-6)

    def test_known_values(self) -> None:
        """Morrow: n = 1 / (Sa/Se + Sm/sigma_f')."""
        sa, sm, se, sfp = 150.0, 200.0, 300.0, 1000.0
        expected_n = 1.0 / (sa / se + sm / sfp)
        result = morrow_correction(sa, sm, se, sfp)
        assert result.safety_factor == pytest.approx(expected_n, rel=1e-6)

    def test_compressive_mean_treated_as_zero(self) -> None:
        """Negative mean stress treated as zero."""
        result_neg = morrow_correction(100.0, -100.0, 300.0, 1000.0)
        result_zero = morrow_correction(100.0, 0.0, 300.0, 1000.0)
        assert result_neg.safety_factor == pytest.approx(
            result_zero.safety_factor, rel=1e-6
        )


# ---------------------------------------------------------------------------
# S-N curve generation
# ---------------------------------------------------------------------------
class TestSNCurveGeneration:
    """Tests for S-N curve data point generation."""

    def test_correct_number_of_points(self) -> None:
        """Generated curve should have the requested number of points."""
        points = generate_sn_curve(sigma_f_prime=1000.0, b=-0.085, num_points=50)
        assert len(points) == 50

    def test_default_number_of_points(self) -> None:
        """Default is 100 points."""
        points = generate_sn_curve(sigma_f_prime=1000.0, b=-0.085)
        assert len(points) == 100

    def test_stress_decreases_with_cycles(self) -> None:
        """Stress amplitude should decrease as cycles increase."""
        points = generate_sn_curve(sigma_f_prime=1000.0, b=-0.085, num_points=20)
        stresses = [p.stress for p in points]
        for i in range(1, len(stresses)):
            assert stresses[i] < stresses[i - 1]

    def test_all_stresses_positive(self) -> None:
        """All generated stress values should be positive."""
        points = generate_sn_curve(sigma_f_prime=1000.0, b=-0.085)
        for p in points:
            assert p.stress > 0.0
            assert p.cycles > 0.0


# ---------------------------------------------------------------------------
# Envelope generation
# ---------------------------------------------------------------------------
class TestEnvelopeGeneration:
    """Tests for failure envelope generation."""

    def test_goodman_envelope_endpoints(self) -> None:
        """Goodman starts at (0, Se) and ends at (Sut, 0)."""
        env = generate_goodman_envelope(se=300.0, sut=600.0, num_points=50)
        assert env[0]["mean_stress"] == pytest.approx(0.0)
        assert env[0]["stress_amplitude"] == pytest.approx(300.0)
        assert env[-1]["mean_stress"] == pytest.approx(600.0)
        assert env[-1]["stress_amplitude"] == pytest.approx(0.0, abs=1e-6)

    def test_gerber_envelope_is_parabolic(self) -> None:
        """Gerber midpoint should be higher than Goodman midpoint."""
        se, sut = 300.0, 600.0
        goodman_env = generate_goodman_envelope(se, sut, num_points=51)
        gerber_env = generate_gerber_envelope(se, sut, num_points=51)
        # At the midpoint (Sm = Sut/2)
        mid = len(goodman_env) // 2
        assert gerber_env[mid]["stress_amplitude"] > goodman_env[mid]["stress_amplitude"]

    def test_soderberg_envelope_uses_sy(self) -> None:
        """Soderberg envelope ends at Sy, not Sut."""
        env = generate_soderberg_envelope(se=300.0, sy=400.0, num_points=50)
        assert env[-1]["mean_stress"] == pytest.approx(400.0)

    def test_morrow_envelope_uses_sigma_f_prime(self) -> None:
        """Morrow envelope ends at sigma_f'."""
        env = generate_morrow_envelope(se=300.0, sigma_f_prime=1000.0, num_points=50)
        assert env[-1]["mean_stress"] == pytest.approx(1000.0)


# ---------------------------------------------------------------------------
# Full analysis integration
# ---------------------------------------------------------------------------
class TestFullAnalysis:
    """Integration tests for the complete analysis pipeline."""

    def test_basic_analysis_returns_all_fields(self) -> None:
        """Full analysis result contains all expected keys."""
        result = run_full_analysis(
            max_stress=300.0,
            min_stress=100.0,
            uts=600.0,
            yield_strength=400.0,
        )
        assert "stress_amplitude" in result
        assert "mean_stress" in result
        assert "stress_ratio" in result
        assert "modified_endurance_limit" in result
        assert "cycles_to_failure" in result
        assert "mean_stress_corrections" in result
        assert "sn_curve_data" in result
        assert "goodman_envelope" in result
        assert "gerber_envelope" in result
        assert "soderberg_envelope" in result
        assert "morrow_envelope" in result

    def test_stress_characterization(self) -> None:
        """Verify stress amplitude, mean stress, and ratio."""
        result = run_full_analysis(
            max_stress=300.0,
            min_stress=100.0,
            uts=600.0,
            yield_strength=400.0,
        )
        assert result["stress_amplitude"] == pytest.approx(100.0)
        assert result["mean_stress"] == pytest.approx(200.0)
        assert result["stress_ratio"] == pytest.approx(100.0 / 300.0, rel=1e-6)

    def test_fully_reversed_loading(self) -> None:
        """R = -1 gives zero mean stress."""
        result = run_full_analysis(
            max_stress=200.0,
            min_stress=-200.0,
            uts=600.0,
            yield_strength=400.0,
        )
        assert result["mean_stress"] == pytest.approx(0.0)
        assert result["stress_ratio"] == pytest.approx(-1.0)

    def test_four_mean_stress_models(self) -> None:
        """Should produce results for all four correction models."""
        result = run_full_analysis(
            max_stress=300.0,
            min_stress=100.0,
            uts=600.0,
            yield_strength=400.0,
        )
        model_names = [c["model_name"] for c in result["mean_stress_corrections"]]
        assert "Goodman" in model_names
        assert "Gerber" in model_names
        assert "Soderberg" in model_names
        assert "Morrow" in model_names

    def test_very_high_stress_gives_low_safety_factor(self) -> None:
        """Stress near UTS should give safety factor < 1."""
        result = run_full_analysis(
            max_stress=580.0,
            min_stress=500.0,
            uts=600.0,
            yield_strength=400.0,
        )
        for correction in result["mean_stress_corrections"]:
            assert correction["safety_factor"] < 1.0

    def test_sn_curve_has_requested_points(self) -> None:
        """S-N curve should have the number of points requested."""
        result = run_full_analysis(
            max_stress=300.0,
            min_stress=100.0,
            uts=600.0,
            yield_strength=400.0,
            num_points=75,
        )
        assert len(result["sn_curve_data"]) == 75


class TestBasquinFit:
    """Tests for user-point Basquin fitting."""

    def test_fit_basquin_from_points(self) -> None:
        points = [
            SNDataPoint(cycles=1e4, stress=420.0),
            SNDataPoint(cycles=1e5, stress=320.0),
            SNDataPoint(cycles=1e6, stress=245.0),
        ]
        fit = fit_basquin_from_points(points)
        assert fit.points_used == 3
        assert fit.b < 0
        assert 0.0 <= fit.r_squared <= 1.0


class TestNotchSensitivity:
    """Tests for notch sensitivity models."""

    def test_notch_sensitivity_bounds(self) -> None:
        result = calculate_notch_sensitivity(
            kt=2.2,
            notch_radius_mm=0.8,
            notch_constant_mm=0.25,
            model="neuber",
        )
        assert 0.0 <= result.q <= 1.0
        assert 1.0 <= result.kf <= result.kt


class TestMinerDamage:
    """Tests for Palmgren-Miner damage accumulation."""

    def test_miner_damage_positive(self) -> None:
        blocks = [
            LoadingBlock(max_stress=320.0, min_stress=40.0, cycles=2e5, repeats=1),
            LoadingBlock(max_stress=270.0, min_stress=-20.0, cycles=3e5, repeats=1),
        ]
        result = palmgren_miner_damage(
            blocks=blocks,
            sigma_f_prime=1000.0,
            b=-0.1,
            se=280.0,
            sut=650.0,
            sy=450.0,
            model="goodman",
        )
        assert result.total_damage > 0
        assert len(result.block_results) == 2
