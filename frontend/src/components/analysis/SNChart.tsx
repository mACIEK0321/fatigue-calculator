"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { SNDataPoint } from "@/types/fatigue";

interface SNChartProps {
  data: SNDataPoint[];
}

function formatScientific(value: number): string {
  if (value === 0) return "0";
  const exp = Math.floor(Math.log10(Math.abs(value)));
  const mantissa = value / Math.pow(10, exp);
  if (exp === 0) return value.toFixed(1);
  return `${mantissa.toFixed(1)}e${exp}`;
}

export default function SNChart({ data }: SNChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">S-N Curve (Stress-Life)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center text-slate-500">
            Run an analysis to see the S-N curve
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">S-N Curve (Stress-Life)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="cycles"
              type="number"
              scale="log"
              domain={[1, 1e9]}
              tickFormatter={(v: number) => formatScientific(v)}
              stroke="#94a3b8"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              label={{
                value: "Cycles to Failure (N)",
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
              tickFormatter={(v: number) => v.toFixed(0)}
              stroke="#94a3b8"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              label={{
                value: "Stress Amplitude (MPa)",
                angle: -90,
                position: "insideLeft",
                offset: -5,
                fill: "#cbd5e1",
                fontSize: 12,
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "1px solid #475569",
                borderRadius: "8px",
                color: "#f1f5f9",
              }}
              formatter={(value, name) => {
                const v = Number(value);
                if (name === "stress") return [`${v.toFixed(1)} MPa`, "Stress"];
                return [formatScientific(v), "Cycles"];
              }}
              labelFormatter={(label) => `N = ${formatScientific(Number(label))}`}
            />
            <Line
              type="monotone"
              dataKey="stress"
              stroke="#22d3ee"
              strokeWidth={2}
              dot={{ fill: "#22d3ee", r: 3 }}
              activeDot={{ r: 5, fill: "#06b6d4" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
