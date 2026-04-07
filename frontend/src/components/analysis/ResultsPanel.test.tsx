import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ResultsPanel from "@/components/analysis/ResultsPanel";
import type { FatigueAnalysisResponse } from "@/types/fatigue";

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

    const markup = renderToStaticMarkup(<ResultsPanel results={results} />);

    expect(markup).toContain("Infinite life");
    expect(markup).not.toContain("1.25M cycles");
  });
});
