"""Core fatigue analysis engine."""

from dataclasses import dataclass
from typing import Optional

import numpy as np

SURFACE_FINISH_COEFFICIENTS: dict[str, dict[str, float]] = {
    "ground": {"a": 1.58, "b": -0.085},
    "machined": {"a": 4.51, "b": -0.265},
    "hot_rolled": {"a": 57.7, "b": -0.718},
    "forged": {"a": 272.0, "b": -0.995},
}

SUPPORTED_MEAN_STRESS_MODELS = ("goodman", "gerber", "soderberg", "morrow")
_DEFAULT_BASQUIN_EXPONENT = -0.085
_DEFAULT_SIGMA_F_PRIME_FACTOR = 1.75
_DISPLAY_MAX_CYCLES = 1e9
_MAX_SERIALIZABLE_SAFETY_FACTOR = 1e12


@dataclass
class SNDataPoint:
    cycles: float
    stress: float


@dataclass
class BasquinFitResult:
    a: float
    b: float
    sigma_f_prime: float
    r_squared: float
    points_used: int


@dataclass
class FatigueLifeResult:
    status: str
    cycles: Optional[float]
    reason: str


@dataclass
class MeanStressCorrectionResult:
    model_name: str
    effective_mean_stress: float
    safety_factor: float
    equivalent_alternating_stress: Optional[float]
    is_safe: bool
    life: FatigueLifeResult


@dataclass
class NotchSensitivityResult:
    model: str
    kt: float
    q: float
    kf: float


@dataclass
class LoadingBlock:
    max_stress: float
    min_stress: float
    cycles: float
    repeats: int = 1


@dataclass
class MinerBlockResult:
    block_index: int
    input_max_stress: float
    input_min_stress: float
    corrected_max_stress: float
    corrected_min_stress: float
    stress_amplitude: float
    mean_stress: float
    equivalent_alternating_stress: Optional[float]
    life: FatigueLifeResult
    applied_cycles: float
    damage: Optional[float]


@dataclass
class MinerDamageResult:
    total_damage: Optional[float]
    sequence_life: FatigueLifeResult
    is_failure: bool
    block_results: list[MinerBlockResult]


def calculate_surface_factor(finish_type: str, uts_mpa: float) -> float:
    """Calculate Marin surface factor ka."""
    if finish_type not in SURFACE_FINISH_COEFFICIENTS:
        raise ValueError(
            f"Unknown surface finish type '{finish_type}'. "
            f"Valid types: {list(SURFACE_FINISH_COEFFICIENTS)}"
        )
    if uts_mpa <= 0.0:
        raise ValueError("uts must be positive")

    coeffs = SURFACE_FINISH_COEFFICIENTS[finish_type]
    ka = coeffs["a"] * (uts_mpa ** coeffs["b"])
    return float(np.clip(ka, 0.0, 1.0))


def calculate_modified_endurance_limit(
    uts_mpa: float,
    endurance_limit: Optional[float] = None,
    ka: float = 1.0,
    kb: float = 1.0,
    kc: float = 1.0,
    kd: float = 1.0,
    ke: float = 1.0,
) -> float:
    """Compute the modified endurance limit Se."""
    if uts_mpa <= 0.0:
        raise ValueError("uts must be positive")
    for value, name in ((ka, "ka"), (kb, "kb"), (kc, "kc"), (kd, "kd"), (ke, "ke")):
        if value <= 0.0:
            raise ValueError(f"{name} must be positive")

    if endurance_limit is not None and endurance_limit > 0.0:
        se_prime = endurance_limit
    else:
        se_prime = 0.5 * uts_mpa if uts_mpa <= 1400.0 else 700.0

    return float(ka * kb * kc * kd * ke * se_prime)


def basquin_stress_amplitude(n_cycles: float, sigma_f_prime: float, b: float) -> float:
    """Calculate stress amplitude from Basquin's equation."""
    return float(sigma_f_prime * (2.0 * n_cycles) ** b)


def basquin_cycles_to_failure(
    stress_amplitude: float,
    sigma_f_prime: float,
    b: float,
) -> Optional[float]:
    """Calculate cycles to failure from Basquin's equation."""
    if stress_amplitude <= 0.0 or sigma_f_prime <= 0.0 or b >= 0.0:
        return None

    ratio = stress_amplitude / sigma_f_prime
    if ratio <= 0.0:
        return None

    try:
        cycles = 0.5 * (ratio ** (1.0 / b))
    except (OverflowError, ZeroDivisionError):
        return None

    if cycles < 0.0 or not np.isfinite(cycles):
        return None
    return float(cycles)


def coffin_manson_strain_amplitude(
    n_cycles: float,
    sigma_f_prime: float,
    b: float,
    elastic_modulus_mpa: float,
    epsilon_f_prime: float,
    c: float,
) -> float:
    """Calculate total strain amplitude using the Coffin-Manson equation."""
    two_n = 2.0 * n_cycles
    elastic_term = (sigma_f_prime / elastic_modulus_mpa) * (two_n ** b)
    plastic_term = epsilon_f_prime * (two_n ** c)
    return float(elastic_term + plastic_term)


def fit_basquin_from_points(points: list[SNDataPoint]) -> BasquinFitResult:
    """Fit a Basquin power law from user S-N points."""
    if len(points) < 2:
        raise ValueError("At least two S-N points are required for Basquin fitting")

    n_values = np.array([point.cycles for point in points], dtype=float)
    s_values = np.array([point.stress for point in points], dtype=float)

    if np.any(n_values <= 0.0) or np.any(s_values <= 0.0):
        raise ValueError("All S-N points must have positive cycles and stress")
    if len(np.unique(n_values)) < 2:
        raise ValueError("At least two unique cycle values are required")

    x = np.log10(n_values)
    y = np.log10(s_values)
    slope_b, intercept = np.polyfit(x, y, 1)

    if not np.isfinite(slope_b) or not np.isfinite(intercept):
        raise ValueError("Basquin fitting failed due to non-finite coefficients")

    a_coeff = float(10.0 ** intercept)
    b_exponent = float(slope_b)
    sigma_f_prime = float(a_coeff / (2.0 ** b_exponent))
    if b_exponent >= 0.0:
        raise ValueError("Fitted Basquin exponent must be negative")

    y_pred = intercept + slope_b * x
    ss_res = float(np.sum((y - y_pred) ** 2))
    ss_tot = float(np.sum((y - np.mean(y)) ** 2))
    r_squared = 1.0 if ss_tot <= 1e-14 else 1.0 - ss_res / ss_tot

    return BasquinFitResult(
        a=a_coeff,
        b=b_exponent,
        sigma_f_prime=sigma_f_prime,
        r_squared=float(np.clip(r_squared, 0.0, 1.0)),
        points_used=len(points),
    )


def calculate_notch_sensitivity(
    kt: float,
    notch_radius_mm: float,
    notch_constant_mm: float,
    model: str,
) -> NotchSensitivityResult:
    """Calculate notch sensitivity q and fatigue concentration Kf."""
    if kt < 1.0:
        raise ValueError("kt must be >= 1")
    if notch_radius_mm <= 0.0 or notch_constant_mm <= 0.0:
        raise ValueError("notch_radius_mm and notch_constant_mm must be positive")

    raw_model = model.value if hasattr(model, "value") else str(model)
    key = raw_model.lower().strip()
    if "." in key:
        key = key.split(".")[-1]
    ratio = notch_constant_mm / notch_radius_mm
    if key == "neuber":
        q = 1.0 / (1.0 + float(np.sqrt(ratio)))
    elif key == "kuhn_hardrath":
        q = 1.0 / (1.0 + ratio)
    else:
        raise ValueError("Unknown notch model. Valid: neuber, kuhn_hardrath")

    q = float(np.clip(q, 0.0, 1.0))
    kf = float(np.clip(1.0 + q * (kt - 1.0), 1.0, kt))
    return NotchSensitivityResult(model=key, kt=float(kt), q=q, kf=kf)


def _cap_safety_factor(value: float) -> float:
    if not np.isfinite(value):
        return _MAX_SERIALIZABLE_SAFETY_FACTOR
    return float(np.clip(value, 0.0, _MAX_SERIALIZABLE_SAFETY_FACTOR))


def _classify_life(
    equivalent_alternating_stress: Optional[float],
    se: float,
    sigma_f_prime: float,
    b: float,
) -> FatigueLifeResult:
    if equivalent_alternating_stress is None:
        return FatigueLifeResult(
            status="finite",
            cycles=0.0,
            reason="Mean stress correction is outside the model limit.",
        )
    if equivalent_alternating_stress <= 0.0:
        return FatigueLifeResult(
            status="infinite",
            cycles=None,
            reason="No damaging alternating stress remains after correction.",
        )
    if equivalent_alternating_stress <= se:
        return FatigueLifeResult(
            status="infinite",
            cycles=None,
            reason="Equivalent alternating stress does not exceed the modified endurance limit.",
        )

    cycles = basquin_cycles_to_failure(equivalent_alternating_stress, sigma_f_prime, b)
    if cycles is None:
        return FatigueLifeResult(
            status="finite",
            cycles=0.0,
            reason="Basquin evaluation returned a non-physical finite life.",
        )
    return FatigueLifeResult(
        status="finite",
        cycles=float(cycles),
        reason="Life computed from the mean-stress-corrected Basquin response.",
    )


def _resolve_basquin_parameters(
    uts: float,
    fatigue_strength_coefficient: Optional[float],
    fatigue_strength_exponent: Optional[float],
    sn_curve_source_mode: str,
    sn_fit_points: Optional[list[dict[str, float]]],
) -> tuple[float, float, Optional[BasquinFitResult], str]:
    mode = sn_curve_source_mode.lower().strip()
    if mode == "points_fit":
        parsed_points = [
            SNDataPoint(cycles=float(point["cycles"]), stress=float(point["stress"]))
            for point in (sn_fit_points or [])
        ]
        basquin_fit = fit_basquin_from_points(parsed_points)
        return (
            basquin_fit.sigma_f_prime,
            basquin_fit.b,
            basquin_fit,
            "points_fit",
        )

    if mode != "material_basquin":
        raise ValueError("Unknown S-N curve source mode")

    has_sigma_f = fatigue_strength_coefficient is not None
    has_b = fatigue_strength_exponent is not None
    if has_sigma_f != has_b:
        raise ValueError(
            "fatigue_strength_coefficient and fatigue_strength_exponent must be provided together"
        )

    if has_sigma_f and has_b:
        sigma_f_prime = float(fatigue_strength_coefficient)
        b_exponent = float(fatigue_strength_exponent)
        if sigma_f_prime <= 0.0:
            raise ValueError("fatigue_strength_coefficient must be positive")
        if b_exponent >= 0.0:
            raise ValueError("fatigue_strength_exponent must be negative")
        return sigma_f_prime, b_exponent, None, "material_input"

    return (
        float(_DEFAULT_SIGMA_F_PRIME_FACTOR * uts),
        float(_DEFAULT_BASQUIN_EXPONENT),
        None,
        "material_default_from_uts",
    )


def _apply_notch_to_stress_pair(
    max_stress: float,
    min_stress: float,
    notch_result: Optional[NotchSensitivityResult],
) -> tuple[float, float]:
    if notch_result is None:
        return float(max_stress), float(min_stress)
    return float(max_stress * notch_result.kf), float(min_stress * notch_result.kf)


def _characterize_stress_state(max_stress: float, min_stress: float) -> tuple[float, float, float]:
    stress_amplitude = (max_stress - min_stress) / 2.0
    mean_stress = (max_stress + min_stress) / 2.0
    stress_ratio = min_stress / max_stress if abs(max_stress) > 1e-12 else 0.0
    return float(stress_amplitude), float(mean_stress), float(stress_ratio)


def _evaluate_mean_stress_correction(
    model: str,
    stress_amplitude: float,
    mean_stress: float,
    se: float,
    sut: float,
    sy: float,
    sigma_f_prime: float,
    b: float,
) -> MeanStressCorrectionResult:
    key = model.lower().strip()
    if key not in SUPPORTED_MEAN_STRESS_MODELS:
        raise ValueError(
            "Unknown mean stress model. Valid: goodman, gerber, soderberg, morrow"
        )

    effective_mean_stress = max(mean_stress, 0.0)
    if key in {"goodman", "gerber"}:
        limit_value = sut
    elif key == "soderberg":
        limit_value = sy
    else:
        limit_value = sigma_f_prime

    if limit_value <= 0.0:
        raise ValueError("Mean stress model limit must be positive")

    if effective_mean_stress >= limit_value:
        life = FatigueLifeResult(
            status="finite",
            cycles=0.0,
            reason=f"Mean stress reaches the {key} model limit.",
        )
        return MeanStressCorrectionResult(
            model_name=key,
            effective_mean_stress=float(effective_mean_stress),
            safety_factor=0.0,
            equivalent_alternating_stress=None,
            is_safe=False,
            life=life,
        )

    if key == "gerber":
        ratio_term = (effective_mean_stress / limit_value) ** 2
    else:
        ratio_term = effective_mean_stress / limit_value

    denominator = stress_amplitude / se + ratio_term
    safety_factor = _cap_safety_factor(1.0 / denominator if denominator > 0.0 else np.inf)

    equivalent_denominator = 1.0 - ratio_term
    equivalent_alternating_stress: Optional[float]
    if equivalent_denominator <= 0.0:
        equivalent_alternating_stress = None
    else:
        equivalent_alternating_stress = float(stress_amplitude / equivalent_denominator)

    life = _classify_life(equivalent_alternating_stress, se, sigma_f_prime, b)
    return MeanStressCorrectionResult(
        model_name=key,
        effective_mean_stress=float(effective_mean_stress),
        safety_factor=safety_factor,
        equivalent_alternating_stress=equivalent_alternating_stress,
        is_safe=bool(safety_factor >= 1.0),
        life=life,
    )


def goodman_correction(
    stress_amplitude: float,
    mean_stress: float,
    se: float,
    sut: float,
    sigma_f_prime: float = 1.0,
    b: float = _DEFAULT_BASQUIN_EXPONENT,
    **_kwargs: float,
) -> MeanStressCorrectionResult:
    return _evaluate_mean_stress_correction(
        model="goodman",
        stress_amplitude=stress_amplitude,
        mean_stress=mean_stress,
        se=se,
        sut=sut,
        sy=sut,
        sigma_f_prime=sigma_f_prime,
        b=b,
    )


def gerber_correction(
    stress_amplitude: float,
    mean_stress: float,
    se: float,
    sut: float,
    sigma_f_prime: float = 1.0,
    b: float = _DEFAULT_BASQUIN_EXPONENT,
    **_kwargs: float,
) -> MeanStressCorrectionResult:
    return _evaluate_mean_stress_correction(
        model="gerber",
        stress_amplitude=stress_amplitude,
        mean_stress=mean_stress,
        se=se,
        sut=sut,
        sy=sut,
        sigma_f_prime=sigma_f_prime,
        b=b,
    )


def soderberg_correction(
    stress_amplitude: float,
    mean_stress: float,
    se: float,
    sy: float,
    sigma_f_prime: float = 1.0,
    b: float = _DEFAULT_BASQUIN_EXPONENT,
    **_kwargs: float,
) -> MeanStressCorrectionResult:
    return _evaluate_mean_stress_correction(
        model="soderberg",
        stress_amplitude=stress_amplitude,
        mean_stress=mean_stress,
        se=se,
        sut=sy,
        sy=sy,
        sigma_f_prime=sigma_f_prime,
        b=b,
    )


def morrow_correction(
    stress_amplitude: float,
    mean_stress: float,
    se: float,
    sigma_f_prime: float,
    b: float = _DEFAULT_BASQUIN_EXPONENT,
    **_kwargs: float,
) -> MeanStressCorrectionResult:
    return _evaluate_mean_stress_correction(
        model="morrow",
        stress_amplitude=stress_amplitude,
        mean_stress=mean_stress,
        se=se,
        sut=sigma_f_prime,
        sy=sigma_f_prime,
        sigma_f_prime=sigma_f_prime,
        b=b,
    )


def get_mean_stress_correction(
    model: str,
    stress_amplitude: float,
    mean_stress: float,
    se: float,
    sut: float,
    sy: float,
    sigma_f_prime: float,
    b: float = _DEFAULT_BASQUIN_EXPONENT,
) -> MeanStressCorrectionResult:
    """Dispatch the selected mean stress correction model."""
    return _evaluate_mean_stress_correction(
        model=model,
        stress_amplitude=stress_amplitude,
        mean_stress=mean_stress,
        se=se,
        sut=sut,
        sy=sy,
        sigma_f_prime=sigma_f_prime,
        b=b,
    )


def palmgren_miner_damage(
    blocks: list[LoadingBlock],
    sigma_f_prime: float,
    b: float,
    se: float,
    sut: float,
    sy: float,
    model: str,
    notch_result: Optional[NotchSensitivityResult] = None,
) -> MinerDamageResult:
    """Compute cumulative damage with Palmgren-Miner linear rule."""
    if not blocks:
        raise ValueError("At least one loading block is required")

    total_damage = 0.0
    total_damage_defined = True
    is_failure = False
    block_results: list[MinerBlockResult] = []

    for index, block in enumerate(blocks):
        if block.max_stress < block.min_stress:
            raise ValueError("Each loading block must satisfy max_stress >= min_stress")
        if block.cycles <= 0.0 or block.repeats < 1:
            raise ValueError("Each loading block must have cycles > 0 and repeats >= 1")

        corrected_max, corrected_min = _apply_notch_to_stress_pair(
            block.max_stress, block.min_stress, notch_result
        )
        stress_amplitude, mean_stress, _ = _characterize_stress_state(
            corrected_max, corrected_min
        )
        correction = get_mean_stress_correction(
            model=model,
            stress_amplitude=stress_amplitude,
            mean_stress=mean_stress,
            se=se,
            sut=sut,
            sy=sy,
            sigma_f_prime=sigma_f_prime,
            b=b,
        )
        applied_cycles = float(block.cycles * block.repeats)

        damage: Optional[float]
        if correction.life.status == "infinite":
            damage = 0.0
        elif not correction.life.cycles or correction.life.cycles <= 0.0:
            damage = None
            total_damage_defined = False
            is_failure = True
        else:
            damage = applied_cycles / correction.life.cycles
            total_damage += damage
            is_failure = is_failure or damage >= 1.0

        block_results.append(
            MinerBlockResult(
                block_index=index,
                input_max_stress=float(block.max_stress),
                input_min_stress=float(block.min_stress),
                corrected_max_stress=corrected_max,
                corrected_min_stress=corrected_min,
                stress_amplitude=stress_amplitude,
                mean_stress=mean_stress,
                equivalent_alternating_stress=correction.equivalent_alternating_stress,
                life=correction.life,
                applied_cycles=applied_cycles,
                damage=damage,
            )
        )

    total_damage_result = float(total_damage) if total_damage_defined else None
    if not total_damage_defined:
        sequence_life = FatigueLifeResult(
            status="finite",
            cycles=0.0,
            reason="At least one block exceeds the selected model limit immediately.",
        )
    elif total_damage <= 0.0:
        sequence_life = FatigueLifeResult(
            status="infinite",
            cycles=None,
            reason="All loading blocks fall into infinite life for the selected model.",
        )
    else:
        sequence_life = FatigueLifeResult(
            status="finite",
            cycles=float(1.0 / total_damage),
            reason="Life expressed as repetitions of the full loading sequence.",
        )
        is_failure = is_failure or total_damage >= 1.0

    return MinerDamageResult(
        total_damage=total_damage_result,
        sequence_life=sequence_life,
        is_failure=is_failure,
        block_results=block_results,
    )


def generate_sn_curve(
    sigma_f_prime: float,
    b: float,
    se: float = 0.0,
    num_points: int = 100,
    n_min: float = 1e1,
    n_max: float = _DISPLAY_MAX_CYCLES,
) -> list[SNDataPoint]:
    """Generate S-N curve data with an endurance-limit plateau."""
    cycles_array = np.logspace(np.log10(n_min), np.log10(n_max), num_points)
    points: list[SNDataPoint] = []
    for cycles in cycles_array:
        stress = basquin_stress_amplitude(float(cycles), sigma_f_prime, b)
        plotted_stress = max(stress, se)
        if np.isfinite(plotted_stress) and plotted_stress > 0.0:
            points.append(SNDataPoint(cycles=float(cycles), stress=float(plotted_stress)))
    return points


def generate_goodman_envelope(
    se: float,
    sut: float,
    num_points: int = 50,
) -> list[dict[str, float]]:
    mean_stresses = np.linspace(0.0, sut, num_points)
    return [
        {
            "mean_stress": float(sm),
            "stress_amplitude": float(max(se * (1.0 - sm / sut), 0.0)),
        }
        for sm in mean_stresses
    ]


def generate_gerber_envelope(
    se: float,
    sut: float,
    num_points: int = 50,
) -> list[dict[str, float]]:
    mean_stresses = np.linspace(0.0, sut, num_points)
    return [
        {
            "mean_stress": float(sm),
            "stress_amplitude": float(max(se * (1.0 - (sm / sut) ** 2), 0.0)),
        }
        for sm in mean_stresses
    ]


def generate_soderberg_envelope(
    se: float,
    sy: float,
    num_points: int = 50,
) -> list[dict[str, float]]:
    mean_stresses = np.linspace(0.0, sy, num_points)
    return [
        {
            "mean_stress": float(sm),
            "stress_amplitude": float(max(se * (1.0 - sm / sy), 0.0)),
        }
        for sm in mean_stresses
    ]


def generate_morrow_envelope(
    se: float,
    sigma_f_prime: float,
    num_points: int = 50,
) -> list[dict[str, float]]:
    mean_stresses = np.linspace(0.0, sigma_f_prime, num_points)
    return [
        {
            "mean_stress": float(sm),
            "stress_amplitude": float(max(se * (1.0 - sm / sigma_f_prime), 0.0)),
        }
        for sm in mean_stresses
    ]


def _life_to_dict(life: FatigueLifeResult) -> dict[str, str | float | None]:
    return {
        "status": life.status,
        "cycles": life.cycles,
        "reason": life.reason,
    }


def _correction_to_dict(result: MeanStressCorrectionResult) -> dict:
    return {
        "model_name": result.model_name,
        "effective_mean_stress": result.effective_mean_stress,
        "safety_factor": result.safety_factor,
        "equivalent_alternating_stress": result.equivalent_alternating_stress,
        "is_safe": result.is_safe,
        "life": _life_to_dict(result.life),
    }


def _build_selected_chart_point(
    selected_result: MeanStressCorrectionResult,
) -> Optional[dict[str, float | str | None]]:
    if selected_result.equivalent_alternating_stress is None:
        return None

    if selected_result.life.status == "infinite":
        return {
            "cycles": None,
            "display_cycles": _DISPLAY_MAX_CYCLES,
            "stress": selected_result.equivalent_alternating_stress,
            "status": selected_result.life.status,
            "label": "Infinite life",
        }

    cycles = max(float(selected_result.life.cycles or 0.0), 1.0)
    return {
        "cycles": float(selected_result.life.cycles or 0.0),
        "display_cycles": float(np.clip(cycles, 1.0, _DISPLAY_MAX_CYCLES)),
        "stress": selected_result.equivalent_alternating_stress,
        "status": selected_result.life.status,
        "label": f"{cycles:.3g} cycles",
    }


def run_full_analysis(
    max_stress: float,
    min_stress: float,
    uts: float,
    yield_strength: float,
    endurance_limit: float | None = None,
    elastic_modulus_gpa: float = 210.0,
    fatigue_strength_coefficient: float | None = None,
    fatigue_strength_exponent: float | None = None,
    fatigue_ductility_coefficient: float | None = None,
    fatigue_ductility_exponent: float | None = None,
    ka: float = 1.0,
    kb: float = 1.0,
    kc: float = 1.0,
    kd: float = 1.0,
    ke: float = 1.0,
    num_points: int = 100,
    selected_mean_stress_model: str = "goodman",
    sn_curve_source_mode: str = "material_basquin",
    sn_fit_points: Optional[list[dict[str, float]]] = None,
    notch: Optional[dict[str, float | str]] = None,
    loading_blocks: Optional[list[dict[str, float | int]]] = None,
) -> dict:
    """Execute a complete fatigue life analysis."""
    if max_stress < min_stress:
        raise ValueError("max_stress must be greater than or equal to min_stress")
    if yield_strength > uts:
        raise ValueError("yield_strength cannot exceed uts")
    if elastic_modulus_gpa <= 0.0:
        raise ValueError("elastic_modulus_gpa must be positive")
    if fatigue_ductility_coefficient is not None and fatigue_ductility_coefficient <= 0.0:
        raise ValueError("fatigue_ductility_coefficient must be positive")
    if fatigue_ductility_exponent is not None and fatigue_ductility_exponent >= 0.0:
        raise ValueError("fatigue_ductility_exponent should be negative")

    sigma_f_prime, b_exponent, basquin_fit, basquin_source = _resolve_basquin_parameters(
        uts=uts,
        fatigue_strength_coefficient=fatigue_strength_coefficient,
        fatigue_strength_exponent=fatigue_strength_exponent,
        sn_curve_source_mode=sn_curve_source_mode,
        sn_fit_points=sn_fit_points,
    )

    se = calculate_modified_endurance_limit(
        uts_mpa=uts,
        endurance_limit=endurance_limit,
        ka=ka,
        kb=kb,
        kc=kc,
        kd=kd,
        ke=ke,
    )

    notch_result: Optional[NotchSensitivityResult] = None
    corrected_max_stress = float(max_stress)
    corrected_min_stress = float(min_stress)
    if notch is not None:
        notch_result = calculate_notch_sensitivity(
            kt=float(notch["kt"]),
            notch_radius_mm=float(notch["notch_radius_mm"]),
            notch_constant_mm=float(notch.get("notch_constant_mm", 0.25)),
            model=str(notch["model"]),
        )
        corrected_max_stress, corrected_min_stress = _apply_notch_to_stress_pair(
            max_stress=max_stress,
            min_stress=min_stress,
            notch_result=notch_result,
        )

    stress_amplitude, mean_stress, stress_ratio = _characterize_stress_state(
        corrected_max_stress,
        corrected_min_stress,
    )

    corrections = [
        get_mean_stress_correction(
            model=model_name,
            stress_amplitude=stress_amplitude,
            mean_stress=mean_stress,
            se=se,
            sut=uts,
            sy=yield_strength,
            sigma_f_prime=sigma_f_prime,
            b=b_exponent,
        )
        for model_name in SUPPORTED_MEAN_STRESS_MODELS
    ]
    correction_by_model = {result.model_name: result for result in corrections}
    selected_model_key = selected_mean_stress_model.lower().strip()
    if selected_model_key not in correction_by_model:
        raise ValueError("Unknown selected_mean_stress_model")
    selected_result = correction_by_model[selected_model_key]

    sn_curve = generate_sn_curve(
        sigma_f_prime=sigma_f_prime,
        b=b_exponent,
        se=se,
        num_points=num_points,
    )
    selected_chart_point = _build_selected_chart_point(selected_result)

    miner_damage_result: Optional[MinerDamageResult] = None
    if loading_blocks:
        blocks = [
            LoadingBlock(
                max_stress=float(item["max_stress"]),
                min_stress=float(item["min_stress"]),
                cycles=float(item["cycles"]),
                repeats=int(item.get("repeats", 1)),
            )
            for item in loading_blocks
        ]
        miner_damage_result = palmgren_miner_damage(
            blocks=blocks,
            sigma_f_prime=sigma_f_prime,
            b=b_exponent,
            se=se,
            sut=uts,
            sy=yield_strength,
            model=selected_model_key,
            notch_result=notch_result,
        )

    corrected_operating_point = None
    if selected_result.equivalent_alternating_stress is not None:
        corrected_operating_point = {
            "mean_stress": 0.0,
            "stress_amplitude": selected_result.equivalent_alternating_stress,
        }

    return {
        "stress_state": {
            "input_max_stress": float(max_stress),
            "input_min_stress": float(min_stress),
            "corrected_max_stress": corrected_max_stress,
            "corrected_min_stress": corrected_min_stress,
            "stress_amplitude": stress_amplitude,
            "mean_stress": mean_stress,
            "stress_ratio": stress_ratio,
        },
        "modified_endurance_limit": float(se),
        "sn_curve_source": {
            "mode": sn_curve_source_mode,
            "basquin_parameters": {
                "sigma_f_prime": float(sigma_f_prime),
                "b": float(b_exponent),
                "source": basquin_source,
            },
            "basquin_fit": (
                {
                    "a": basquin_fit.a,
                    "b": basquin_fit.b,
                    "sigma_f_prime": basquin_fit.sigma_f_prime,
                    "r_squared": basquin_fit.r_squared,
                    "points_used": basquin_fit.points_used,
                }
                if basquin_fit is not None
                else None
            ),
        },
        "cycles_to_failure": {
            result.model_name: _life_to_dict(result.life) for result in corrections
        },
        "mean_stress_corrections": [
            _correction_to_dict(result) for result in corrections
        ],
        "selected_mean_stress_model": selected_model_key,
        "selected_mean_stress_result": _correction_to_dict(selected_result),
        "selected_life": _life_to_dict(selected_result.life),
        "sn_chart": {
            "curve": [{"cycles": point.cycles, "stress": point.stress} for point in sn_curve],
            "endurance_limit": float(se),
            "selected_point": selected_chart_point,
        },
        "haigh_diagram": {
            "goodman_envelope": generate_goodman_envelope(se, uts),
            "gerber_envelope": generate_gerber_envelope(se, uts),
            "soderberg_envelope": generate_soderberg_envelope(se, yield_strength),
            "morrow_envelope": generate_morrow_envelope(se, sigma_f_prime),
            "operating_point": {
                "mean_stress": mean_stress,
                "stress_amplitude": stress_amplitude,
            },
            "corrected_operating_point": corrected_operating_point,
        },
        "notch_result": (
            {
                "model": notch_result.model,
                "kt": notch_result.kt,
                "q": notch_result.q,
                "kf": notch_result.kf,
            }
            if notch_result is not None
            else None
        ),
        "miner_damage": (
            {
                "total_damage": miner_damage_result.total_damage,
                "sequence_life": _life_to_dict(miner_damage_result.sequence_life),
                "is_failure": miner_damage_result.is_failure,
                "block_results": [
                    {
                        "block_index": block.block_index,
                        "input_max_stress": block.input_max_stress,
                        "input_min_stress": block.input_min_stress,
                        "corrected_max_stress": block.corrected_max_stress,
                        "corrected_min_stress": block.corrected_min_stress,
                        "stress_amplitude": block.stress_amplitude,
                        "mean_stress": block.mean_stress,
                        "equivalent_alternating_stress": block.equivalent_alternating_stress,
                        "life": _life_to_dict(block.life),
                        "applied_cycles": block.applied_cycles,
                        "damage": block.damage,
                    }
                    for block in miner_damage_result.block_results
                ],
            }
            if miner_damage_result is not None
            else None
        ),
    }
