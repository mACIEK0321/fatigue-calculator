"""Pydantic models for the FatigueMaster Pro fatigue analysis API.

All stress values are in MPa unless otherwise noted.
All modulus values are in GPa unless otherwise noted.
"""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class SurfaceFinishType(str, Enum):
    """Surface finish categories for Marin surface factor calculation."""

    ground = "ground"
    machined = "machined"
    hot_rolled = "hot_rolled"
    forged = "forged"


class MeanStressModel(str, Enum):
    """Supported mean stress correction models for design evaluation."""

    goodman = "goodman"
    gerber = "gerber"
    soderberg = "soderberg"


class NotchModel(str, Enum):
    """Supported notch sensitivity models."""

    neuber = "neuber"
    kuhn_hardrath = "kuhn_hardrath"


class MaterialProperties(BaseModel):
    """Material mechanical properties for fatigue analysis.

    At minimum, ultimate tensile strength (uts) and yield strength are required.
    Optional fatigue parameters enable more accurate Basquin/Coffin-Manson modeling.
    """

    uts: float = Field(..., description="Ultimate tensile strength in MPa", gt=0)
    yield_strength: float = Field(..., description="Yield strength in MPa", gt=0)
    endurance_limit: Optional[float] = Field(
        None, description="Endurance limit in MPa (if known)"
    )
    elastic_modulus: float = Field(
        210.0, description="Elastic modulus in GPa", gt=0
    )
    fatigue_strength_coefficient: Optional[float] = Field(
        None, description="Fatigue strength coefficient sigma_f' in MPa"
    )
    fatigue_strength_exponent: Optional[float] = Field(
        None, description="Fatigue strength exponent b (Basquin)"
    )
    fatigue_ductility_coefficient: Optional[float] = Field(
        None, description="Fatigue ductility coefficient epsilon_f'"
    )
    fatigue_ductility_exponent: Optional[float] = Field(
        None, description="Fatigue ductility exponent c (Coffin-Manson)"
    )


class MarinFactors(BaseModel):
    """Marin modification factors for endurance limit correction.

    Each factor defaults to 1.0 (no modification). Values should be
    between 0 and 1 for de-rating or above 1 for enhancement.
    """

    surface_factor: float = Field(1.0, description="Surface finish factor ka")
    size_factor: float = Field(1.0, description="Size factor kb")
    load_factor: float = Field(1.0, description="Load type factor kc")
    temperature_factor: float = Field(1.0, description="Temperature factor kd")
    reliability_factor: float = Field(1.0, description="Reliability factor ke")


class SNFitPoint(BaseModel):
    """S-N point supplied by user for Basquin curve fitting."""

    cycles: float = Field(..., description="Cycles N", gt=0)
    stress: float = Field(..., description="Stress amplitude S in MPa", gt=0)


class NotchSensitivityInput(BaseModel):
    """Inputs for notch sensitivity and fatigue stress concentration."""

    model: NotchModel = Field(..., description="Notch sensitivity model")
    kt: float = Field(..., description="Theoretical stress concentration factor Kt", ge=1.0)
    notch_radius_mm: float = Field(..., description="Notch root radius in mm", gt=0)
    notch_constant_mm: float = Field(
        0.25,
        description="Material notch constant in mm",
        gt=0,
    )


class LoadingBlock(BaseModel):
    """Single loading block for Palmgren-Miner accumulation."""

    max_stress: float = Field(..., description="Maximum cyclic stress in MPa")
    min_stress: float = Field(..., description="Minimum cyclic stress in MPa")
    cycles: float = Field(..., description="Applied cycles per block", gt=0)
    repeats: int = Field(1, description="Block repeats", ge=1)


class SurfaceFinishInput(BaseModel):
    """Input for empirical surface factor calculation.

    Uses Marin surface finish coefficients to compute ka = a * Sut^b.
    """

    finish_type: SurfaceFinishType = Field(
        ..., description="Type of surface finish"
    )
    uts: float = Field(
        ..., description="Ultimate tensile strength in MPa", gt=0
    )


class FatigueAnalysisRequest(BaseModel):
    """Complete input for a fatigue life analysis.

    Defines the cyclic loading (max/min stress), material properties,
    and optional modification factors.
    """

    max_stress: float = Field(..., description="Maximum cyclic stress in MPa")
    min_stress: float = Field(..., description="Minimum cyclic stress in MPa")
    material: MaterialProperties
    marin_factors: Optional[MarinFactors] = Field(
        None, description="Marin modification factors (optional)"
    )
    surface_finish: Optional[SurfaceFinishInput] = Field(
        None, description="Surface finish for ka calculation (optional)"
    )
    num_points: int = Field(
        100,
        description="Number of points for S-N curve generation",
        ge=10,
        le=1000,
    )
    selected_mean_stress_model: MeanStressModel = Field(
        MeanStressModel.goodman,
        description="Mean stress model used as primary design criterion",
    )
    sn_fit_points: Optional[list[SNFitPoint]] = Field(
        None,
        description="Optional user S-N points for Basquin fitting",
    )
    notch: Optional[NotchSensitivityInput] = Field(
        None,
        description="Optional notch sensitivity input",
    )
    loading_blocks: Optional[list[LoadingBlock]] = Field(
        None,
        description="Optional loading blocks for Palmgren-Miner damage",
    )


class MeanStressCorrectionResult(BaseModel):
    """Result from a single mean stress correction model."""

    model_name: str = Field(..., description="Name of the correction model")
    safety_factor: float = Field(..., description="Fatigue safety factor n")
    equivalent_alternating_stress: float = Field(
        ..., description="Equivalent fully-reversed alternating stress in MPa"
    )
    is_safe: bool = Field(
        ..., description="True if safety_factor >= 1.0"
    )


class SNDataPoint(BaseModel):
    """A single point on the S-N (Wohler) curve."""

    cycles: float = Field(..., description="Number of cycles N")
    stress: float = Field(..., description="Stress amplitude in MPa")


class BasquinFitResult(BaseModel):
    """Power law fit result for user-provided S-N points."""

    a: float = Field(..., description="Basquin coefficient for S = a*N^b")
    b: float = Field(..., description="Basquin exponent")
    sigma_f_prime: float = Field(..., description="Equivalent sigma_f' for S = sigma_f'*(2N)^b")
    r_squared: float = Field(..., description="Coefficient of determination")
    points_used: int = Field(..., description="Number of points used in fitting")


class NotchSensitivityResult(BaseModel):
    """Calculated notch sensitivity result."""

    model: str = Field(..., description="Notch sensitivity model")
    kt: float = Field(..., description="Theoretical stress concentration factor")
    q: float = Field(..., description="Notch sensitivity factor")
    kf: float = Field(..., description="Fatigue stress concentration factor")


class MinerBlockResult(BaseModel):
    """Damage result for one loading block."""

    block_index: int = Field(..., description="Zero-based block index")
    stress_amplitude: float = Field(..., description="Alternating stress in MPa")
    mean_stress: float = Field(..., description="Mean stress in MPa")
    equivalent_alternating_stress: float = Field(..., description="Corrected equivalent alternating stress in MPa")
    cycles_to_failure: Optional[float] = Field(..., description="Predicted cycles to failure for block")
    applied_cycles: float = Field(..., description="Applied cycles in this block")
    damage: float = Field(..., description="Miner damage contribution")


class MinerDamageResult(BaseModel):
    """Palmgren-Miner cumulative damage result."""

    total_damage: float = Field(..., description="Total cumulative Miner damage")
    predicted_blocks_to_failure: Optional[float] = Field(
        None,
        description="Estimated repetitions to failure at same sequence",
    )
    is_failure: bool = Field(..., description="True when cumulative damage >= 1")
    block_results: list[MinerBlockResult] = Field(
        ...,
        description="Per-block damage breakdown",
    )


class FatigueAnalysisResponse(BaseModel):
    """Complete output from a fatigue life analysis.

    Includes loading characterization, endurance limit, cycles to failure
    from multiple models, mean stress corrections, and plot data.
    """

    stress_amplitude: float = Field(
        ..., description="Alternating stress amplitude in MPa"
    )
    mean_stress: float = Field(..., description="Mean stress in MPa")
    stress_ratio: float = Field(..., description="Stress ratio R = min/max")
    modified_endurance_limit: float = Field(
        ..., description="Modified endurance limit Se in MPa"
    )
    cycles_to_failure: dict[str, Optional[float]] = Field(
        ...,
        description="Predicted cycles to failure by model (None if infinite life)",
    )
    mean_stress_corrections: list[MeanStressCorrectionResult] = Field(
        ..., description="Results from each mean stress correction model"
    )
    selected_mean_stress_model: str = Field(
        ..., description="Primary selected mean stress model"
    )
    selected_mean_stress_result: MeanStressCorrectionResult = Field(
        ..., description="Result for selected mean stress model"
    )
    selected_cycles_to_failure: Optional[float] = Field(
        ..., description="Cycles to failure from selected model"
    )
    sn_curve_data: list[SNDataPoint] = Field(
        ..., description="S-N curve data points for plotting"
    )
    basquin_fit: Optional[BasquinFitResult] = Field(
        None,
        description="Fitted Basquin parameters from user S-N points",
    )
    goodman_envelope: list[dict] = Field(
        ..., description="Goodman failure envelope points"
    )
    gerber_envelope: list[dict] = Field(
        ..., description="Gerber failure envelope points"
    )
    soderberg_envelope: list[dict] = Field(
        ..., description="Soderberg failure envelope points"
    )
    morrow_envelope: list[dict] = Field(
        ..., description="Morrow failure envelope points"
    )
    operating_point: dict = Field(
        ..., description="Operating point on Haigh diagram"
    )
    notch_result: Optional[NotchSensitivityResult] = Field(
        None,
        description="Calculated notch sensitivity values",
    )
    miner_damage: Optional[MinerDamageResult] = Field(
        None,
        description="Palmgren-Miner cumulative damage result",
    )
