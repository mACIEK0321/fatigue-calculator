export interface MaterialProperties {
  ultimate_tensile_strength: number;
  yield_strength: number;
  endurance_limit: number;
  elastic_modulus: number;
  fatigue_strength_coefficient: number;
  fatigue_strength_exponent: number;
  fatigue_ductility_coefficient: number;
  fatigue_ductility_exponent: number;
}

export interface MarinFactors {
  surface: number;
  size: number;
  load: number;
  temperature: number;
  reliability: number;
}

export interface SurfaceFinishInput {
  finish_type: "ground" | "machined" | "hot_rolled" | "forged";
  tensile_strength: number;
}

export interface FatigueAnalysisRequest {
  material: MaterialProperties;
  max_stress: number;
  min_stress: number;
  surface_finish: string;
  marin_factors: MarinFactors;
}

export interface MeanStressCorrectionResult {
  model: string;
  cycles_to_failure: number;
  safety_factor: number;
}

export interface SNDataPoint {
  cycles: number;
  stress: number;
}

export interface GoodmanEnvelope {
  mean_stress: number;
  stress_amplitude: number;
}

export interface FatigueAnalysisResponse {
  stress_amplitude: number;
  mean_stress: number;
  stress_ratio: number;
  modified_endurance_limit: number;
  mean_stress_corrections: MeanStressCorrectionResult[];
  sn_curve_data: SNDataPoint[];
  goodman_envelope: GoodmanEnvelope[];
  gerber_envelope: GoodmanEnvelope[];
  soderberg_envelope: GoodmanEnvelope[];
  morrow_envelope: GoodmanEnvelope[];
  operating_point: {
    mean_stress: number;
    stress_amplitude: number;
  };
}

export interface MaterialPreset {
  name: string;
  properties: MaterialProperties;
}
