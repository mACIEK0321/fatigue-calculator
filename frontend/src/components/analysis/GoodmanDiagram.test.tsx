import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import GoodmanDiagram from "@/components/analysis/GoodmanDiagram";
import type { HaighDiagramData } from "@/types/fatigue";

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
  ComposedChart: mockChartPrimitive("ComposedChart"),
  Legend: mockChartPrimitive("Legend"),
  Line: mockChartPrimitive("Line"),
  ResponsiveContainer: mockChartPrimitive("ResponsiveContainer"),
  Scatter: mockChartPrimitive("Scatter"),
  Tooltip: mockChartPrimitive("Tooltip"),
  XAxis: mockChartPrimitive("XAxis"),
  YAxis: mockChartPrimitive("YAxis"),
}));

describe("GoodmanDiagram", () => {
  it("renders an external legend without using the chart-overlay legend", () => {
    const diagram: HaighDiagramData = {
      goodman_envelope: [
        { mean_stress: 0, stress_amplitude: 240 },
        { mean_stress: 600, stress_amplitude: 0 },
      ],
      gerber_envelope: [
        { mean_stress: 0, stress_amplitude: 240 },
        { mean_stress: 600, stress_amplitude: 0 },
      ],
      soderberg_envelope: [
        { mean_stress: 0, stress_amplitude: 240 },
        { mean_stress: 400, stress_amplitude: 0 },
      ],
      morrow_envelope: [
        { mean_stress: 0, stress_amplitude: 240 },
        { mean_stress: 900, stress_amplitude: 0 },
      ],
      operating_point: {
        mean_stress: 120,
        stress_amplitude: 160,
      },
      corrected_operating_point: {
        mean_stress: 0,
        stress_amplitude: 265,
      },
    };

    const markup = renderToStaticMarkup(
      <GoodmanDiagram diagram={diagram} selectedModel="goodman" />
    );

    expect(markup).toContain("Goodman");
    expect(markup).toContain("Gerber");
    expect(markup).toContain("Soderberg");
    expect(markup).toContain("Morrow");
    expect(markup).toContain("Operating point");
    expect(markup).toContain("Corrected point");
    expect(markup).not.toContain('data-chart-primitive="Legend"');
  });
});
