export type SurfaceFinishType =
  | "ground"
  | "machined"
  | "hot_rolled"
  | "forged";

export type SurfaceFactorMode =
  | "empirical_surface_finish"
  | "manual_factor";

export type MeanStressModel =
  | "goodman"
  | "gerber"
  | "soderberg"
  | "morrow";

export type NotchModel = "neuber" | "kuhn_hardrath";

export type SNCurveSourceMode = "material_basquin" | "points_fit";

export type FatigueLifeStatus = "finite" | "infinite";
export type AIComparisonStatus = "success" | "error" | "skipped";
export type AIInterpretationStatus = "success" | "error" | "skipped";
export type AIComparisonErrorCode =
  | "disabled"
  | "not_configured"
  | "timeout"
  | "http_error"
  | "empty_response"
  | "invalid_json"
  | "schema_validation"
  | "unexpected_error";
export type AIInterpretationErrorCode =
  | "disabled"
  | "not_configured"
  | "timeout"
  | "http_error"
  | "empty_response"
  | "invalid_json"
  | "schema_validation"
  | "unexpected_error";
export type StressImageDetectedQuantity =
  | "von_mises"
  | "equivalent_stress"
  | "unknown";
export type ConfidenceLevel = "high" | "medium" | "low";

export interface MaterialProperties {
  uts: number;
  yield_strength: number;
  endurance_limit?: number | null;
  elastic_modulus: number;
  fatigue_strength_coefficient?: number;
  fatigue_strength_exponent?: number;
  fatigue_ductility_coefficient?: number;
  fatigue_ductility_exponent?: number;
}

export interface MarinFactors {
  size_factor: number;
  load_factor: number;
  temperature_factor: number;
  reliability_factor: number;
}

export interface SurfaceFactorSelection {
  mode: SurfaceFactorMode;
  finish_type?: SurfaceFinishType;
  surface_factor?: number;
}

export interface SNFitPoint {
  cycles: number;
  stress: number;
}

export interface SNCurveSourceInput {
  mode: SNCurveSourceMode;
  points?: SNFitPoint[];
}

export interface NotchSensitivityInput {
  model: NotchModel;
  kt: number;
  notch_radius_mm: number;
  notch_constant_mm: number;
}

export interface LoadingBlock {
  max_stress: number;
  min_stress: number;
  cycles: number;
  repeats: number;
}

export interface FatigueAnalysisRequest {
  material: MaterialProperties;
  max_stress: number;
  min_stress: number;
  sn_curve_source: SNCurveSourceInput;
  surface_factor_selection: SurfaceFactorSelection;
  marin_factors: MarinFactors;
  num_points?: number;
  selected_mean_stress_model?: MeanStressModel;
  notch?: NotchSensitivityInput;
  loading_blocks?: LoadingBlock[];
}

export interface AIComparisonOptions {
  enabled: boolean;
  include_interpreted_inputs?: boolean;
  include_sn_curve_points?: boolean;
  include_goodman_or_haigh_points?: boolean;
  max_points_per_series?: number;
}

export interface FatigueAnalysisCompareRequest extends FatigueAnalysisRequest {
  ai_comparison: AIComparisonOptions;
}

export interface StressImageReadResponse {
  success: boolean;
  detected_quantity: StressImageDetectedQuantity;
  detected_label?: string | null;
  detected_unit: string;
  max_value?: number | null;
  min_value?: number | null;
  confidence: ConfidenceLevel;
  notes: string[];
  is_usable_for_prefill: boolean;
}

export interface AIInterpretationOptions {
  enabled: boolean;
}

export interface FatigueAnalysisInterpretRequest extends FatigueAnalysisRequest {
  ai_interpretation: AIInterpretationOptions;
  vision_context?: StressImageReadResponse;
}

export interface FatigueLifeResult {
  status: FatigueLifeStatus;
  cycles: number | null;
  reason: string;
}

export interface MeanStressCorrectionResult {
  model_name: MeanStressModel;
  effective_mean_stress: number;
  safety_factor: number;
  equivalent_alternating_stress: number | null;
  is_safe: boolean;
  life: FatigueLifeResult;
}

export interface SNDataPoint {
  cycles: number;
  stress: number;
}

export interface BasquinFitResult {
  a: number;
  b: number;
  sigma_f_prime: number;
  r_squared: number;
  points_used: number;
}

export interface BasquinParameterSet {
  sigma_f_prime: number;
  b: number;
  source: string;
}

export interface SNCurveSourceResult {
  mode: SNCurveSourceMode;
  basquin_parameters: BasquinParameterSet;
  basquin_fit?: BasquinFitResult | null;
}

export interface NotchSensitivityResult {
  model: NotchModel;
  kt: number;
  q: number;
  kf: number;
}

export interface StressState {
  input_max_stress: number;
  input_min_stress: number;
  corrected_max_stress: number;
  corrected_min_stress: number;
  stress_amplitude: number;
  mean_stress: number;
  stress_ratio: number;
}

export interface HaighPoint {
  mean_stress: number;
  stress_amplitude: number;
}

export interface SNChartPoint {
  cycles: number | null;
  display_cycles: number;
  stress: number;
  status: FatigueLifeStatus;
  label: string;
}

export interface SNChartData {
  curve: SNDataPoint[];
  endurance_limit: number;
  selected_point?: SNChartPoint | null;
}

export interface HaighDiagramData {
  goodman_envelope: HaighPoint[];
  gerber_envelope: HaighPoint[];
  soderberg_envelope: HaighPoint[];
  morrow_envelope: HaighPoint[];
  operating_point: HaighPoint;
  corrected_operating_point?: HaighPoint | null;
}

export interface MinerBlockResult {
  block_index: number;
  input_max_stress: number;
  input_min_stress: number;
  corrected_max_stress: number;
  corrected_min_stress: number;
  stress_amplitude: number;
  mean_stress: number;
  equivalent_alternating_stress: number | null;
  life: FatigueLifeResult;
  applied_cycles: number;
  damage: number | null;
}

export interface MinerDamageResult {
  total_damage: number | null;
  sequence_life: FatigueLifeResult;
  is_failure: boolean;
  block_results: MinerBlockResult[];
}

export interface FatigueAnalysisResponse {
  stress_state: StressState;
  modified_endurance_limit: number;
  sn_curve_source: SNCurveSourceResult;
  cycles_to_failure: Record<MeanStressModel, FatigueLifeResult>;
  mean_stress_corrections: MeanStressCorrectionResult[];
  selected_mean_stress_model: MeanStressModel;
  selected_mean_stress_result: MeanStressCorrectionResult;
  selected_life: FatigueLifeResult;
  sn_chart: SNChartData;
  haigh_diagram: HaighDiagramData;
  notch_result?: NotchSensitivityResult | null;
  miner_damage?: MinerDamageResult | null;
}

export interface AIComparisonBasquinParameters {
  sigma_f_prime?: number | null;
  b?: number | null;
  source?: string | null;
}

export interface AIComparisonInterpretedInputs {
  material_label?: string | null;
  sn_curve_source: string;
  surface_factor?: number | null;
  marin_factors: MarinFactors;
  notch_correction_factor?: number | null;
  loading_blocks_count: number;
}

export interface AIComparisonStressState {
  max_stress: number;
  min_stress: number;
  mean_stress: number;
  stress_amplitude: number;
  stress_ratio?: number | null;
}

export interface AIComparisonMeanStressResult {
  model_name: MeanStressModel;
  effective_mean_stress?: number | null;
  equivalent_alternating_stress?: number | null;
  is_safe?: boolean | null;
}

export interface AIComparisonLife {
  status: FatigueLifeStatus;
  cycles?: number | null;
  reason?: string | null;
}

export interface AIComparisonPoint {
  x: number;
  y: number;
}

export interface AIComparisonValidationIssue {
  field_path: string;
  expected_type?: string | null;
  actual_type?: string | null;
  error_type: string;
  missing: boolean;
  wrong_shape: boolean;
}

export interface AIComparisonResult {
  summary: string;
  assumptions?: string[] | null;
  interpreted_inputs?: AIComparisonInterpretedInputs | null;
  basquin_parameters: AIComparisonBasquinParameters;
  modified_endurance_limit?: number | null;
  stress_state: AIComparisonStressState;
  mean_stress_result?: AIComparisonMeanStressResult | null;
  life: AIComparisonLife;
  safety_factor?: number | null;
  sn_curve_points?: AIComparisonPoint[] | null;
  goodman_or_haigh_points?: AIComparisonPoint[] | null;
  warnings: string[];
  raw_model_name: string;
}

export interface AIComparisonError {
  code: AIComparisonErrorCode;
  message: string;
  retriable: boolean;
}

export interface AIComparisonMetadata {
  response_format?: string | null;
  schema_profile: string;
  schema_simplified: boolean;
  attempted_response_formats: string[];
  fallback_used: boolean;
  omitted_or_null_fields: string[];
  problematic_fields: string[];
  validation_issue_count: number;
  validation_issues: AIComparisonValidationIssue[];
}

export interface AIComparisonEnvelope {
  provider: string;
  enabled: boolean;
  status: AIComparisonStatus;
  result?: AIComparisonResult | null;
  error?: AIComparisonError | null;
  metadata?: AIComparisonMetadata | null;
}

export interface FatigueAnalysisCompareResponse {
  native_analysis: FatigueAnalysisResponse;
  ai_comparison: AIComparisonEnvelope;
}

export interface AIInterpretationResult {
  summary: string;
  key_findings: string[];
  warnings: string[];
  engineering_notes: string[];
  raw_model_name: string;
}

export interface AIInterpretationError {
  code: AIInterpretationErrorCode;
  message: string;
  retriable: boolean;
}

export interface AIInterpretationValidationIssue {
  field_path: string;
  expected_type?: string | null;
  actual_type?: string | null;
  error_type: string;
  missing: boolean;
  wrong_shape: boolean;
}

export interface AIInterpretationMetadata {
  response_format?: string | null;
  attempted_response_formats: string[];
  fallback_used: boolean;
  problematic_fields: string[];
  validation_issue_count: number;
  validation_issues: AIInterpretationValidationIssue[];
}

export interface AIInterpretationEnvelope {
  provider: string;
  enabled: boolean;
  status: AIInterpretationStatus;
  result?: AIInterpretationResult | null;
  error?: AIInterpretationError | null;
  metadata?: AIInterpretationMetadata | null;
}

export interface FatigueAnalysisInterpretResponse {
  native_analysis: FatigueAnalysisResponse;
  ai_interpretation: AIInterpretationEnvelope;
}

export interface SurfaceFinishInput {
  finish_type: SurfaceFinishType;
  uts: number;
}

export interface MaterialPreset {
  name: string;
  uts: number;
  yield_strength: number;
  endurance_limit?: number | null;
  elastic_modulus: number;
  fatigue_strength_coefficient?: number;
  fatigue_strength_exponent?: number;
  fatigue_ductility_coefficient?: number;
  fatigue_ductility_exponent?: number;
}
