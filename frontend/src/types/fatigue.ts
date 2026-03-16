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
  surface_factor: number;
  size_factor: number;
  load_factor: number;
  temperature_factor: number;
  reliability_factor: number;
}

export interface SurfaceFinishInput {
  finish_type: "ground" | "machined" | "hot_rolled" | "forged";
  uts: number;
}

export interface SNFitPoint {
  cycles: number;
  stress: number;
}

export interface NotchSensitivityInput {
  model: "neuber" | "kuhn_hardrath";
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
  surface_finish?: SurfaceFinishInput;
  marin_factors?: MarinFactors;
  num_points?: number;
  selected_mean_stress_model?: "goodman" | "gerber" | "soderberg";
  sn_fit_points?: SNFitPoint[];
  notch?: NotchSensitivityInput;
  loading_blocks?: LoadingBlock[];
}

export interface MeanStressCorrectionResult {
  model_name: string;
  safety_factor: number;
  equivalent_alternating_stress: number;
  is_safe: boolean;
}

export interface SNDataPoint {
  cycles: number;
  stress: number;
}

export interface GoodmanEnvelope {
  mean_stress: number;
  stress_amplitude: number;
}

export interface BasquinFitResult {
  a: number;
  b: number;
  sigma_f_prime: number;
  r_squared: number;
  points_used: number;
}

export interface NotchSensitivityResult {
  model: string;
  kt: number;
  q: number;
  kf: number;
}

export interface MinerBlockResult {
  block_index: number;
  stress_amplitude: number;
  mean_stress: number;
  equivalent_alternating_stress: number;
  cycles_to_failure: number | null;
  applied_cycles: number;
  damage: number;
}

export interface MinerDamageResult {
  total_damage: number;
  predicted_blocks_to_failure: number | null;
  is_failure: boolean;
  block_results: MinerBlockResult[];
}

export interface FatigueAnalysisResponse {
  stress_amplitude: number;
  mean_stress: number;
  stress_ratio: number;
  modified_endurance_limit: number;
  cycles_to_failure: Record<string, number | null>;
  mean_stress_corrections: MeanStressCorrectionResult[];
  selected_mean_stress_model: string;
  selected_mean_stress_result: MeanStressCorrectionResult;
  selected_cycles_to_failure: number | null;
  sn_curve_data: SNDataPoint[];
  basquin_fit?: BasquinFitResult | null;
  goodman_envelope: GoodmanEnvelope[];
  gerber_envelope: GoodmanEnvelope[];
  soderberg_envelope: GoodmanEnvelope[];
  morrow_envelope: GoodmanEnvelope[];
  operating_point: {
    mean_stress: number;
    stress_amplitude: number;
  };
  notch_result?: NotchSensitivityResult | null;
  miner_damage?: MinerDamageResult | null;
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
