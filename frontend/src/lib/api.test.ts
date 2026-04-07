import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeFatigue } from "@/lib/api";
import type { FatigueAnalysisResponse, FatigueAnalysisRequest } from "@/types/fatigue";

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
});
