import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeFatigue, analyzeFatigueComparison } from "@/lib/api";
import type {
  FatigueAnalysisCompareRequest,
  FatigueAnalysisCompareResponse,
  FatigueAnalysisResponse,
  FatigueAnalysisRequest,
} from "@/types/fatigue";

describe("analyzeFatigue", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    vi.unstubAllGlobals();
  });

  it("posts the fatigue request to the normalized analyze endpoint", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com/api/";

    const request: FatigueAnalysisRequest = {
      material: {
        uts: 400,
        yield_strength: 250,
        endurance_limit: 200,
        elastic_modulus: 210,
      },
      max_stress: 300,
      min_stress: -100,
      sn_curve_source: { mode: "material_basquin" },
      surface_factor_selection: {
        mode: "empirical_surface_finish",
        finish_type: "machined",
      },
      marin_factors: {
        size_factor: 1,
        load_factor: 1,
        temperature_factor: 1,
        reliability_factor: 1,
      },
      selected_mean_stress_model: "goodman",
    };

    const response: FatigueAnalysisResponse = {
      stress_state: {
        input_max_stress: 300,
        input_min_stress: -100,
        corrected_max_stress: 300,
        corrected_min_stress: -100,
        stress_amplitude: 200,
        mean_stress: 100,
        stress_ratio: -0.3333333333,
      },
      modified_endurance_limit: 180,
      sn_curve_source: {
        mode: "material_basquin",
        basquin_parameters: {
          sigma_f_prime: 900,
          b: -0.1,
          source: "material_defaults",
        },
        basquin_fit: null,
      },
      cycles_to_failure: {
        goodman: { status: "finite", cycles: 100000, reason: "finite" },
        gerber: { status: "finite", cycles: 110000, reason: "finite" },
        soderberg: { status: "finite", cycles: 90000, reason: "finite" },
        morrow: { status: "finite", cycles: 105000, reason: "finite" },
      },
      mean_stress_corrections: [
        {
          model_name: "goodman",
          effective_mean_stress: 100,
          safety_factor: 1.1,
          equivalent_alternating_stress: 180,
          is_safe: true,
          life: { status: "finite", cycles: 100000, reason: "finite" },
        },
      ],
      selected_mean_stress_model: "goodman",
      selected_mean_stress_result: {
        model_name: "goodman",
        effective_mean_stress: 100,
        safety_factor: 1.1,
        equivalent_alternating_stress: 180,
        is_safe: true,
        life: { status: "finite", cycles: 100000, reason: "finite" },
      },
      selected_life: { status: "finite", cycles: 100000, reason: "finite" },
      sn_chart: {
        curve: [],
        endurance_limit: 180,
        selected_point: null,
      },
      haigh_diagram: {
        goodman_envelope: [],
        gerber_envelope: [],
        soderberg_envelope: [],
        morrow_envelope: [],
        operating_point: { mean_stress: 100, stress_amplitude: 200 },
        corrected_operating_point: null,
      },
      notch_result: null,
      miner_damage: null,
    };

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await analyzeFatigue(request);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/analyze",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(request),
        headers: {
          "Content-Type": "application/json",
        },
      })
    );
  });

  it("posts the compare request to the compare endpoint", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com/api/";

    const request: FatigueAnalysisCompareRequest = {
      material: {
        uts: 400,
        yield_strength: 250,
        endurance_limit: 200,
        elastic_modulus: 210,
      },
      max_stress: 300,
      min_stress: -100,
      sn_curve_source: { mode: "material_basquin" },
      surface_factor_selection: {
        mode: "empirical_surface_finish",
        finish_type: "machined",
      },
      marin_factors: {
        size_factor: 1,
        load_factor: 1,
        temperature_factor: 1,
        reliability_factor: 1,
      },
      selected_mean_stress_model: "goodman",
      ai_comparison: {
        enabled: true,
        include_interpreted_inputs: true,
        include_sn_curve_points: true,
        include_goodman_or_haigh_points: true,
        max_points_per_series: 25,
      },
    };

    const response: FatigueAnalysisCompareResponse = {
      native_analysis: {
        stress_state: {
          input_max_stress: 300,
          input_min_stress: -100,
          corrected_max_stress: 300,
          corrected_min_stress: -100,
          stress_amplitude: 200,
          mean_stress: 100,
          stress_ratio: -0.3333333333,
        },
        modified_endurance_limit: 180,
        sn_curve_source: {
          mode: "material_basquin",
          basquin_parameters: {
            sigma_f_prime: 900,
            b: -0.1,
            source: "material_defaults",
          },
          basquin_fit: null,
        },
        cycles_to_failure: {
          goodman: { status: "finite", cycles: 100000, reason: "finite" },
          gerber: { status: "finite", cycles: 110000, reason: "finite" },
          soderberg: { status: "finite", cycles: 90000, reason: "finite" },
          morrow: { status: "finite", cycles: 105000, reason: "finite" },
        },
        mean_stress_corrections: [
          {
            model_name: "goodman",
            effective_mean_stress: 100,
            safety_factor: 1.1,
            equivalent_alternating_stress: 180,
            is_safe: true,
            life: { status: "finite", cycles: 100000, reason: "finite" },
          },
        ],
        selected_mean_stress_model: "goodman",
        selected_mean_stress_result: {
          model_name: "goodman",
          effective_mean_stress: 100,
          safety_factor: 1.1,
          equivalent_alternating_stress: 180,
          is_safe: true,
          life: { status: "finite", cycles: 100000, reason: "finite" },
        },
        selected_life: { status: "finite", cycles: 100000, reason: "finite" },
        sn_chart: {
          curve: [],
          endurance_limit: 180,
          selected_point: null,
        },
        haigh_diagram: {
          goodman_envelope: [],
          gerber_envelope: [],
          soderberg_envelope: [],
          morrow_envelope: [],
          operating_point: { mean_stress: 100, stress_amplitude: 200 },
          corrected_operating_point: null,
        },
        notch_result: null,
        miner_damage: null,
      },
      ai_comparison: {
        provider: "groq",
        enabled: true,
        status: "success",
        result: {
          summary: "AI summary",
          assumptions: [],
          interpreted_inputs: {
            material_label: null,
            sn_curve_source: "material_basquin",
            surface_factor: 0.82,
            marin_factors: {
              size_factor: 1,
              load_factor: 1,
              temperature_factor: 1,
              reliability_factor: 1,
            },
            notch_correction_factor: null,
            loading_blocks_count: 0,
          },
          basquin_parameters: {
            sigma_f_prime: 905,
            b: -0.1,
            source: "material_defaults",
          },
          modified_endurance_limit: 181,
          stress_state: {
            max_stress: 300,
            min_stress: -100,
            mean_stress: 100,
            stress_amplitude: 200,
            stress_ratio: -0.3333333333,
          },
          mean_stress_result: {
            model_name: "goodman",
            effective_mean_stress: 100,
            equivalent_alternating_stress: 181,
            is_safe: true,
          },
          life: { status: "finite", cycles: 100500, reason: "finite" },
          safety_factor: 1.11,
          sn_curve_points: [
            { x: 10000, y: 400 },
            { x: 1000000, y: 250 },
          ],
          goodman_or_haigh_points: [
            { x: 0, y: 181 },
            { x: 400, y: 0 },
          ],
          warnings: [],
          raw_model_name: "openai/gpt-oss-20b",
        },
        error: null,
      },
    };

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await analyzeFatigueComparison(request);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/analyze/compare",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(request),
      })
    );
  });
});
