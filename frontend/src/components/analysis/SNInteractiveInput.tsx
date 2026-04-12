"use client";

import React, { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
  getRelativeCoordinate,
  usePlotArea,
  useXAxisInverseScale,
  useYAxisInverseScale,
} from "recharts";
import type { TooltipProps, TooltipValueType } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mapSNChartPositionToPoint } from "@/lib/sn-chart";
import type { SNFitPoint } from "@/types/fatigue";

interface BasquinFitDraft {
  sigma_f_prime: number;
  b: number;
  a: number;
  rSquared: number;
}

interface SNInteractiveInputProps {
  points: SNFitPoint[];
  onPointsChange: (points: SNFitPoint[]) => void;
}

const CHART_MARGINS = { top: 20, right: 24, left: 40, bottom: 28 };
const X_MIN = 1;
const X_MAX = 1e9;

type TooltipFormatter = NonNullable<
  TooltipProps<TooltipValueType, string | number>["formatter"]
>;

const tooltipFormatter: TooltipFormatter = (value, name) => {
  if (value === undefined) {
    return ["N/A", name ?? "value"];
  }

  const normalized = Array.isArray(value)
    ? value.map((entry) => Number(entry).toFixed(2)).join(", ")
    : Number(value).toFixed(2);

  return [normalized, name ?? "value"];
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatLogTick(value: number): string {
  if (value <= 0) return "0";
  const exponent = Math.round(Math.log10(value));
  return `10^${exponent}`;
}

function fitBasquin(points: SNFitPoint[]): BasquinFitDraft | null {
  if (points.length < 2) return null;

  const x = points.map((point) => Math.log10(point.cycles));
  const y = points.map((point) => Math.log10(point.stress));

  const xMean = x.reduce((sum, value) => sum + value, 0) / x.length;
  const yMean = y.reduce((sum, value) => sum + value, 0) / y.length;

  const numerator = x.reduce((sum, value, index) => {
    return sum + (value - xMean) * (y[index] - yMean);
  }, 0);
  const denominator = x.reduce((sum, value) => sum + (value - xMean) ** 2, 0);

  if (Math.abs(denominator) < 1e-12) return null;

  const b = numerator / denominator;
  if (!Number.isFinite(b) || b >= 0) return null;

  const intercept = yMean - b * xMean;
  const a = 10 ** intercept;
  const sigma_f_prime = a / 2 ** b;

  const yPred = x.map((value) => intercept + b * value);
  const ssRes = y.reduce((sum, value, index) => sum + (value - yPred[index]) ** 2, 0);
  const ssTot = y.reduce((sum, value) => sum + (value - yMean) ** 2, 0);
  const rSquared = ssTot <= 1e-12 ? 1 : 1 - ssRes / ssTot;

  return {
    sigma_f_prime,
    b,
    a,
    rSquared: clamp(rSquared, 0, 1),
  };
}

function FieldHeader({
  label,
  unit,
}: {
  label: string;
  unit: string;
}) {
  return (
    <div className="hidden grid-cols-[1.15fr_1fr_48px] gap-3 rounded-2xl bg-[#f8fafc] px-4 py-3 md:grid">
      <div>
        <Label className="text-[11px] tracking-[0.1em]">{label}</Label>
      </div>
      <div>
        <Label className="text-[11px] tracking-[0.1em]">{unit}</Label>
      </div>
      <div />
    </div>
  );
}

export default function SNInteractiveInput({
  points,
  onPointsChange,
}: SNInteractiveInputProps) {
  const sanitizedPoints = useMemo(
    () => points.filter((point) => point.cycles > 0 && point.stress > 0),
    [points]
  );
  const fit = useMemo(() => fitBasquin(sanitizedPoints), [sanitizedPoints]);

  const fitCurve = useMemo<SNFitPoint[]>(() => {
    if (!fit) return [];

    const curve: SNFitPoint[] = [];
    for (let index = 0; index <= 60; index += 1) {
      const fraction = index / 60;
      const logN =
        Math.log10(X_MIN) +
        fraction * (Math.log10(X_MAX) - Math.log10(X_MIN));
      const cycles = 10 ** logN;
      const stress = fit.a * cycles ** fit.b;
      if (stress > 0 && Number.isFinite(stress)) {
        curve.push({ cycles, stress });
      }
    }

    return curve;
  }, [fit]);

  const yDomain = useMemo<[number, number]>(() => {
    const allStress = [
      ...sanitizedPoints.map((point) => point.stress),
      ...fitCurve.map((point) => point.stress),
    ];
    const minStress = allStress.length ? Math.min(...allStress) : 1;
    const maxStress = allStress.length ? Math.max(...allStress) : 1e3;
    return [Math.max(1, minStress * 0.6), Math.max(10, maxStress * 1.6)];
  }, [fitCurve, sanitizedPoints]);

  const updatePoint = (index: number, field: keyof SNFitPoint, value: string) => {
    const parsed = Number(value);
    onPointsChange(
      points.map((point, pointIndex) =>
        pointIndex === index
          ? { ...point, [field]: Number.isFinite(parsed) ? parsed : 0 }
          : point
      )
    );
  };

  const removePoint = (index: number) => {
    onPointsChange(points.filter((_, pointIndex) => pointIndex !== index));
  };

  const addPoint = () => {
    onPointsChange([...points, { cycles: 1e5, stress: 250 }]);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#0f172a]">S-N points</p>
          <p className="text-sm text-[#475569]">
            Enter at least two points. Click the chart to add new points on the
            log-log grid.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={addPoint}>
          <Plus className="mr-2 h-4 w-4" />
          Add point
        </Button>
      </div>

      <FieldHeader label="Cycles N" unit="Stress amplitude Sa (MPa)" />

      <div className="space-y-3">
        {points.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#cbd5e1] bg-white px-4 py-5 text-sm text-[#475569]">
            Add two or more S-N points to calculate a Basquin fit.
          </div>
        ) : (
          points.map((point, index) => (
            <div
              key={`${point.cycles}-${point.stress}-${index}`}
              className="grid grid-cols-1 gap-3 rounded-2xl border border-[#e2e8f0] bg-white p-3 md:grid-cols-[1.15fr_1fr_48px]"
            >
              <div className="space-y-1.5">
                <Label className="md:hidden">Cycles N</Label>
                <Input
                  type="number"
                  step="any"
                  value={point.cycles}
                  placeholder="e.g. 1e6"
                  onChange={(event) =>
                    updatePoint(index, "cycles", event.target.value)
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="md:hidden">Stress amplitude Sa (MPa)</Label>
                <Input
                  type="number"
                  step="any"
                  value={point.stress}
                  placeholder="e.g. 240"
                  onChange={(event) =>
                    updatePoint(index, "stress", event.target.value)
                  }
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="self-end md:self-center"
                onClick={() => removePoint(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>

      <div className="grid gap-3 rounded-2xl border border-[#dbeafe] bg-[#eff6ff] p-4 sm:grid-cols-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#475569]">
            Valid points
          </p>
          <p className="mt-1 text-lg font-semibold text-[#0f172a]">
            {sanitizedPoints.length}
          </p>
        </div>
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#475569]">
            σf&apos;
          </p>
          <p className="mt-1 text-lg font-semibold text-[#0f172a]">
            {fit ? `${fit.sigma_f_prime.toFixed(1)} MPa` : "Pending"}
          </p>
        </div>
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#475569]">
            b exponent
          </p>
          <p className="mt-1 text-lg font-semibold text-[#0f172a]">
            {fit ? fit.b.toFixed(4) : "Pending"}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[#0f172a]">
            S-N fit preview
          </p>
          <p className="text-sm text-[#475569]">
            {fit ? `R² = ${fit.rSquared.toFixed(4)}` : "Awaiting valid points"}
          </p>
        </div>
        <div className="h-[300px] w-full cursor-crosshair">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart margin={CHART_MARGINS}>
              <ChartClickOverlay
                onAddPoint={(point) => onPointsChange([...points, point])}
              />
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
              <XAxis
                type="number"
                dataKey="cycles"
                scale="log"
                domain={[X_MIN, X_MAX]}
                tickFormatter={formatLogTick}
                stroke="#64748b"
                tick={{ fill: "#64748b", fontSize: 11 }}
                label={{
                  value: "Cycles N",
                  position: "insideBottom",
                  offset: -14,
                  fill: "#475569",
                }}
              />
              <YAxis
                type="number"
                dataKey="stress"
                scale="log"
                domain={yDomain}
                stroke="#64748b"
                tick={{ fill: "#64748b", fontSize: 11 }}
                label={{
                  value: "Stress amplitude Sa (MPa)",
                  angle: -90,
                  position: "insideLeft",
                  fill: "#475569",
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "16px",
                  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.10)",
                }}
                formatter={tooltipFormatter}
              />
              <Scatter
                data={sanitizedPoints}
                dataKey="stress"
                fill="#2563eb"
                name="Input points"
              />
              <Line
                type="monotone"
                data={fitCurve}
                dataKey="stress"
                stroke="#16a34a"
                strokeWidth={2}
                dot={false}
                name="Fitted curve"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function ChartClickOverlay({
  onAddPoint,
}: {
  onAddPoint: (point: SNFitPoint) => void;
}) {
  const plotArea = usePlotArea();
  const xInverseScale = useXAxisInverseScale();
  const yInverseScale = useYAxisInverseScale();

  if (!plotArea || !xInverseScale || !yInverseScale) {
    return null;
  }

  const handleClick = (event: React.MouseEvent<SVGRectElement>) => {
    const { relativeX, relativeY } = getRelativeCoordinate(event);
    const point = mapSNChartPositionToPoint({
      chartX: plotArea.x + relativeX,
      chartY: plotArea.y + relativeY,
      plotArea,
      getCyclesAtPixel: xInverseScale,
      getStressAtPixel: yInverseScale,
      xMin: X_MIN,
      xMax: X_MAX,
    });

    if (!point) {
      return;
    }

    onAddPoint(point);
  };

  return (
    <rect
      x={plotArea.x}
      y={plotArea.y}
      width={plotArea.width}
      height={plotArea.height}
      fill="transparent"
      onClick={handleClick}
    />
  );
}
