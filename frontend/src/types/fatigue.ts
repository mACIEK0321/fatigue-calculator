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
