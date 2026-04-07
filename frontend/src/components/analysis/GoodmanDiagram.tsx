"use client";

import React from "react";
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { HaighDiagramData, MeanStressModel } from "@/types/fatigue";

interface GoodmanDiagramProps {
  diagram: HaighDiagramData | null;
  selectedModel: MeanStressModel | null;
}

function labelForModel(model: string): string {
  return model.charAt(0).toUpperCase() + model.slice(1);
}

export default function GoodmanDiagram({
  diagram,
  selectedModel,
}: GoodmanDiagramProps) {
  if (!diagram) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Haigh Diagram</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center text-slate-500">
            Run an analysis to see the Haigh diagram.
          </div>
        </CardContent>
      </Card>
    );
  }

  const envelopeData = diagram.goodman_envelope.map((point, index) => ({
    mean_stress: point.mean_stress,
    goodman: point.stress_amplitude,
    gerber: diagram.gerber_envelope[index]?.stress_amplitude,
    soderberg: diagram.soderberg_envelope[index]?.stress_amplitude,
    morrow: diagram.morrow_envelope[index]?.stress_amplitude,
  }));

  const operatingPointData = [
    {
      mean_stress: diagram.operating_point.mean_stress,
      stress_amplitude: diagram.operating_point.stress_amplitude,
    },
  ];

  const correctedPointData = diagram.corrected_operating_point
    ? [
        {
          mean_stress: diagram.corrected_operating_point.mean_stress,
          stress_amplitude: diagram.corrected_operating_point.stress_amplitude,
        },
      ]
    : [];

  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle className="text-base">Haigh Diagram</CardTitle>
        <p className="text-sm text-slate-400">
          The raw operating point is plotted together with the corrected point
          used by the selected mean stress model
          {selectedModel ? ` (${labelForModel(selectedModel)})` : ""}.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart
            data={envelopeData}
            margin={{ top: 10, right: 30, left: 20, bottom: 25 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="mean_stress"
              type="number"
              stroke="#94a3b8"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              label={{
                value: "Mean stress (MPa)",
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
              formatter={(value, name) => [
                `${Number(value).toFixed(1)} MPa`,
                String(name),
              ]}
              labelFormatter={(label) =>
                `Mean stress: ${Number(label).toFixed(1)} MPa`
              }
            />
            <Legend wrapperStyle={{ color: "#cbd5e1", fontSize: 12 }} />
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
              data={operatingPointData}
              dataKey="stress_amplitude"
              fill="#ef4444"
              name="Operating point"
            />
            {correctedPointData.length > 0 ? (
              <Scatter
                data={correctedPointData}
                dataKey="stress_amplitude"
                fill="#f59e0b"
                name="Corrected point"
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>

        <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-400">
          {diagram.corrected_operating_point ? (
            <p>
              The corrected point is the fully reversed equivalent point used by
              the selected mean stress correction to compute the primary life
              result.
            </p>
          ) : (
            <p>
              No corrected point is shown because the selected mean stress model
              exceeded its valid stress limit.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
