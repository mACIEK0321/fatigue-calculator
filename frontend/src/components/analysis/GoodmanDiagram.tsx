"use client";

import React from "react";
import {
  CartesianGrid,
  ComposedChart,
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

function PointLegendSwatch({
  color,
  square = false,
}: {
  color: string;
  square?: boolean;
}) {
  return (
    <span
      className={square ? "inline-block h-3 w-3 rounded-[3px]" : "inline-block h-3 w-3 rounded-full"}
      style={{ backgroundColor: color }}
    />
  );
}

function OperatingPointMarker({
  cx = 0,
  cy = 0,
  fill = "#dc2626",
}: {
  cx?: number;
  cy?: number;
  fill?: string;
}) {
  return <circle cx={cx} cy={cy} r={6} fill={fill} stroke="#ffffff" strokeWidth={2} />;
}

function CorrectedPointMarker({
  cx = 0,
  cy = 0,
  fill = "#2563eb",
}: {
  cx?: number;
  cy?: number;
  fill?: string;
}) {
  return (
    <rect
      x={cx - 6}
      y={cy - 6}
      width={12}
      height={12}
      rx={2}
      fill={fill}
      stroke="#ffffff"
      strokeWidth={2}
    />
  );
}

export default function GoodmanDiagram({
  diagram,
  selectedModel,
}: GoodmanDiagramProps) {
  if (!diagram) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Haigh diagram</CardTitle>
          <p className="text-sm leading-6 text-[#475569]">
            Mean stress envelopes and the operating point will appear after a
            successful analysis run.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex h-[360px] items-center justify-center rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-6 text-center text-sm text-[#475569]">
            No Haigh diagram data available yet.
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
  const xValues = [
    ...diagram.goodman_envelope.map((point) => point.mean_stress),
    ...diagram.gerber_envelope.map((point) => point.mean_stress),
    ...diagram.soderberg_envelope.map((point) => point.mean_stress),
    ...diagram.morrow_envelope.map((point) => point.mean_stress),
    diagram.operating_point.mean_stress,
    ...(diagram.corrected_operating_point
      ? [diagram.corrected_operating_point.mean_stress]
      : []),
    0,
  ];
  const yValues = [
    ...diagram.goodman_envelope.map((point) => point.stress_amplitude),
    ...diagram.gerber_envelope.map((point) => point.stress_amplitude),
    ...diagram.soderberg_envelope.map((point) => point.stress_amplitude),
    ...diagram.morrow_envelope.map((point) => point.stress_amplitude),
    diagram.operating_point.stress_amplitude,
    ...(diagram.corrected_operating_point
      ? [diagram.corrected_operating_point.stress_amplitude]
      : []),
    0,
  ];
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const xPadding =
    Math.max(xMax - xMin, Math.abs(xMin), Math.abs(xMax), 1) * 0.08;
  const xDomain: [number, number] = [xMin - xPadding, xMax + xPadding];
  const yDomain: [number, number] = [0, Math.max(10, Math.max(...yValues) * 1.15)];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Haigh diagram</CardTitle>
        <p className="text-sm leading-6 text-[#475569]">
          Operating point and corrected point for the selected model
          {selectedModel ? ` (${labelForModel(selectedModel)})` : ""}.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-4 sm:grid-cols-3">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#475569]">
              Operating Sa
            </p>
            <p className="mt-1 font-semibold text-[#0f172a]">
              {diagram.operating_point.stress_amplitude.toFixed(1)} MPa
            </p>
          </div>
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#475569]">
              Operating Sm
            </p>
            <p className="mt-1 font-semibold text-[#0f172a]">
              {diagram.operating_point.mean_stress.toFixed(1)} MPa
            </p>
          </div>
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#475569]">
              Corrected point
            </p>
            <p className="mt-1 font-semibold text-[#0f172a]">
              {diagram.corrected_operating_point ? "Available" : "Not available"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-xs font-medium text-[#475569]">
          <span className="inline-flex items-center gap-2">
            <LineLegendSwatch color="#2563eb" />
            Goodman
          </span>
          <span className="inline-flex items-center gap-2">
            <LineLegendSwatch color="#16a34a" />
            Gerber
          </span>
          <span className="inline-flex items-center gap-2">
            <LineLegendSwatch color="#ea580c" />
            Soderberg
          </span>
          <span className="inline-flex items-center gap-2">
            <LineLegendSwatch color="#475569" dashed />
            Morrow
          </span>
          <span className="inline-flex items-center gap-2">
            <PointLegendSwatch color="#dc2626" />
            Operating point
          </span>
          {correctedPointData.length > 0 ? (
            <span className="inline-flex items-center gap-2">
              <PointLegendSwatch color="#2563eb" square />
              Corrected point
            </span>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white p-4">
          <ResponsiveContainer width="100%" height={380}>
            <ComposedChart
              data={envelopeData}
              margin={{ top: 12, right: 24, left: 20, bottom: 44 }}
            >
              <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
              <XAxis
                dataKey="mean_stress"
                type="number"
                domain={xDomain}
                stroke="#64748b"
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickMargin={10}
                label={{
                  value: "Mean stress Sm (MPa)",
                  position: "insideBottom",
                  offset: -20,
                  fill: "#475569",
                  fontSize: 12,
                }}
              />
              <YAxis
                type="number"
                domain={yDomain}
                stroke="#64748b"
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickMargin={8}
                width={74}
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
                formatter={(value, name) => [
                  `${Number(value).toFixed(1)} MPa`,
                  String(name),
                ]}
                labelFormatter={(label) =>
                  `Mean stress: ${Number(label).toFixed(1)} MPa`
                }
              />
              <Line
                type="linear"
                dataKey="goodman"
                stroke="#2563eb"
                strokeWidth={2}
                dot={false}
                name="Goodman"
              />
              <Line
                type="linear"
                dataKey="gerber"
                stroke="#16a34a"
                strokeWidth={2}
                dot={false}
                name="Gerber"
              />
              <Line
                type="linear"
                dataKey="soderberg"
                stroke="#ea580c"
                strokeWidth={2}
                dot={false}
                name="Soderberg"
              />
              <Line
                type="linear"
                dataKey="morrow"
                stroke="#475569"
                strokeDasharray="6 4"
                strokeWidth={2}
                dot={false}
                name="Morrow"
              />
              <Scatter
                data={operatingPointData}
                dataKey="stress_amplitude"
                fill="#dc2626"
                shape={OperatingPointMarker}
                name="Operating point"
              />
              {correctedPointData.length > 0 ? (
                <Scatter
                  data={correctedPointData}
                  dataKey="stress_amplitude"
                  fill="#2563eb"
                  shape={CorrectedPointMarker}
                  name="Corrected point"
                />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
