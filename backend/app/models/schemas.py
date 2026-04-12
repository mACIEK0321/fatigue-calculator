"""Pydantic models for the fatigue analysis API."""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, model_validator


class SurfaceFinishType(str, Enum):
    ground = "ground"
    machined = "machined"
    hot_rolled = "hot_rolled"
    forged = "forged"


class SurfaceFactorMode(str, Enum):
    empirical_surface_finish = "empirical_surface_finish"
    manual_factor = "manual_factor"


class MeanStressModel(str, Enum):
    goodman = "goodman"
    gerber = "gerber"
    soderberg = "soderberg"
    morrow = "morrow"


class NotchModel(str, Enum):
    neuber = "neuber"
    kuhn_hardrath = "kuhn_hardrath"


class SNCurveSourceMode(str, Enum):
    material_basquin = "material_basquin"
    points_fit = "points_fit"


class FatigueLifeStatus(str, Enum):
    finite = "finite"
    infinite = "infinite"


class AIComparisonStatus(str, Enum):
    success = "success"
    error = "error"
    skipped = "skipped"


class AIComparisonErrorCode(str, Enum):
    disabled = "disabled"
    not_configured = "not_configured"
    timeout = "timeout"
    http_error = "http_error"
    empty_response = "empty_response"
    invalid_json = "invalid_json"
    schema_validation = "schema_validation"
    unexpected_error = "unexpected_error"


class MaterialProperties(BaseModel):
    uts: float = Field(..., description="Ultimate tensile strength in MPa", gt=0)
    yield_strength: float = Field(..., description="Yield strength in MPa", gt=0)
    endurance_limit: Optional[float] = Field(
        None,
        description="Endurance limit Se' in MPa if known",
        gt=0,
    )
    elastic_modulus: float = Field(210.0, description="Elastic modulus in GPa", gt=0)
    fatigue_strength_coefficient: Optional[float] = Field(
        None,
        description="Fatigue strength coefficient sigma_f' in MPa",
        gt=0,
    )
    fatigue_strength_exponent: Optional[float] = Field(
        None,
        description="Fatigue strength exponent b for Basquin (must be negative)",
    )
    fatigue_ductility_coefficient: Optional[float] = Field(
        None,
        description="Fatigue ductility coefficient epsilon_f'",
        gt=0,
    )
    fatigue_ductility_exponent: Optional[float] = Field(
        None,
        description="Fatigue ductility exponent c for Coffin-Manson",
    )

    @model_validator(mode="after")
    def validate_consistency(self) -> "MaterialProperties":
        if self.yield_strength > self.uts:
            raise ValueError("yield_strength cannot exceed uts")
        if (
            self.fatigue_strength_exponent is not None
            and self.fatigue_strength_exponent >= 0
        ):
            raise ValueError("fatigue_strength_exponent must be negative")
        return self


class MarinFactors(BaseModel):
    size_factor: float = Field(1.0, description="Size factor kb", gt=0)
    load_factor: float = Field(1.0, description="Load factor kc", gt=0)
    temperature_factor: float = Field(1.0, description="Temperature factor kd", gt=0)
    reliability_factor: float = Field(1.0, description="Reliability factor ke", gt=0)


class SurfaceFactorSelection(BaseModel):
    mode: SurfaceFactorMode = Field(
        SurfaceFactorMode.empirical_surface_finish,
        description="How ka is defined",
    )
    finish_type: Optional[SurfaceFinishType] = Field(
        None,
        description="Surface finish used in empirical ka calculation",
    )
    surface_factor: Optional[float] = Field(
        None,
        description="Manual ka value",
        gt=0,
    )

    @model_validator(mode="after")
    def validate_mode(self) -> "SurfaceFactorSelection":
        if self.mode == SurfaceFactorMode.empirical_surface_finish:
            if self.finish_type is None:
                raise ValueError("finish_type is required for empirical_surface_finish mode")
            if self.surface_factor is not None:
                raise ValueError("surface_factor must not be provided in empirical mode")
        if self.mode == SurfaceFactorMode.manual_factor:
            if self.surface_factor is None:
                raise ValueError("surface_factor is required for manual_factor mode")
            if self.finish_type is not None:
                raise ValueError("finish_type must not be provided in manual_factor mode")
        return self


class SNFitPoint(BaseModel):
    cycles: float = Field(..., description="Cycles N", gt=0)
    stress: float = Field(..., description="Stress amplitude S in MPa", gt=0)


class SNCurveSourceInput(BaseModel):
    mode: SNCurveSourceMode = Field(
        SNCurveSourceMode.material_basquin,
        description="How Basquin parameters are selected",
    )
    points: Optional[list[SNFitPoint]] = Field(
        None,
        description="S-N points used for Basquin fitting in points_fit mode",
    )

    @model_validator(mode="after")
    def validate_mode(self) -> "SNCurveSourceInput":
        if self.mode == SNCurveSourceMode.points_fit:
            if not self.points or len(self.points) < 2:
                raise ValueError("At least two S-N points are required for points_fit mode")
        if self.mode == SNCurveSourceMode.material_basquin and self.points:
            raise ValueError("points must not be provided in material_basquin mode")
        return self


class NotchSensitivityInput(BaseModel):
    model: NotchModel = Field(..., description="Notch sensitivity model")
    kt: float = Field(..., description="Theoretical stress concentration factor Kt", ge=1.0)
    notch_radius_mm: float = Field(..., description="Notch root radius in mm", gt=0)
    notch_constant_mm: float = Field(
        0.25,
        description="Material notch constant in mm",
        gt=0,
    )


class LoadingBlock(BaseModel):
    max_stress: float = Field(..., description="Maximum cyclic stress in MPa")
    min_stress: float = Field(..., description="Minimum cyclic stress in MPa")
    cycles: float = Field(..., description="Applied cycles per block", gt=0)
    repeats: int = Field(1, description="Block repeats", ge=1)

    @model_validator(mode="after")
    def validate_bounds(self) -> "LoadingBlock":
        if self.max_stress < self.min_stress:
            raise ValueError("max_stress must be greater than or equal to min_stress")
        return self


class SurfaceFinishInput(BaseModel):
    finish_type: SurfaceFinishType = Field(..., description="Type of surface finish")
    uts: float = Field(..., description="Ultimate tensile strength in MPa", gt=0)


class FatigueAnalysisRequest(BaseModel):
    max_stress: float = Field(..., description="Maximum cyclic stress in MPa")
    min_stress: float = Field(..., description="Minimum cyclic stress in MPa")
    material: MaterialProperties
    sn_curve_source: SNCurveSourceInput = Field(
        default_factory=SNCurveSourceInput,
        description="Explicit selection of S-N curve source",
    )
    surface_factor_selection: SurfaceFactorSelection = Field(
        default_factory=SurfaceFactorSelection,
        description="Explicit selection of ka source",
    )
    marin_factors: MarinFactors = Field(
        default_factory=MarinFactors,
        description="Marin modification factors except ka",
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
    notch: Optional[NotchSensitivityInput] = Field(
        None,
        description="Optional notch sensitivity input",
    )
    loading_blocks: Optional[list[LoadingBlock]] = Field(
        None,
        description="Optional loading blocks for Palmgren-Miner damage",
    )

    @model_validator(mode="after")
    def validate_bounds(self) -> "FatigueAnalysisRequest":
        if self.max_stress < self.min_stress:
            raise ValueError("max_stress must be greater than or equal to min_stress")
        if self.sn_curve_source.mode == SNCurveSourceMode.material_basquin:
            has_sigma_f = self.material.fatigue_strength_coefficient is not None
            has_b = self.material.fatigue_strength_exponent is not None
            if has_sigma_f != has_b:
                raise ValueError(
                    "fatigue_strength_coefficient and fatigue_strength_exponent "
                    "must be provided together in material_basquin mode"
                )
        return self


class AIComparisonOptions(BaseModel):
    enabled: bool = Field(
        False,
        description="Whether to request optional AI comparison through the backend",
    )
    include_interpreted_inputs: bool = Field(
        True,
        description="Whether the AI should echo its interpreted inputs",
    )
    include_sn_curve_points: bool = Field(
        True,
        description="Whether the AI should return S-N curve points",
    )
    include_goodman_or_haigh_points: bool = Field(
        True,
        description="Whether the AI should return Haigh/Goodman points",
    )
    max_points_per_series: int = Field(
        25,
        description="Maximum number of chart points to request for each AI series",
        ge=2,
        le=200,
    )


class FatigueAnalysisCompareRequest(FatigueAnalysisRequest):
    ai_comparison: AIComparisonOptions = Field(
        default_factory=AIComparisonOptions,
        description="Optional AI comparison configuration",
    )


class FatigueLifeResult(BaseModel):
    status: FatigueLifeStatus = Field(..., description="Finite or infinite fatigue life")
    cycles: Optional[float] = Field(
        None,
        description="Predicted cycles to failure when life is finite; omitted for infinite life",
        ge=0,
    )
    reason: str = Field(..., description="Why this life classification was returned")


class MeanStressCorrectionResult(BaseModel):
    model_name: MeanStressModel = Field(..., description="Name of the correction model")
    effective_mean_stress: float = Field(
        ...,
        description="Mean stress used by the correction model after model-specific handling",
    )
    safety_factor: float = Field(..., description="Fatigue safety factor n")
    equivalent_alternating_stress: Optional[float] = Field(
        None,
        description="Equivalent fully-reversed alternating stress in MPa; omitted when the model limit is exceeded",
    )
    is_safe: bool = Field(..., description="True if safety_factor >= 1.0")
    life: FatigueLifeResult = Field(..., description="Life after applying this correction")


class SNDataPoint(BaseModel):
    cycles: float = Field(..., description="Number of cycles N", gt=0)
    stress: float = Field(..., description="Stress amplitude in MPa", gt=0)


class BasquinFitResult(BaseModel):
    a: float = Field(..., description="Basquin coefficient for S = a*N^b")
    b: float = Field(..., description="Basquin exponent")
    sigma_f_prime: float = Field(..., description="Equivalent sigma_f' for S = sigma_f'*(2N)^b")
    r_squared: float = Field(..., description="Coefficient of determination")
    points_used: int = Field(..., description="Number of points used in fitting")


class BasquinParameterSet(BaseModel):
    sigma_f_prime: float = Field(..., description="Effective sigma_f' in MPa", gt=0)
    b: float = Field(..., description="Effective Basquin exponent", lt=0)
    source: str = Field(..., description="Where the active Basquin parameters came from")


class SNCurveSourceResult(BaseModel):
    mode: SNCurveSourceMode = Field(..., description="Active S-N curve source mode")
    basquin_parameters: BasquinParameterSet = Field(
        ...,
        description="Effective Basquin parameters used in the analysis",
    )
    basquin_fit: Optional[BasquinFitResult] = Field(
        None,
        description="Fit result when points_fit mode is used",
    )


class NotchSensitivityResult(BaseModel):
    model: NotchModel = Field(..., description="Notch sensitivity model")
    kt: float = Field(..., description="Theoretical stress concentration factor")
    q: float = Field(..., description="Notch sensitivity factor")
    kf: float = Field(..., description="Fatigue stress concentration factor")


class StressState(BaseModel):
    input_max_stress: float = Field(..., description="Input maximum stress in MPa")
    input_min_stress: float = Field(..., description="Input minimum stress in MPa")
    corrected_max_stress: float = Field(
        ...,
        description="Stress after notch correction, if any",
    )
    corrected_min_stress: float = Field(
        ...,
        description="Stress after notch correction, if any",
    )
    stress_amplitude: float = Field(..., description="Alternating stress amplitude in MPa")
    mean_stress: float = Field(..., description="Mean stress in MPa")
    stress_ratio: float = Field(..., description="Stress ratio R = min/max")


class HaighPoint(BaseModel):
    mean_stress: float = Field(..., description="Mean stress in MPa")
    stress_amplitude: float = Field(..., description="Alternating stress in MPa")


class SNChartPoint(BaseModel):
    cycles: Optional[float] = Field(
        None,
        description="Actual cycles value when finite; omitted for infinite life",
    )
    display_cycles: float = Field(
        ...,
        description="Cycle coordinate to use in the chart even for infinite life",
        gt=0,
    )
    stress: float = Field(..., description="Stress amplitude in MPa", gt=0)
    status: FatigueLifeStatus = Field(..., description="Finite or infinite point state")
    label: str = Field(..., description="Human-readable label for the chart marker")


class SNChartData(BaseModel):
    curve: list[SNDataPoint] = Field(..., description="S-N curve data points")
    endurance_limit: float = Field(..., description="Modified endurance limit Se in MPa")
    selected_point: Optional[SNChartPoint] = Field(
        None,
        description="Point or marker corresponding to the selected mean stress result",
    )


class HaighDiagramData(BaseModel):
    goodman_envelope: list[HaighPoint] = Field(..., description="Goodman failure envelope")
    gerber_envelope: list[HaighPoint] = Field(..., description="Gerber failure envelope")
    soderberg_envelope: list[HaighPoint] = Field(..., description="Soderberg failure envelope")
    morrow_envelope: list[HaighPoint] = Field(..., description="Morrow failure envelope")
    operating_point: HaighPoint = Field(..., description="Corrected operating point")
    corrected_operating_point: Optional[HaighPoint] = Field(
        None,
        description="Operating point after selected mean stress correction",
    )


class MinerBlockResult(BaseModel):
    block_index: int = Field(..., description="Zero-based block index")
    input_max_stress: float = Field(..., description="Input maximum block stress in MPa")
    input_min_stress: float = Field(..., description="Input minimum block stress in MPa")
    corrected_max_stress: float = Field(
        ...,
        description="Block maximum stress after notch correction",
    )
    corrected_min_stress: float = Field(
        ...,
        description="Block minimum stress after notch correction",
    )
    stress_amplitude: float = Field(..., description="Alternating stress in MPa")
    mean_stress: float = Field(..., description="Mean stress in MPa")
    equivalent_alternating_stress: Optional[float] = Field(
        None,
        description="Corrected equivalent alternating stress in MPa",
    )
    life: FatigueLifeResult = Field(
        ...,
        description="Predicted block life after mean stress correction",
    )
    applied_cycles: float = Field(..., description="Applied cycles in this block")
    damage: Optional[float] = Field(None, description="Miner damage contribution")


class MinerDamageResult(BaseModel):
    total_damage: Optional[float] = Field(
        None,
        description="Total cumulative Miner damage when finite",
    )
    sequence_life: FatigueLifeResult = Field(
        ...,
        description="Predicted life for one full loading sequence",
    )
    is_failure: bool = Field(..., description="True when cumulative damage >= 1")
    block_results: list[MinerBlockResult] = Field(
        ...,
        description="Per-block damage breakdown",
    )


class FatigueAnalysisResponse(BaseModel):
    stress_state: StressState = Field(..., description="Resolved cyclic stress state")
    modified_endurance_limit: float = Field(..., description="Modified endurance limit Se in MPa")
    sn_curve_source: SNCurveSourceResult = Field(
        ...,
        description="Resolved S-N curve source and active Basquin parameters",
    )
    cycles_to_failure: dict[str, FatigueLifeResult] = Field(
        ...,
        description="Predicted life by mean stress model key",
    )
    mean_stress_corrections: list[MeanStressCorrectionResult] = Field(
        ...,
        description="Results from each mean stress correction model",
    )
    selected_mean_stress_model: MeanStressModel = Field(
        ...,
        description="Primary selected mean stress model",
    )
    selected_mean_stress_result: MeanStressCorrectionResult = Field(
        ...,
        description="Result for the selected mean stress model",
    )
    selected_life: FatigueLifeResult = Field(
        ...,
        description="Selected fatigue life as the main user-facing result",
    )
    sn_chart: SNChartData = Field(..., description="S-N chart payload")
    haigh_diagram: HaighDiagramData = Field(..., description="Haigh diagram payload")
    notch_result: Optional[NotchSensitivityResult] = Field(
        None,
        description="Calculated notch sensitivity values",
    )
    miner_damage: Optional[MinerDamageResult] = Field(
        None,
        description="Palmgren-Miner cumulative damage result",
    )


class AIComparisonBasquinParameters(BaseModel):
    sigma_f_prime: Optional[float] = Field(
        None,
        description="AI-reported fatigue strength coefficient in MPa",
        gt=0,
    )
    b: Optional[float] = Field(
        None,
        description="AI-reported Basquin exponent",
        lt=0,
    )
    source: Optional[str] = Field(
        None,
        description="How the AI interpreted the active S-N curve source",
    )


class AIComparisonInterpretedInputs(BaseModel):
    material_label: Optional[str] = Field(
        None,
        description="Human-readable material label when available",
    )
    sn_curve_source: str = Field(
        ...,
        description="AI interpretation of the active S-N curve source",
    )
    surface_factor: Optional[float] = Field(
        None,
        description="Effective surface factor ka interpreted from the request",
        gt=0,
    )
    marin_factors: MarinFactors = Field(
        ...,
        description="Marin factors interpreted by the AI",
    )
    notch_correction_factor: Optional[float] = Field(
        None,
        description="AI interpretation of the effective fatigue notch factor",
        ge=1.0,
    )
    loading_blocks_count: int = Field(
        ...,
        description="Number of loading blocks considered by the AI",
        ge=0,
    )


class AIComparisonStressState(BaseModel):
    max_stress: float = Field(..., description="Maximum stress in MPa")
    min_stress: float = Field(..., description="Minimum stress in MPa")
    mean_stress: float = Field(..., description="Mean stress in MPa")
    stress_amplitude: float = Field(..., description="Alternating stress in MPa")
    stress_ratio: Optional[float] = Field(
        None,
        description="Stress ratio R = min/max",
    )


class AIComparisonMeanStressResult(BaseModel):
    model_name: MeanStressModel = Field(..., description="Mean stress model used by the AI")
    effective_mean_stress: Optional[float] = Field(
        None,
        description="Effective mean stress used by the AI",
    )
    equivalent_alternating_stress: Optional[float] = Field(
        None,
        description="Equivalent fully reversed alternating stress in MPa",
    )
    is_safe: Optional[bool] = Field(
        None,
        description="Whether the AI considers the case safe",
    )


class AIComparisonLife(BaseModel):
    status: FatigueLifeStatus = Field(..., description="Finite or infinite life")
    cycles: Optional[float] = Field(
        None,
        description="Predicted cycles to failure when life is finite",
        ge=0,
    )
    reason: Optional[str] = Field(
        None,
        description="Short explanation for the AI life estimate",
    )


class AIComparisonResult(BaseModel):
    summary: str = Field(..., description="Concise textual summary of the AI interpretation")
    assumptions: list[str] = Field(
        default_factory=list,
        description="Explicit assumptions stated by the AI",
    )
    interpreted_inputs: Optional[AIComparisonInterpretedInputs] = Field(
        None,
        description="Structured echo of the input interpreted by the AI",
    )
    basquin_parameters: AIComparisonBasquinParameters = Field(
        ...,
        description="AI-reported Basquin parameters",
    )
    modified_endurance_limit: Optional[float] = Field(
        None,
        description="AI-reported modified endurance limit in MPa",
        gt=0,
    )
    stress_state: AIComparisonStressState = Field(
        ...,
        description="AI-reported stress state",
    )
    mean_stress_result: Optional[AIComparisonMeanStressResult] = Field(
        None,
        description="AI-reported mean stress correction result",
    )
    life: AIComparisonLife = Field(
        ...,
        description="AI-reported fatigue life",
    )
    safety_factor: Optional[float] = Field(
        None,
        description="AI-reported safety factor",
        ge=0,
    )
    sn_curve_points: list[tuple[float, float]] = Field(
        default_factory=list,
        description="AI S-N curve points as [cycles, stress] numeric pairs",
    )
    goodman_or_haigh_points: list[tuple[float, float]] = Field(
        default_factory=list,
        description="AI Goodman/Haigh points as [mean_stress, stress_amplitude] numeric pairs",
    )
    warnings: list[str] = Field(
        default_factory=list,
        description="Warnings emitted by the AI",
    )
    raw_model_name: str = Field(
        ...,
        description="Exact upstream model identifier reported by the AI provider",
    )


class AIComparisonError(BaseModel):
    code: AIComparisonErrorCode = Field(..., description="Normalized AI comparison error code")
    message: str = Field(..., description="Human-readable diagnostic message")
    retriable: bool = Field(
        False,
        description="Whether retrying the AI request could plausibly succeed",
    )


class AIComparisonMetadata(BaseModel):
    response_format: Optional[str] = Field(
        None,
        description="Groq response_format mode that produced the final response",
    )
    schema_profile: str = Field(
        "minimal_v1",
        description="Identifier for the AI response schema profile used for this request",
    )
    schema_simplified: bool = Field(
        True,
        description="Whether the backend used the simplified AI response schema",
    )
    attempted_response_formats: list[str] = Field(
        default_factory=list,
        description="Ordered response_format modes attempted for this comparison",
    )
    fallback_used: bool = Field(
        False,
        description="Whether the backend retried with a fallback response_format",
    )
    omitted_or_null_fields: list[str] = Field(
        default_factory=list,
        description="Top-level AI response fields that were omitted or explicitly returned as null",
    )


class AIComparisonEnvelope(BaseModel):
    provider: str = Field(..., description="AI provider identifier")
    enabled: bool = Field(..., description="Whether the user requested the AI comparison")
    status: AIComparisonStatus = Field(..., description="Overall AI comparison status")
    result: Optional[AIComparisonResult] = Field(
        None,
        description="Structured AI comparison result on success",
    )
    error: Optional[AIComparisonError] = Field(
        None,
        description="Normalized AI comparison error on failure or skip",
    )
    metadata: Optional[AIComparisonMetadata] = Field(
        None,
        description="Optional diagnostics for the AI comparison request path",
    )


class FatigueAnalysisCompareResponse(BaseModel):
    native_analysis: FatigueAnalysisResponse = Field(
        ...,
        description="Native backend fatigue analysis result",
    )
    ai_comparison: AIComparisonEnvelope = Field(
        ...,
        description="Optional AI comparison payload and status",
    )
