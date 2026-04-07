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

export default function SNChart({ chartData, curveSource }: SNChartProps) {
  if (!chartData || chartData.curve.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">S-N Curve</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center text-slate-500">
            Run an analysis to see the S-N curve.
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

  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle className="text-base">S-N Curve</CardTitle>
        {curveSource && (
          <p className="text-sm text-slate-400">
            Active source:{" "}
            <span className="text-slate-200">
              {curveSource.mode === "points_fit" ? "S-N points + fit" : "Material Basquin"}
            </span>
            {curveSource.basquin_fit
              ? `, fit R^2 = ${curveSource.basquin_fit.r_squared.toFixed(4)}`
              : ""}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <ResponsiveContainer width="100%" height={340}>
          <LineChart
            data={chartData.curve}
            margin={{ top: 10, right: 30, left: 20, bottom: 25 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="cycles"
              type="number"
              scale="log"
              domain={[1, 1e9]}
              tickFormatter={formatLogTick}
              stroke="#94a3b8"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              label={{
                value: "Cycles to failure (N)",
                position: "insideBottom",
                offset: -15,
                fill: "#cbd5e1",
                fontSize: 12,
              }}
            />
            <YAxis
              dataKey="stress"
              type="number"
              scale="log"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(value: number) => value.toFixed(0)}
              stroke="#94a3b8"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              label={{
                value: "Stress amplitude (MPa)",
                angle: -90,
                position: "insideLeft",
                offset: -5,
                fill: "#cbd5e1",
                fontSize: 12,
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "8px",
                color: "#f8fafc",
              }}
              formatter={(value, name, item) => {
                const numericValue = Number(value);
                if (name === "stress") {
                  return [`${numericValue.toFixed(1)} MPa`, "Stress amplitude"];
                }
                if (item?.payload?.label) {
                  return [item.payload.label, "Selected life"];
                }
                return [formatLogTick(numericValue), "Cycles"];
              }}
              labelFormatter={(label) => `N = ${formatLogTick(Number(label))}`}
            />
            <ReferenceLine
              y={chartData.endurance_limit}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              label={{
                value: "Endurance limit",
                fill: "#fcd34d",
                position: "insideTopRight",
              }}
            />
            <Line
              type="monotone"
              dataKey="stress"
              stroke="#22d3ee"
              strokeWidth={2}
              dot={false}
              name="Active S-N curve"
            />
            {selectedPoint.length > 0 && (
              <Scatter
                data={selectedPoint}
                dataKey="stress"
                fill={selectedPoint[0].status === "infinite" ? "#f59e0b" : "#ef4444"}
                name={
                  selectedPoint[0].status === "infinite"
                    ? "Selected point (infinite life)"
                    : "Selected point"
                }
              />
            )}
          </LineChart>
        </ResponsiveContainer>

        <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-400">
          {chartData.selected_point ? (
            chartData.selected_point.status === "infinite" ? (
              <p>
                The selected point is plotted on the endurance plateau because the corrected
                alternating stress falls below the modified endurance limit.
              </p>
            ) : (
              <p>
                The selected point uses the mean-stress-corrected alternating stress and the
                resulting finite life from the primary model.
              </p>
            )
          ) : (
            <p>
              No selected point is shown because the chosen mean stress model exceeded its
              valid limit.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
