import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import SNChart from "@/components/analysis/SNChart";
import type { SNChartData, SNCurveSourceResult } from "@/types/fatigue";

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
  it("renders the native S-N series and points-fit context", () => {
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

    const markup = renderToStaticMarkup(
      <SNChart chartData={chartData} curveSource={curveSource} />
    );

    expect(markup).toContain("Active S-N curve");
    expect(markup).toContain("S-N points");
    expect(markup).toContain("Endurance limit Se");
  });

  it("does not render any AI overlay series", () => {
    const chartData: SNChartData = {
      curve: [
        { cycles: 1e4, stress: 420 },
        { cycles: 1e6, stress: 245 },
      ],
      endurance_limit: 240,
      selected_point: null,
    };
    const curveSource: SNCurveSourceResult = {
      mode: "material_basquin",
      basquin_parameters: {
        sigma_f_prime: 1337.5,
        b: -0.117,
        source: "material_defaults",
      },
      basquin_fit: null,
    };

    const markup = renderToStaticMarkup(
      <SNChart chartData={chartData} curveSource={curveSource} />
    );

    expect(markup).toContain("Active S-N curve");
    expect(markup).not.toContain("AI S-N curve");
  });
});
