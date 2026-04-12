import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ResultsPanel from "@/components/analysis/ResultsPanel";
import type { AIComparisonEnvelope, FatigueAnalysisResponse } from "@/types/fatigue";

describe("ResultsPanel", () => {
  it("renders the current infinite-life semantic from selected_life", () => {
    const results: FatigueAnalysisResponse = {
      stress_state: {
        input_max_stress: 180,
        input_min_stress: 20,
        corrected_max_stress: 180,
        corrected_min_stress: 20,
        stress_amplitude: 80,
        mean_stress: 100,
        stress_ratio: 0.1111111111,
      },
      modified_endurance_limit: 220,
      sn_curve_source: {
        mode: "material_basquin",
        basquin_parameters: {
          sigma_f_prime: 910,
          b: -0.09,
          source: "material_defaults",
        },
        basquin_fit: null,
      },
      cycles_to_failure: {
        goodman: {
          status: "finite",
          cycles: 1250000,
          reason: "legacy comparison payload",
        },
        gerber: {
          status: "finite",
          cycles: 1300000,
          reason: "legacy comparison payload",
        },
        soderberg: {
          status: "finite",
          cycles: 1000000,
          reason: "legacy comparison payload",
        },
        morrow: {
          status: "finite",
          cycles: 1200000,
          reason: "legacy comparison payload",
        },
      },
      mean_stress_corrections: [
        {
          model_name: "goodman",
          effective_mean_stress: 100,
          safety_factor: 1.35,
          equivalent_alternating_stress: 160,
          is_safe: true,
          life: {
            status: "infinite",
            cycles: null,
            reason: "Below endurance limit after correction.",
          },
        },
      ],
      selected_mean_stress_model: "goodman",
      selected_mean_stress_result: {
        model_name: "goodman",
        effective_mean_stress: 100,
        safety_factor: 1.35,
        equivalent_alternating_stress: 160,
        is_safe: true,
        life: {
          status: "infinite",
          cycles: null,
          reason: "Below endurance limit after correction.",
        },
      },
      selected_life: {
        status: "infinite",
        cycles: null,
        reason: "Below endurance limit after correction.",
      },
      sn_chart: {
        curve: [],
        endurance_limit: 220,
        selected_point: {
          cycles: null,
          display_cycles: 1e7,
          stress: 160,
          status: "infinite",
          label: "Selected point",
        },
      },
      haigh_diagram: {
        goodman_envelope: [],
        gerber_envelope: [],
        soderberg_envelope: [],
        morrow_envelope: [],
        operating_point: { mean_stress: 100, stress_amplitude: 80 },
        corrected_operating_point: {
          mean_stress: 100,
          stress_amplitude: 160,
        },
      },
      notch_result: null,
      miner_damage: null,
    };

    const markup = renderToStaticMarkup(
      <ResultsPanel
        results={results}
        aiComparison={null}
        isLoading={false}
        showAIComparison={false}
      />
    );

    expect(markup).toContain("Infinite life");
    expect(markup).toContain("Safety factor");
    expect(markup).toContain("Sa");
    expect(markup).toContain("Sm");
    expect(markup).toContain("Se");
    expect(markup).toContain("goodman");
  });

  it("shows backend fit details for points_fit results", () => {
    const results: FatigueAnalysisResponse = {
      stress_state: {
        input_max_stress: 280,
        input_min_stress: -40,
        corrected_max_stress: 280,
        corrected_min_stress: -40,
        stress_amplitude: 160,
        mean_stress: 120,
        stress_ratio: -0.1428571429,
      },
      modified_endurance_limit: 240,
      sn_curve_source: {
        mode: "points_fit",
        basquin_parameters: {
          sigma_f_prime: 1337.5,
          b: -0.117,
          source: "points_fit",
        },
        basquin_fit: {
          a: 1233.28,
          b: -0.117,
          sigma_f_prime: 1337.5,
          r_squared: 0.99997,
          points_used: 3,
        },
      },
      cycles_to_failure: {
        goodman: {
          status: "finite",
          cycles: 750000,
          reason: "finite",
        },
        gerber: {
          status: "finite",
          cycles: 800000,
          reason: "finite",
        },
        soderberg: {
          status: "finite",
          cycles: 650000,
          reason: "finite",
        },
        morrow: {
          status: "finite",
          cycles: 700000,
          reason: "finite",
        },
      },
      mean_stress_corrections: [
        {
          model_name: "goodman",
          effective_mean_stress: 120,
          safety_factor: 0.92,
          equivalent_alternating_stress: 265,
          is_safe: false,
          life: {
            status: "finite",
            cycles: 750000,
            reason: "finite",
          },
        },
      ],
      selected_mean_stress_model: "goodman",
      selected_mean_stress_result: {
        model_name: "goodman",
        effective_mean_stress: 120,
        safety_factor: 0.92,
        equivalent_alternating_stress: 265,
        is_safe: false,
        life: {
          status: "finite",
          cycles: 750000,
          reason: "finite",
        },
      },
      selected_life: {
        status: "finite",
        cycles: 750000,
        reason: "finite",
      },
      sn_chart: {
        curve: [{ cycles: 1, stress: 1337.5 }],
        endurance_limit: 240,
        selected_point: {
          cycles: 750000,
          display_cycles: 750000,
          stress: 265,
          status: "finite",
          label: "750000 cycles",
        },
      },
      haigh_diagram: {
        goodman_envelope: [],
        gerber_envelope: [],
        soderberg_envelope: [],
        morrow_envelope: [],
        operating_point: { mean_stress: 120, stress_amplitude: 160 },
        corrected_operating_point: {
          mean_stress: 0,
          stress_amplitude: 265,
        },
      },
      notch_result: null,
      miner_damage: null,
    };

    const aiComparison: AIComparisonEnvelope = {
      provider: "deepseek",
      enabled: true,
      status: "success",
      result: {
        summary: "DeepSeek summary",
        assumptions: ["Assume nominal room temperature."],
        interpreted_inputs: {
          material_label: null,
          sn_curve_source: "points_fit",
          surface_factor: 0.9,
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
          sigma_f_prime: 1340,
          b: -0.118,
          source: "points_fit",
        },
        modified_endurance_limit: 242,
        stress_state: {
          max_stress: 280,
          min_stress: -40,
          mean_stress: 120,
          stress_amplitude: 160,
          stress_ratio: -0.1428571429,
        },
        mean_stress_result: {
          model_name: "goodman",
          effective_mean_stress: 120,
          equivalent_alternating_stress: 266,
          is_safe: false,
        },
        life: {
          status: "finite",
          cycles: 700000,
          reason: "finite",
        },
        safety_factor: 0.91,
        sn_curve_points: [
          [1e4, 430],
          [1e6, 250],
        ],
        goodman_or_haigh_points: [
          [0, 242],
          [572, 0],
        ],
        warnings: ["Comparison warning"],
        raw_model_name: "deepseek-chat",
      },
      error: null,
    };

    const markup = renderToStaticMarkup(
      <ResultsPanel
        results={results}
        aiComparison={aiComparison}
        isLoading={false}
        showAIComparison={true}
      />
    );

    expect(markup).toContain("Backend fit R^2 = 1.0000 from 3 valid points.");
    expect(markup).toContain(
      "Final chart and life result use the backend response, not the local form preview."
    );
    expect(markup).toContain("DeepSeek comparison");
    expect(markup).toContain("DeepSeek: 700.0k cycles");
    expect(markup).toContain("Comparison warning");
  });

  it("shows a graceful AI error without hiding native results", () => {
    const results: FatigueAnalysisResponse = {
      stress_state: {
        input_max_stress: 180,
        input_min_stress: 20,
        corrected_max_stress: 180,
        corrected_min_stress: 20,
        stress_amplitude: 80,
        mean_stress: 100,
        stress_ratio: 0.1111111111,
      },
      modified_endurance_limit: 220,
      sn_curve_source: {
        mode: "material_basquin",
        basquin_parameters: {
          sigma_f_prime: 910,
          b: -0.09,
          source: "material_defaults",
        },
        basquin_fit: null,
      },
      cycles_to_failure: {
        goodman: {
          status: "finite",
          cycles: 1250000,
          reason: "legacy comparison payload",
        },
        gerber: {
          status: "finite",
          cycles: 1300000,
          reason: "legacy comparison payload",
        },
        soderberg: {
          status: "finite",
          cycles: 1000000,
          reason: "legacy comparison payload",
        },
        morrow: {
          status: "finite",
          cycles: 1200000,
          reason: "legacy comparison payload",
        },
      },
      mean_stress_corrections: [
        {
          model_name: "goodman",
          effective_mean_stress: 100,
          safety_factor: 1.35,
          equivalent_alternating_stress: 160,
          is_safe: true,
          life: {
            status: "infinite",
            cycles: null,
            reason: "Below endurance limit after correction.",
          },
        },
      ],
      selected_mean_stress_model: "goodman",
      selected_mean_stress_result: {
        model_name: "goodman",
        effective_mean_stress: 100,
        safety_factor: 1.35,
        equivalent_alternating_stress: 160,
        is_safe: true,
        life: {
          status: "infinite",
          cycles: null,
          reason: "Below endurance limit after correction.",
        },
      },
      selected_life: {
        status: "infinite",
        cycles: null,
        reason: "Below endurance limit after correction.",
      },
      sn_chart: {
        curve: [],
        endurance_limit: 220,
        selected_point: null,
      },
      haigh_diagram: {
        goodman_envelope: [],
        gerber_envelope: [],
        soderberg_envelope: [],
        morrow_envelope: [],
        operating_point: { mean_stress: 100, stress_amplitude: 80 },
        corrected_operating_point: null,
      },
      notch_result: null,
      miner_damage: null,
    };
    const aiComparison: AIComparisonEnvelope = {
      provider: "deepseek",
      enabled: true,
      status: "error",
      result: null,
      error: {
        code: "timeout",
        message: "DeepSeek comparison timed out before a valid response arrived.",
        retriable: true,
      },
    };

    const markup = renderToStaticMarkup(
      <ResultsPanel
        results={results}
        aiComparison={aiComparison}
        isLoading={false}
        showAIComparison={true}
      />
    );

    expect(markup).toContain("Infinite life");
    expect(markup).toContain("DeepSeek comparison unavailable");
    expect(markup).toContain("timed out");
  });

  it("shows comparison loading guidance before results are available", () => {
    const markup = renderToStaticMarkup(
      <ResultsPanel
        results={null}
        aiComparison={null}
        isLoading={true}
        showAIComparison={true}
      />
    );

    expect(markup).toContain("DeepSeek comparison requested.");
  });
});
