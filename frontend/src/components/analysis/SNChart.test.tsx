import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import SNChart from "@/components/analysis/SNChart";
import type { AIComparisonEnvelope, SNChartData, SNCurveSourceResult } from "@/types/fatigue";

function mockChartPrimitive(label: string) {
  return function MockPrimitive(props: {
    children?: React.ReactNode;
    name?: string;
    data?: unknown[];
  }) {
    return (
      <div data-chart-primitive={label} data-series-name={props.name}>
        {props.name ? `${props.name}:${props.data?.length ?? 0}` : null}
        {props.children}
      </div>
    );
  };
}

vi.mock("recharts", () => ({
  CartesianGrid: mockChartPrimitive("CartesianGrid"),
  Legend: mockChartPrimitive("Legend"),
  Line: mockChartPrimitive("Line"),
  LineChart: mockChartPrimitive("LineChart"),
  ReferenceLine: mockChartPrimitive("ReferenceLine"),
  ResponsiveContainer: mockChartPrimitive("ResponsiveContainer"),
  Scatter: mockChartPrimitive("Scatter"),
  Tooltip: mockChartPrimitive("Tooltip"),
  XAxis: mockChartPrimitive("XAxis"),
  YAxis: mockChartPrimitive("YAxis"),
}));

describe("SNChart", () => {
  it("renders both native and AI series when AI points are available", () => {
    const chartData: SNChartData = {
      curve: [
        { cycles: 1e4, stress: 420 },
        { cycles: 1e6, stress: 245 },
      ],
      endurance_limit: 240,
      selected_point: null,
    };
    const curveSource: SNCurveSourceResult = {
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
    };
    const aiComparison: AIComparisonEnvelope = {
      provider: "groq",
      enabled: true,
      status: "success",
      result: {
        summary: "AI summary",
        assumptions: [],
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
        goodman_or_haigh_points: [],
        warnings: [],
        raw_model_name: "openai/gpt-oss-20b",
      },
      error: null,
    };

    const markup = renderToStaticMarkup(
      <SNChart
        chartData={chartData}
        curveSource={curveSource}
        aiComparison={aiComparison}
      />
    );

    expect(markup).toContain("Active S-N curve");
    expect(markup).toContain("AI S-N curve:2");
  });
});
