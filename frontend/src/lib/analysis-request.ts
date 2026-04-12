import type {
  AIComparisonOptions,
  FatigueAnalysisCompareRequest,
  FatigueAnalysisRequest,
  LoadingBlock,
  MarinFactors,
  MaterialProperties,
  MeanStressModel,
  NotchSensitivityInput,
  SNCurveSourceMode,
  SNFitPoint,
  SurfaceFactorMode,
  SurfaceFinishType,
} from "@/types/fatigue";
import { sanitizeSNFitPoints } from "@/lib/basquin-fit";

export interface FatigueFormValues {
  material: MaterialProperties;
  maxStress: number;
  minStress: number;
  snCurveSourceMode: SNCurveSourceMode;
  snPoints: SNFitPoint[];
  surfaceFactorMode: SurfaceFactorMode;
  surfaceFinish: SurfaceFinishType;
  manualSurfaceFactor: number;
  marinFactors: MarinFactors;
  selectedModel: MeanStressModel;
  useNotch: boolean;
  notch: NotchSensitivityInput;
  loadingBlocks: LoadingBlock[];
}

function optionalNumber(value: number | null | undefined): number | undefined {
  return value === undefined || value === null || Number.isNaN(value)
    ? undefined
    : value;
}

export function sanitizePoints(points: SNFitPoint[]): SNFitPoint[] {
  return sanitizeSNFitPoints(points);
}

export function buildFatigueAnalysisRequest(
  values: FatigueFormValues
): FatigueAnalysisRequest {
  const validSNPoints = sanitizePoints(values.snPoints);

  return {
    material: {
      ...values.material,
      endurance_limit: optionalNumber(values.material.endurance_limit),
      fatigue_strength_coefficient: optionalNumber(
        values.material.fatigue_strength_coefficient
      ),
      fatigue_strength_exponent: optionalNumber(
        values.material.fatigue_strength_exponent
      ),
      fatigue_ductility_coefficient: optionalNumber(
        values.material.fatigue_ductility_coefficient
      ),
      fatigue_ductility_exponent: optionalNumber(
        values.material.fatigue_ductility_exponent
      ),
    },
    max_stress: values.maxStress,
    min_stress: values.minStress,
    sn_curve_source:
      values.snCurveSourceMode === "points_fit"
        ? { mode: "points_fit", points: validSNPoints }
        : { mode: "material_basquin" },
    surface_factor_selection:
      values.surfaceFactorMode === "manual_factor"
        ? {
            mode: "manual_factor",
            surface_factor: values.manualSurfaceFactor,
          }
        : {
            mode: "empirical_surface_finish",
            finish_type: values.surfaceFinish,
          },
    marin_factors: values.marinFactors,
    selected_mean_stress_model: values.selectedModel,
    notch: values.useNotch ? values.notch : undefined,
    loading_blocks:
      values.loadingBlocks.length > 0 ? values.loadingBlocks : undefined,
  };
}

export function buildFatigueComparisonRequest(
  values: FatigueFormValues,
  aiComparison: AIComparisonOptions
): FatigueAnalysisCompareRequest {
  return {
    ...buildFatigueAnalysisRequest(values),
    ai_comparison: aiComparison,
  };
}
