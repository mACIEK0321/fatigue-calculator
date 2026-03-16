"use client";

import React from "react";
import {
  ComposedChart,
  Line,
  Scatter,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { GoodmanEnvelope } from "@/types/fatigue";

interface GoodmanDiagramProps {
  goodmanEnvelope: GoodmanEnvelope[];
  gerberEnvelope: GoodmanEnvelope[];
  soderbergEnvelope: GoodmanEnvelope[];
  morrowEnvelope: GoodmanEnvelope[];
  operatingPoint: { mean_stress: number; stress_amplitude: number } | null;
}

export default function GoodmanDiagram({
  goodmanEnvelope,
  gerberEnvelope,
  soderbergEnvelope,
  morrowEnvelope,
  operatingPoint,
}: GoodmanDiagramProps) {
  const hasData =
    goodmanEnvelope.length > 0 ||
    gerberEnvelope.length > 0 ||
    soderbergEnvelope.length > 0 ||
    morrowEnvelope.length > 0;

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Modified Goodman Diagram</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center text-slate-500">
            Run an analysis to see the Goodman diagram
          </div>
        </CardContent>
      </Card>
    );
  }

  // Merge all envelopes into a single dataset keyed by mean_stress
  const mergedMap = new Map<number, Record<string, number>>();

  const addToMap = (envelope: GoodmanEnvelope[], key: string) => {
    envelope.forEach((pt) => {
      const ms = Math.round(pt.mean_stress * 100) / 100;
      if (!mergedMap.has(ms)) {
        mergedMap.set(ms, { mean_stress: ms });
      }
      mergedMap.get(ms)![key] = pt.stress_amplitude;
    });
  };

  addToMap(goodmanEnvelope, "goodman");
  addToMap(gerberEnvelope, "gerber");
  addToMap(soderbergEnvelope, "soderberg");
  addToMap(morrowEnvelope, "morrow");

  const chartData = Array.from(mergedMap.values()).sort(
    (a, b) => a.mean_stress - b.mean_stress
  );

  // Operating point as scatter data
  const scatterData = operatingPoint
    ? [
        {
          mean_stress: operatingPoint.mean_stress,
          operating: operatingPoint.stress_amplitude,
        },
      ]
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Modified Goodman Diagram</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 25 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="mean_stress"
              type="number"
              stroke="#94a3b8"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              label={{
                value: "Mean Stress (MPa)",
                position: "insideBottom",
                offset: -15,
                fill: "#cbd5e1",
                fontSize: 12,
              }}
            />
            <YAxis
              type="number"
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
              formatter={(value, name) => [
                `${Number(value).toFixed(1)} MPa`,
                String(name).charAt(0).toUpperCase() + String(name).slice(1),
              ]}
              labelFormatter={(label) =>
                `Mean Stress: ${Number(label).toFixed(1)} MPa`
              }
            />
            <Legend
              wrapperStyle={{ color: "#cbd5e1", fontSize: 12, paddingTop: 8 }}
            />
            <Area
              type="monotone"
              dataKey="goodman"
              stroke="none"
              fill="#3b82f6"
              fillOpacity={0.1}
              name="Safe Zone"
              legendType="none"
            />
            <Line
              type="monotone"
              dataKey="goodman"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              name="Goodman"
            />
            <Line
              type="monotone"
              dataKey="gerber"
              stroke="#22c55e"
              strokeWidth={2}
              dot={false}
              name="Gerber"
            />
            <Line
              type="monotone"
              dataKey="soderberg"
              stroke="#f97316"
              strokeWidth={2}
              dot={false}
              name="Soderberg"
            />
            <Line
              type="monotone"
              dataKey="morrow"
              stroke="#a855f7"
              strokeWidth={2}
              dot={false}
              name="Morrow"
            />
            <Scatter
              data={scatterData}
              dataKey="operating"
              fill="#ef4444"
              name="Operating Point"
              shape="circle"
              legendType="circle"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
