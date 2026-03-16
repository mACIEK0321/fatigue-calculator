"""Core fatigue analysis engine for FatigueSim Pro.

Implements classical fatigue life prediction methods including:
- Marin equation for modified endurance limit
- Basquin equation for high-cycle fatigue (S-N curve)
- Coffin-Manson equation for low-cycle fatigue (strain-life)
- Mean stress correction models (Goodman, Gerber, Soderberg, Morrow)
- Failure envelope generation for Goodman diagram plotting

All stresses are in MPa. Elastic modulus is converted from GPa to MPa internally.

References:
    Shigley's Mechanical Engineering Design (11th Edition)
    Dowling, N.E. - Mechanical Behavior of Materials (4th Edition)
"""

from dataclasses import dataclass
from typing import Optional

import numpy as np

# ---------------------------------------------------------------------------
# Surface finish empirical coefficients (Marin factor ka = a * Sut^b)
# Sut must be in MPa.  Source: Shigley Table 6-2
# ---------------------------------------------------------------------------
SURFACE_FINISH_COEFFICIENTS: dict[str, dict[str, float]] = {
    "ground": {"a": 1.58, "b": -0.085},
    "machined": {"a": 4.51, "b": -0.265},
    "hot_rolled": {"a": 57.7, "b": -0.718},
    "forged": {"a": 272.0, "b": -0.995},
}

# Default Basquin parameters for generic steel when not provided
_DEFAULT_BASQUIN_EXPONENT: float = -0.085
_DEFAULT_SIGMA_F_PRIME_FACTOR: float = 1.75  # sigma_f' ~ 1.75 * Sut

# Default Coffin-Manson ductility parameters for generic steel
_DEFAULT_EPSILON_F_PRIME: float = 0.25
_DEFAULT_DUCTILITY_EXPONENT: float = -0.6


# ---------------------------------------------------------------------------
# Data classes for intermediate results
# ---------------------------------------------------------------------------
@dataclass
class MeanStressCorrectionResult:
    """Result from a mean stress correction model evaluation."""

    model_name: str
    safety_factor: float
    equivalent_alternating_stress: float
    is_safe: bool


@dataclass
class SNDataPoint:
    """A single point on the S-N curve."""

    cycles: float
    stress: float


@dataclass
class BasquinFitResult:
    """Power-law fit result for S-N points using S = a*N^b."""

    a: float
    b: float
    sigma_f_prime: float
    r_squared: float
    points_used: int


@dataclass
class NotchSensitivityResult:
    """Computed notch sensitivity and fatigue stress concentration."""

    model: str
    kt: float
    q: float
    kf: float


@dataclass
class LoadingBlock:
    """Single block for Palmgren-Miner damage accumulation."""

    max_stress: float
    min_stress: float
    cycles: float
    repeats: int = 1


@dataclass
class MinerBlockResult:
    """Per-loading-block damage contribution."""

    block_index: int
    stress_amplitude: float
    mean_stress: float
    equivalent_alternating_stress: float
    cycles_to_failure: Optional[float]
    applied_cycles: float
    damage: float


@dataclass
class MinerDamageResult:
    """Palmgren-Miner cumulative damage output."""

    total_damage: float
    predicted_blocks_to_failure: Optional[float]
    is_failure: bool
    block_results: list[MinerBlockResult]


# ---------------------------------------------------------------------------
# Surface factor
# ---------------------------------------------------------------------------
def calculate_surface_factor(finish_type: str, uts_mpa: float) -> float:
    """Calculate the Marin surface finish factor ka.

    Uses the empirical relation ka = a * Sut^b where coefficients
    depend on the surface finish category.

    Args:
        finish_type: One of 'ground', 'machined', 'hot_rolled', 'forged'.
        uts_mpa: Ultimate tensile strength in MPa (must be > 0).

    Returns:
        Surface factor ka (dimensionless, typically 0 < ka <= 1).

    Raises:
        ValueError: If finish_type is not recognized.
    """
    if finish_type not in SURFACE_FINISH_COEFFICIENTS:
        raise ValueError(
            f"Unknown surface finish type: '{finish_type}'. "
            f"Valid types: {list(SURFACE_FINISH_COEFFICIENTS.keys())}"
        )
    coeffs = SURFACE_FINISH_COEFFICIENTS[finish_type]
    a = coeffs["a"]
    b = coeffs["b"]
    ka = a * (uts_mpa ** b)
    # Clamp to a reasonable range
    return float(np.clip(ka, 0.0, 1.0))


# ---------------------------------------------------------------------------
# Modified endurance limit (Marin equation)
# ---------------------------------------------------------------------------
def calculate_modified_endurance_limit(
    uts_mpa: float,
    endurance_limit: Optional[float] = None,
    ka: float = 1.0,
    kb: float = 1.0,
    kc: float = 1.0,
    kd: float = 1.0,
    ke: float = 1.0,
) -> float:
    """Compute the modified endurance limit Se using the Marin equation.

    Se = ka * kb * kc * kd * ke * Se'

    where Se' (prime endurance limit) is either provided directly or
    estimated from UTS:
        Se' = 0.5 * Sut   if Sut <= 1400 MPa
        Se' = 700 MPa      if Sut >  1400 MPa

    Args:
        uts_mpa: Ultimate tensile strength in MPa.
        endurance_limit: Known endurance limit Se' in MPa (optional).
        ka: Surface factor.
        kb: Size factor.
        kc: Load factor.
        kd: Temperature factor.
        ke: Reliability factor.

    Returns:
        Modified endurance limit Se in MPa.
    """
    if endurance_limit is not None and endurance_limit > 0:
        se_prime = endurance_limit
    else:
        se_prime = 0.5 * uts_mpa if uts_mpa <= 1400.0 else 700.0

    se = ka * kb * kc * kd * ke * se_prime
    return float(se)


# ---------------------------------------------------------------------------
# Basquin equation (high-cycle fatigue)
# ---------------------------------------------------------------------------
def basquin_stress_amplitude(
    n_cycles: float,
    sigma_f_prime: float,
    b: float,
) -> float:
    """Calculate stress amplitude from Basquin's equation.

    sigma_a = sigma_f' * (2N)^b

    Args:
        n_cycles: Number of cycles to failure N.
        sigma_f_prime: Fatigue strength coefficient in MPa.
        b: Fatigue strength exponent (negative).

    Returns:
        Stress amplitude in MPa.
    """
    return float(sigma_f_prime * (2.0 * n_cycles) ** b)


def basquin_cycles_to_failure(
    stress_amplitude: float,
    sigma_f_prime: float,
    b: float,
) -> Optional[float]:
    """Calculate cycles to failure from Basquin's equation.

    N = 0.5 * (sigma_a / sigma_f')^(1/b)

    Args:
        stress_amplitude: Alternating stress amplitude in MPa.
        sigma_f_prime: Fatigue strength coefficient in MPa.
        b: Fatigue strength exponent (negative).

    Returns:
        Number of cycles to failure, or None if stress_amplitude <= 0
        or the result is non-physical.
    """
    if stress_amplitude <= 0.0 or sigma_f_prime <= 0.0:
        return None
    if b >= 0.0:
        return None

    ratio = stress_amplitude / sigma_f_prime
    # If stress exceeds sigma_f', cycles < 1 (immediate failure)
    try:
        n = 0.5 * (ratio ** (1.0 / b))
    except (OverflowError, ZeroDivisionError):
        return None

    if n < 0.0 or not np.isfinite(n):
        return None
    return float(n)


# ---------------------------------------------------------------------------
# Coffin-Manson equation (low-cycle fatigue, strain-life)
# ---------------------------------------------------------------------------
def coffin_manson_strain_amplitude(
    n_cycles: float,
    sigma_f_prime: float,
    b: float,
    elastic_modulus_mpa: float,
    epsilon_f_prime: float,
    c: float,
) -> float:
    """Calculate total strain amplitude using the Coffin-Manson equation.

    epsilon_a = (sigma_f' / E) * (2N)^b + epsilon_f' * (2N)^c

    The first term is elastic strain (Basquin); the second is plastic strain.

    Args:
        n_cycles: Number of cycles to failure N.
        sigma_f_prime: Fatigue strength coefficient in MPa.
        b: Fatigue strength exponent.
        elastic_modulus_mpa: Elastic modulus in MPa.
        epsilon_f_prime: Fatigue ductility coefficient.
        c: Fatigue ductility exponent (negative).

    Returns:
        Total strain amplitude (dimensionless).
    """
    two_n = 2.0 * n_cycles
    elastic_term = (sigma_f_prime / elastic_modulus_mpa) * (two_n ** b)
    plastic_term = epsilon_f_prime * (two_n ** c)
    return float(elastic_term + plastic_term)


# ---------------------------------------------------------------------------
# Mean stress correction models
# ---------------------------------------------------------------------------
def _safe_division(numerator: float, denominator: float) -> float:
    """Return numerator/denominator, or inf if denominator ~ 0."""
    if abs(denominator) < 1e-12:
        return float("inf") if numerator >= 0 else float("-inf")
    return numerator / denominator


def goodman_correction(
    stress_amplitude: float,
    mean_stress: float,
    se: float,
    sut: float,
    **_kwargs: float,
) -> MeanStressCorrectionResult:
    """Modified Goodman mean stress correction.

    Criterion: Sa/Se + Sm/Sut = 1/n
    Equivalent alternating stress: Sa_eq = Sa / (1 - Sm/Sut)

    For compressive mean stress (Sm < 0), the mean stress effect is
    conservatively ignored (Sm treated as 0).

    Args:
        stress_amplitude: Alternating stress Sa in MPa.
        mean_stress: Mean stress Sm in MPa.
        se: Modified endurance limit Se in MPa.
        sut: Ultimate tensile strength in MPa.

    Returns:
        MeanStressCorrectionResult with safety factor and equivalent stress.
    """
    sm = max(mean_stress, 0.0)  # Ignore compressive mean for Goodman

    if sm >= sut:
        return MeanStressCorrectionResult(
            model_name="Goodman",
            safety_factor=0.0,
            equivalent_alternating_stress=float("inf"),
            is_safe=False,
        )

    denominator = stress_amplitude / se + sm / sut
    n = _safe_division(1.0, denominator)
    sa_eq = stress_amplitude / (1.0 - sm / sut)

    return MeanStressCorrectionResult(
        model_name="Goodman",
        safety_factor=float(max(n, 0.0)),
        equivalent_alternating_stress=float(sa_eq),
        is_safe=n >= 1.0,
    )


def gerber_correction(
    stress_amplitude: float,
    mean_stress: float,
    se: float,
    sut: float,
    **_kwargs: float,
) -> MeanStressCorrectionResult:
    """Gerber parabolic mean stress correction.

    Criterion: Sa/Se + (Sm/Sut)^2 = 1/n
    Equivalent alternating stress: Sa_eq = Sa / (1 - (Sm/Sut)^2)

    For compressive mean stress, the effect is ignored (Sm = 0).

    Args:
        stress_amplitude: Alternating stress Sa in MPa.
        mean_stress: Mean stress Sm in MPa.
        se: Modified endurance limit Se in MPa.
        sut: Ultimate tensile strength in MPa.

    Returns:
        MeanStressCorrectionResult with safety factor and equivalent stress.
    """
    sm = max(mean_stress, 0.0)

    if sm >= sut:
        return MeanStressCorrectionResult(
            model_name="Gerber",
            safety_factor=0.0,
            equivalent_alternating_stress=float("inf"),
            is_safe=False,
        )

    sm_ratio_sq = (sm / sut) ** 2
    denominator = stress_amplitude / se + sm_ratio_sq
    n = _safe_division(1.0, denominator)
    sa_eq = stress_amplitude / (1.0 - sm_ratio_sq)

    return MeanStressCorrectionResult(
        model_name="Gerber",
        safety_factor=float(max(n, 0.0)),
        equivalent_alternating_stress=float(sa_eq),
        is_safe=n >= 1.0,
    )


def soderberg_correction(
    stress_amplitude: float,
    mean_stress: float,
    se: float,
    sy: float,
    **_kwargs: float,
) -> MeanStressCorrectionResult:
    """Soderberg mean stress correction (conservative).

    Criterion: Sa/Se + Sm/Sy = 1/n
    Equivalent alternating stress: Sa_eq = Sa / (1 - Sm/Sy)

    Uses yield strength instead of UTS. For compressive mean stress,
    the effect is ignored.

    Args:
        stress_amplitude: Alternating stress Sa in MPa.
        mean_stress: Mean stress Sm in MPa.
        se: Modified endurance limit Se in MPa.
        sy: Yield strength in MPa.

    Returns:
        MeanStressCorrectionResult with safety factor and equivalent stress.
    """
    sm = max(mean_stress, 0.0)

    if sm >= sy:
        return MeanStressCorrectionResult(
            model_name="Soderberg",
            safety_factor=0.0,
            equivalent_alternating_stress=float("inf"),
            is_safe=False,
        )

    denominator = stress_amplitude / se + sm / sy
    n = _safe_division(1.0, denominator)
    sa_eq = stress_amplitude / (1.0 - sm / sy)

    return MeanStressCorrectionResult(
        model_name="Soderberg",
        safety_factor=float(max(n, 0.0)),
        equivalent_alternating_stress=float(sa_eq),
        is_safe=n >= 1.0,
    )


def morrow_correction(
    stress_amplitude: float,
    mean_stress: float,
    se: float,
    sigma_f_prime: float,
    **_kwargs: float,
) -> MeanStressCorrectionResult:
    """Morrow mean stress correction.

    Criterion: Sa/Se + Sm/sigma_f' = 1/n
    Equivalent alternating stress: Sa_eq = Sa / (1 - Sm/sigma_f')

    Uses the fatigue strength coefficient instead of UTS.
    For compressive mean stress, the effect is ignored.

    Args:
        stress_amplitude: Alternating stress Sa in MPa.
        mean_stress: Mean stress Sm in MPa.
        se: Modified endurance limit Se in MPa.
        sigma_f_prime: Fatigue strength coefficient in MPa.

    Returns:
        MeanStressCorrectionResult with safety factor and equivalent stress.
    """
    sm = max(mean_stress, 0.0)

    if sm >= sigma_f_prime:
        return MeanStressCorrectionResult(
            model_name="Morrow",
            safety_factor=0.0,
            equivalent_alternating_stress=float("inf"),
            is_safe=False,
        )

    denominator = stress_amplitude / se + sm / sigma_f_prime
    n = _safe_division(1.0, denominator)
    sa_eq = stress_amplitude / (1.0 - sm / sigma_f_prime)

    return MeanStressCorrectionResult(
        model_name="Morrow",
        safety_factor=float(max(n, 0.0)),
        equivalent_alternating_stress=float(sa_eq),
        is_safe=n >= 1.0,
    )


def get_mean_stress_correction(
    model: str,
    stress_amplitude: float,
    mean_stress: float,
    se: float,
    sut: float,
    sy: float,
    sigma_f_prime: float,
) -> MeanStressCorrectionResult:
    """Dispatch the selected mean stress correction model."""
    key = model.lower().strip()
    if key == "goodman":
        return goodman_correction(stress_amplitude, mean_stress, se, sut)
    if key == "gerber":
        return gerber_correction(stress_amplitude, mean_stress, se, sut)
    if key == "soderberg":
        return soderberg_correction(stress_amplitude, mean_stress, se, sy)
    if key == "morrow":
        return morrow_correction(stress_amplitude, mean_stress, se, sigma_f_prime)
    raise ValueError(
        f"Unknown mean stress model '{model}'. Valid: goodman, gerber, soderberg, morrow"
    )


def fit_basquin_from_points(points: list[SNDataPoint]) -> BasquinFitResult:
    """Fit Basquin power law from user points using log-log regression.

    Fits S = a*N^b and maps to S = sigma_f'*(2N)^b where
    sigma_f' = a / (2^b).
    """
    if len(points) < 2:
        raise ValueError("At least two S-N points are required for Basquin fitting")

    n_values = np.array([p.cycles for p in points], dtype=float)
    s_values = np.array([p.stress for p in points], dtype=float)

    if np.any(n_values <= 0.0) or np.any(s_values <= 0.0):
        raise ValueError("All S-N points must have positive cycles and stress")

    if len(np.unique(n_values)) < 2:
        raise ValueError("At least two unique cycle values are required")

    x = np.log10(n_values)
    y = np.log10(s_values)
    slope_b, intercept = np.polyfit(x, y, 1)

    if not np.isfinite(slope_b) or not np.isfinite(intercept):
        raise ValueError("Basquin fitting failed due to non-finite regression coefficients")

    y_pred = intercept + slope_b * x
    ss_res = float(np.sum((y - y_pred) ** 2))
    ss_tot = float(np.sum((y - np.mean(y)) ** 2))
    r_squared = 1.0 if ss_tot <= 1e-14 else 1.0 - ss_res / ss_tot

    a_coeff = float(10.0 ** intercept)
    b_exponent = float(slope_b)
    sigma_f_prime = float(a_coeff / (2.0 ** b_exponent))

    if b_exponent >= 0.0:
        raise ValueError("Fitted Basquin exponent must be negative for physical S-N behavior")

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
    """Calculate notch sensitivity q and fatigue concentration Kf.

    Neuber: q = 1 / (1 + sqrt(a/r))
    Kuhn-Hardrath: q = 1 / (1 + a/r)
    """
    if kt < 1.0:
        raise ValueError("Kt must be >= 1")
    if notch_radius_mm <= 0.0 or notch_constant_mm <= 0.0:
        raise ValueError("Notch radius and notch constant must be > 0")

    key = model.lower().strip()
    ratio = notch_constant_mm / notch_radius_mm

    if key == "neuber":
        q = 1.0 / (1.0 + float(np.sqrt(ratio)))
    elif key == "kuhn_hardrath":
        q = 1.0 / (1.0 + ratio)
    else:
        raise ValueError("Unknown notch model. Valid: neuber, kuhn_hardrath")

    q = float(np.clip(q, 0.0, 1.0))
    kf = 1.0 + q * (kt - 1.0)
    kf = float(np.clip(kf, 1.0, kt))

    return NotchSensitivityResult(model=key, kt=float(kt), q=q, kf=kf)


def palmgren_miner_damage(
    blocks: list[LoadingBlock],
    sigma_f_prime: float,
    b: float,
    se: float,
    sut: float,
    sy: float,
    model: str,
) -> MinerDamageResult:
    """Compute cumulative damage with Palmgren-Miner linear rule."""
    if len(blocks) == 0:
        raise ValueError("At least one loading block is required")

    total_damage = 0.0
    block_results: list[MinerBlockResult] = []

    for idx, block in enumerate(blocks):
        if block.cycles <= 0.0 or block.repeats < 1:
            raise ValueError("Each loading block must have cycles > 0 and repeats >= 1")

        sa = (block.max_stress - block.min_stress) / 2.0
        sm = (block.max_stress + block.min_stress) / 2.0
        correction = get_mean_stress_correction(
            model=model,
            stress_amplitude=sa,
            mean_stress=sm,
            se=se,
            sut=sut,
            sy=sy,
            sigma_f_prime=sigma_f_prime,
        )

        eq_sa = correction.equivalent_alternating_stress
        nf = (
            basquin_cycles_to_failure(eq_sa, sigma_f_prime, b)
            if np.isfinite(eq_sa)
            else None
        )

        applied_cycles = float(block.cycles * block.repeats)
        if nf is None or nf <= 0.0:
            damage = float("inf") if applied_cycles > 0 else 0.0
        else:
            damage = applied_cycles / nf

        total_damage += damage
        block_results.append(
            MinerBlockResult(
                block_index=idx,
                stress_amplitude=float(sa),
                mean_stress=float(sm),
                equivalent_alternating_stress=float(eq_sa),
                cycles_to_failure=nf,
                applied_cycles=applied_cycles,
                damage=float(damage),
            )
        )

    predicted_blocks_to_failure: Optional[float]
    if not np.isfinite(total_damage) or total_damage <= 0.0:
        predicted_blocks_to_failure = None if not np.isfinite(total_damage) else float("inf")
    else:
        predicted_blocks_to_failure = 1.0 / total_damage

    return MinerDamageResult(
        total_damage=float(total_damage),
        predicted_blocks_to_failure=predicted_blocks_to_failure,
        is_failure=bool(total_damage >= 1.0),
        block_results=block_results,
    )


# ---------------------------------------------------------------------------
# S-N curve generation
# ---------------------------------------------------------------------------
def generate_sn_curve(
    sigma_f_prime: float,
    b: float,
    num_points: int = 100,
    n_min: float = 1e1,
    n_max: float = 1e9,
) -> list[SNDataPoint]:
    """Generate S-N curve data points using Basquin's equation.

    Creates logarithmically-spaced cycle counts from n_min to n_max
    and computes the corresponding stress amplitude for each.

    Args:
        sigma_f_prime: Fatigue strength coefficient in MPa.
        b: Fatigue strength exponent (negative).
        num_points: Number of data points to generate.
        n_min: Minimum number of cycles.
        n_max: Maximum number of cycles.

    Returns:
        List of SNDataPoint with (cycles, stress) pairs.
    """
    cycles_array = np.logspace(np.log10(n_min), np.log10(n_max), num_points)
    points: list[SNDataPoint] = []
    for n in cycles_array:
        stress = basquin_stress_amplitude(n, sigma_f_prime, b)
        if np.isfinite(stress) and stress > 0:
            points.append(SNDataPoint(cycles=float(n), stress=float(stress)))
    return points


# ---------------------------------------------------------------------------
# Failure envelope generation for Goodman diagram
# ---------------------------------------------------------------------------
def generate_goodman_envelope(
    se: float, sut: float, num_points: int = 50
) -> list[dict[str, float]]:
    """Generate the modified Goodman failure envelope.

    Linear line from (Sm=0, Sa=Se) to (Sm=Sut, Sa=0).

    Args:
        se: Modified endurance limit in MPa.
        sut: Ultimate tensile strength in MPa.
        num_points: Number of envelope points.

    Returns:
        List of dicts with 'mean_stress' and 'stress_amplitude' keys.
    """
    mean_stresses = np.linspace(0.0, sut, num_points)
    envelope: list[dict[str, float]] = []
    for sm in mean_stresses:
        sa = se * (1.0 - sm / sut)
        envelope.append({
            "mean_stress": float(sm),
            "stress_amplitude": float(max(sa, 0.0)),
        })
    return envelope


def generate_gerber_envelope(
    se: float, sut: float, num_points: int = 50
) -> list[dict[str, float]]:
    """Generate the Gerber parabolic failure envelope.

    Parabola from (Sm=0, Sa=Se) to (Sm=Sut, Sa=0):
    Sa = Se * (1 - (Sm/Sut)^2)

    Args:
        se: Modified endurance limit in MPa.
        sut: Ultimate tensile strength in MPa.
        num_points: Number of envelope points.

    Returns:
        List of dicts with 'mean_stress' and 'stress_amplitude' keys.
    """
    mean_stresses = np.linspace(0.0, sut, num_points)
    envelope: list[dict[str, float]] = []
    for sm in mean_stresses:
        sa = se * (1.0 - (sm / sut) ** 2)
        envelope.append({
            "mean_stress": float(sm),
            "stress_amplitude": float(max(sa, 0.0)),
        })
    return envelope


def generate_soderberg_envelope(
    se: float, sy: float, num_points: int = 50
) -> list[dict[str, float]]:
    """Generate the Soderberg failure envelope.

    Linear line from (Sm=0, Sa=Se) to (Sm=Sy, Sa=0).

    Args:
        se: Modified endurance limit in MPa.
        sy: Yield strength in MPa.
        num_points: Number of envelope points.

    Returns:
        List of dicts with 'mean_stress' and 'stress_amplitude' keys.
    """
    mean_stresses = np.linspace(0.0, sy, num_points)
    envelope: list[dict[str, float]] = []
    for sm in mean_stresses:
        sa = se * (1.0 - sm / sy)
        envelope.append({
            "mean_stress": float(sm),
            "stress_amplitude": float(max(sa, 0.0)),
        })
    return envelope


def generate_morrow_envelope(
    se: float, sigma_f_prime: float, num_points: int = 50
) -> list[dict[str, float]]:
    """Generate the Morrow failure envelope.

    Linear line from (Sm=0, Sa=Se) to (Sm=sigma_f', Sa=0).

    Args:
        se: Modified endurance limit in MPa.
        sigma_f_prime: Fatigue strength coefficient in MPa.
        num_points: Number of envelope points.

    Returns:
        List of dicts with 'mean_stress' and 'stress_amplitude' keys.
    """
    mean_stresses = np.linspace(0.0, sigma_f_prime, num_points)
    envelope: list[dict[str, float]] = []
    for sm in mean_stresses:
        sa = se * (1.0 - sm / sigma_f_prime)
        envelope.append({
            "mean_stress": float(sm),
            "stress_amplitude": float(max(sa, 0.0)),
        })
    return envelope


# ---------------------------------------------------------------------------
# Orchestration: full fatigue analysis
# ---------------------------------------------------------------------------
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
    sn_fit_points: Optional[list[dict[str, float]]] = None,
    notch: Optional[dict[str, float | str]] = None,
    loading_blocks: Optional[list[dict[str, float | int]]] = None,
) -> dict:
    """Execute a complete fatigue life analysis.

    Computes stress characterization, modified endurance limit, cycles to
    failure (Basquin), mean stress corrections (Goodman, Gerber, Soderberg,
    Morrow), S-N curve data, and failure envelopes for plotting.

    Args:
        max_stress: Maximum cyclic stress in MPa.
        min_stress: Minimum cyclic stress in MPa.
        uts: Ultimate tensile strength in MPa.
        yield_strength: Yield strength in MPa.
        endurance_limit: Known endurance limit in MPa (optional).
        elastic_modulus_gpa: Elastic modulus in GPa.
        fatigue_strength_coefficient: sigma_f' in MPa (optional).
        fatigue_strength_exponent: Basquin exponent b (optional).
        fatigue_ductility_coefficient: epsilon_f' (optional).
        fatigue_ductility_exponent: Coffin-Manson exponent c (optional).
        ka-ke: Marin modification factors.
        num_points: Number of S-N curve data points.

    Returns:
        Dictionary matching the FatigueAnalysisResponse schema.
    """
    # --- Stress characterization ---
    stress_amplitude = (max_stress - min_stress) / 2.0
    mean_stress = (max_stress + min_stress) / 2.0
    stress_ratio = (
        min_stress / max_stress if abs(max_stress) > 1e-12 else 0.0
    )

    # --- Material parameters with defaults ---
    sigma_f_prime = (
        fatigue_strength_coefficient
        if fatigue_strength_coefficient is not None
        else _DEFAULT_SIGMA_F_PRIME_FACTOR * uts
    )
    b_exponent = (
        fatigue_strength_exponent
        if fatigue_strength_exponent is not None
        else _DEFAULT_BASQUIN_EXPONENT
    )
    epsilon_f_prime = (
        fatigue_ductility_coefficient
        if fatigue_ductility_coefficient is not None
        else _DEFAULT_EPSILON_F_PRIME
    )
    c_exponent = (
        fatigue_ductility_exponent
        if fatigue_ductility_exponent is not None
        else _DEFAULT_DUCTILITY_EXPONENT
    )
    elastic_modulus_mpa = elastic_modulus_gpa * 1000.0

    basquin_fit: Optional[BasquinFitResult] = None
    if sn_fit_points is not None and len(sn_fit_points) > 0:
        parsed_points = [
            SNDataPoint(cycles=float(p["cycles"]), stress=float(p["stress"]))
            for p in sn_fit_points
        ]
        basquin_fit = fit_basquin_from_points(parsed_points)
        sigma_f_prime = basquin_fit.sigma_f_prime
        b_exponent = basquin_fit.b

    # --- Modified endurance limit ---
    se = calculate_modified_endurance_limit(
        uts_mpa=uts,
        endurance_limit=endurance_limit,
        ka=ka, kb=kb, kc=kc, kd=kd, ke=ke,
    )

    # --- Optional notch correction ---
    notch_result: Optional[NotchSensitivityResult] = None
    if notch is not None:
        notch_result = calculate_notch_sensitivity(
            kt=float(notch["kt"]),
            notch_radius_mm=float(notch["notch_radius_mm"]),
            notch_constant_mm=float(notch.get("notch_constant_mm", 0.25)),
            model=str(notch["model"]),
        )
        stress_amplitude *= notch_result.kf

    # --- Cycles to failure (Basquin) ---
    basquin_nf = basquin_cycles_to_failure(stress_amplitude, sigma_f_prime, b_exponent)

    # Also compute using equivalent alternating stress from each model
    cycles_to_failure: dict[str, float | None] = {
        "basquin": basquin_nf,
    }

    # --- Mean stress corrections ---
    corrections: list[MeanStressCorrectionResult] = []

    goodman_result = goodman_correction(
        stress_amplitude, mean_stress, se, uts
    )
    corrections.append(goodman_result)

    gerber_result = gerber_correction(
        stress_amplitude, mean_stress, se, uts
    )
    corrections.append(gerber_result)

    soderberg_result = soderberg_correction(
        stress_amplitude, mean_stress, se, yield_strength
    )
    corrections.append(soderberg_result)

    morrow_result = morrow_correction(
        stress_amplitude, mean_stress, se, sigma_f_prime
    )
    corrections.append(morrow_result)

    # Compute cycles to failure for each corrected stress
    for result in corrections:
        key = result.model_name.lower()
        if np.isfinite(result.equivalent_alternating_stress):
            nf = basquin_cycles_to_failure(
                result.equivalent_alternating_stress, sigma_f_prime, b_exponent
            )
            cycles_to_failure[key] = nf
        else:
            cycles_to_failure[key] = None

    selected_result = get_mean_stress_correction(
        model=selected_mean_stress_model,
        stress_amplitude=stress_amplitude,
        mean_stress=mean_stress,
        se=se,
        sut=uts,
        sy=yield_strength,
        sigma_f_prime=sigma_f_prime,
    )
    selected_key = selected_result.model_name.lower()
    selected_cycles_to_failure = cycles_to_failure.get(selected_key)

    # --- S-N curve ---
    sn_data = generate_sn_curve(sigma_f_prime, b_exponent, num_points)

    # --- Failure envelopes ---
    goodman_env = generate_goodman_envelope(se, uts)
    gerber_env = generate_gerber_envelope(se, uts)
    soderberg_env = generate_soderberg_envelope(se, yield_strength)
    morrow_env = generate_morrow_envelope(se, sigma_f_prime)

    miner_damage_result: Optional[MinerDamageResult] = None
    if loading_blocks is not None and len(loading_blocks) > 0:
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
            model=selected_mean_stress_model,
        )

    return {
        "stress_amplitude": float(stress_amplitude),
        "mean_stress": float(mean_stress),
        "stress_ratio": float(stress_ratio),
        "modified_endurance_limit": float(se),
        "cycles_to_failure": cycles_to_failure,
        "mean_stress_corrections": [
            {
                "model_name": r.model_name,
                "safety_factor": r.safety_factor,
                "equivalent_alternating_stress": r.equivalent_alternating_stress,
                "is_safe": r.is_safe,
            }
            for r in corrections
        ],
        "selected_mean_stress_model": selected_result.model_name,
        "selected_mean_stress_result": {
            "model_name": selected_result.model_name,
            "safety_factor": selected_result.safety_factor,
            "equivalent_alternating_stress": selected_result.equivalent_alternating_stress,
            "is_safe": selected_result.is_safe,
        },
        "selected_cycles_to_failure": selected_cycles_to_failure,
        "sn_curve_data": [
            {"cycles": p.cycles, "stress": p.stress} for p in sn_data
        ],
        "basquin_fit": {
            "a": basquin_fit.a,
            "b": basquin_fit.b,
            "sigma_f_prime": basquin_fit.sigma_f_prime,
            "r_squared": basquin_fit.r_squared,
            "points_used": basquin_fit.points_used,
        }
        if basquin_fit is not None
        else None,
        "goodman_envelope": goodman_env,
        "gerber_envelope": gerber_env,
        "soderberg_envelope": soderberg_env,
        "morrow_envelope": morrow_env,
        "operating_point": {
            "mean_stress": float(mean_stress),
            "stress_amplitude": float(stress_amplitude),
        },
        "notch_result": {
            "model": notch_result.model,
            "kt": notch_result.kt,
            "q": notch_result.q,
            "kf": notch_result.kf,
        }
        if notch_result is not None
        else None,
        "miner_damage": {
            "total_damage": miner_damage_result.total_damage,
            "predicted_blocks_to_failure": miner_damage_result.predicted_blocks_to_failure,
            "is_failure": miner_damage_result.is_failure,
            "block_results": [
                {
                    "block_index": r.block_index,
                    "stress_amplitude": r.stress_amplitude,
                    "mean_stress": r.mean_stress,
                    "equivalent_alternating_stress": r.equivalent_alternating_stress,
                    "cycles_to_failure": r.cycles_to_failure,
                    "applied_cycles": r.applied_cycles,
                    "damage": r.damage,
                }
                for r in miner_damage_result.block_results
            ],
        }
        if miner_damage_result is not None
        else None,
    }
