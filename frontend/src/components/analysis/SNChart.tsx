"use client";

import React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SNCurveSourceResult, SNChartData } from "@/types/fatigue";

interface SNChartProps {
  chartData: SNChartData | null;
  curveSource: SNCurveSourceResult | null;
}

function formatLogTick(value: number): string {
  if (value <= 0) return "0";
  const exponent = Math.round(Math.log10(value));
  return `10^${exponent}`;
}

function LineLegendSwatch({
  color,
  dashed = false,
}: {
  color: string;
  dashed?: boolean;
}) {
  return (
    <span className="inline-flex h-2 w-7 items-center">
      <span
        className="block w-full border-t-2"
        style={{
          borderColor: color,
          borderStyle: dashed ? "dashed" : "solid",
        }}
      />
    </span>
  );
}

function PointLegendSwatch({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-3 w-3 rounded-full border border-white shadow-sm"
      style={{ backgroundColor: color }}
    />
  );
}

export default function SNChart({ chartData, curveSource }: SNChartProps) {
  if (!chartData || chartData.curve.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>S-N curve</CardTitle>
          <p className="text-sm leading-6 text-[#475569]">
            The active curve and operating point will appear after a successful
            analysis run.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex h-[360px] items-center justify-center rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-6 text-center text-sm text-[#475569]">
            No curve data available yet.
          </div>
        </CardContent>
      </Card>
    );
  }

  const selectedPoint = chartData.selected_point
    ? [
        {
          cycles: chartData.selected_point.display_cycles,
          stress: chartData.selected_point.stress,
          label: chartData.selected_point.label,
          status: chartData.selected_point.status,
        },
      ]
    : [];
  const basquinCurve = chartData.basquin_curve ?? [];
  const showBasquinCurve =
    basquinCurve.length > 0 &&
    basquinCurve.some((point, index) => {
      const activePoint = chartData.curve[index];
      return !activePoint || Math.abs(point.stress - activePoint.stress) > 1e-6;
    });
  const yValues = [
    ...chartData.curve.map((point) => point.stress),
    ...(showBasquinCurve ? basquinCurve.map((point) => point.stress) : []),
    chartData.endurance_limit,
    ...selectedPoint.map((point) => point.stress),
  ];
  const minStress = Math.min(...yValues);
  const maxStress = Math.max(...yValues);
  const yDomain: [number, number] = [
    Math.max(1, minStress * 0.78),
    Math.max(10, maxStress * 1.18),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>S-N curve</CardTitle>
        <p className="text-sm leading-6 text-[#475569]">
          {curveSource?.mode === "points_fit" && showBasquinCurve
            ? "Solid line shows the backend-active S-N response. Dashed line shows the underlying Basquin fit from the same points before the endurance-limit tail is applied."
            : curveSource?.mode === "points_fit"
              ? "Chart uses the backend-returned S-N curve fitted from points."
            : showBasquinCurve
              ? "Solid line shows the backend-active S-N response. Dashed line shows the underlying Basquin relation before the endurance-limit tail is applied."
              : "Chart uses the backend-returned curve generated from Basquin parameters."}
          {curveSource?.basquin_fit
            ? ` Backend fit R^2 = ${curveSource.basquin_fit.r_squared.toFixed(4)} from ${curveSource.basquin_fit.points_used} points.`
            : ""}
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-4 sm:grid-cols-3">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#475569]">
              Source
            </p>
            <p className="mt-1 font-semibold text-[#0f172a]">
              {curveSource?.mode === "points_fit" ? "S-N points" : "Basquin"}
            </p>
          </div>
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#475569]">
              Endurance limit Se
            </p>
            <p className="mt-1 font-semibold text-[#0f172a]">
              {chartData.endurance_limit.toFixed(1)} MPa
            </p>
          </div>
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#475569]">
              Selected point
            </p>
            <p className="mt-1 font-semibold text-[#0f172a]">
              {chartData.selected_point
                ? chartData.selected_point.status === "infinite"
                  ? "Infinite life"
                  : chartData.selected_point.label
                : "Not available"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-xs font-medium text-[#475569]">
          <span className="inline-flex items-center gap-2">
            <LineLegendSwatch color="#2563eb" />
            Active S-N curve
          </span>
          {showBasquinCurve ? (
            <span className="inline-flex items-center gap-2">
              <LineLegendSwatch color="#475569" dashed />
              Basquin fit
            </span>
          ) : null}
          <span className="inline-flex items-center gap-2">
            <LineLegendSwatch color="#ea580c" dashed />
            Endurance limit
          </span>
          {selectedPoint.length > 0 ? (
            <span className="inline-flex items-center gap-2">
              <PointLegendSwatch
                color={selectedPoint[0].status === "infinite" ? "#16a34a" : "#dc2626"}
              />
              Selected point
            </span>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white p-4">
          <ResponsiveContainer width="100%" height={360}>
            <LineChart
              data={chartData.curve}
              margin={{ top: 12, right: 24, left: 20, bottom: 40 }}
            >
              <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
              <XAxis
                dataKey="cycles"
                type="number"
                scale="log"
                domain={[1, 1e9]}
                tickFormatter={formatLogTick}
                stroke="#64748b"
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickMargin={10}
                label={{
                  value: "Cycles N",
                  position: "insideBottom",
                  offset: -20,
                  fill: "#475569",
                  fontSize: 12,
                }}
              />
              <YAxis
                dataKey="stress"
                type="number"
                scale="log"
                domain={yDomain}
                tickFormatter={(value: number) => value.toFixed(0)}
                stroke="#64748b"
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickMargin={8}
                width={72}
                label={{
                  value: "Stress amplitude Sa (MPa)",
                  angle: -90,
                  position: "insideLeft",
                  offset: -6,
                  fill: "#475569",
                  fontSize: 12,
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "16px",
                  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.10)",
                }}
                formatter={(value, name, item) => {
                  const numericValue = Number(value);
                  if (item?.payload?.label) {
                    return [`${numericValue.toFixed(1)} MPa`, item.payload.label];
                  }
                  return [`${numericValue.toFixed(1)} MPa`, String(name)];
                }}
                labelFormatter={(label) => `N = ${formatLogTick(Number(label))}`}
              />
              <ReferenceLine
                y={chartData.endurance_limit}
                stroke="#ea580c"
                strokeDasharray="4 4"
              />
              {showBasquinCurve ? (
                <Line
                  data={basquinCurve}
                  type="linear"
                  dataKey="stress"
                  stroke="#475569"
                  strokeDasharray="6 4"
                  strokeWidth={2}
                  dot={false}
                  name="Basquin fit"
                />
              ) : null}
              <Line
                type="linear"
                dataKey="stress"
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={false}
                name="Active S-N curve"
              />
              {selectedPoint.length > 0 ? (
                <Scatter
                  data={selectedPoint}
                  dataKey="stress"
                  fill={
                    selectedPoint[0].status === "infinite" ? "#16a34a" : "#dc2626"
                  }
                  name="Selected point"
                />
              ) : null}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
