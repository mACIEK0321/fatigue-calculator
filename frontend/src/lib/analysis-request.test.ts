import { describe, expect, it } from "vitest";
import { buildFatigueAnalysisRequest } from "@/lib/analysis-request";

describe("buildFatigueAnalysisRequest", () => {
  it("maps points-fit, notch, and Miner blocks into the backend contract", () => {
    const request = buildFatigueAnalysisRequest({
      material: {
        uts: 820,
        yield_strength: 690,
        endurance_limit: null,
        elastic_modulus: 210,
        fatigue_strength_coefficient: 1200,
        fatigue_strength_exponent: -0.09,
        fatigue_ductility_coefficient: 0.42,
        fatigue_ductility_exponent: -0.55,
      },
      maxStress: 320,
      minStress: -80,
      snCurveSourceMode: "points_fit",
      snPoints: [
        { cycles: 1e4, stress: 450 },
        { cycles: 0, stress: 350 },
        { cycles: 1e6, stress: -10 },
        { cycles: 1e6, stress: 260 },
      ],
      surfaceFactorMode: "manual_factor",
      surfaceFinish: "machined",
      manualSurfaceFactor: 0.87,
      marinFactors: {
        size_factor: 0.93,
        load_factor: 0.85,
        temperature_factor: 0.98,
        reliability_factor: 0.9,
      },
      selectedModel: "gerber",
      useNotch: true,
      notch: {
        model: "kuhn_hardrath",
        kt: 2.2,
        notch_radius_mm: 0.7,
        notch_constant_mm: 0.18,
      },
      loadingBlocks: [
        { max_stress: 320, min_stress: -80, cycles: 50000, repeats: 3 },
      ],
    });

    expect(request).toStrictEqual({
      material: {
        uts: 820,
        yield_strength: 690,
        endurance_limit: undefined,
        elastic_modulus: 210,
        fatigue_strength_coefficient: 1200,
        fatigue_strength_exponent: -0.09,
        fatigue_ductility_coefficient: 0.42,
        fatigue_ductility_exponent: -0.55,
      },
      max_stress: 320,
      min_stress: -80,
      sn_curve_source: {
        mode: "points_fit",
        points: [
          { cycles: 1e4, stress: 450 },
          { cycles: 1e6, stress: 260 },
        ],
      },
      surface_factor_selection: {
        mode: "manual_factor",
        surface_factor: 0.87,
      },
      marin_factors: {
        size_factor: 0.93,
        load_factor: 0.85,
        temperature_factor: 0.98,
        reliability_factor: 0.9,
      },
      selected_mean_stress_model: "gerber",
      notch: {
        model: "kuhn_hardrath",
        kt: 2.2,
        notch_radius_mm: 0.7,
        notch_constant_mm: 0.18,
      },
      loading_blocks: [
        { max_stress: 320, min_stress: -80, cycles: 50000, repeats: 3 },
      ],
    });
  });
});
