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
import {
  buildBasquinCurve,
  DISPLAY_SN_CURVE_MAX_CYCLES,
  DISPLAY_SN_CURVE_MIN_CYCLES,
  fitBasquinFromPoints,
  sanitizeSNFitPoints,
} from "@/lib/basquin-fit";
import { mapSNChartPositionToPoint } from "@/lib/sn-chart";
import type { SNFitPoint } from "@/types/fatigue";

interface SNInteractiveInputProps {
  points: SNFitPoint[];
  onPointsChange: (points: SNFitPoint[]) => void;
}

const CHART_MARGINS = { top: 20, right: 24, left: 40, bottom: 28 };
const X_MIN = DISPLAY_SN_CURVE_MIN_CYCLES;
const X_MAX = DISPLAY_SN_CURVE_MAX_CYCLES;

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

function formatLogTick(value: number): string {
  if (value <= 0) return "0";
  const exponent = Math.round(Math.log10(value));
  return `10^${exponent}`;
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
  const sanitizedPoints = useMemo(() => sanitizeSNFitPoints(points), [points]);
  const ignoredPointsCount = points.length - sanitizedPoints.length;
  const fit = useMemo(
    () => fitBasquinFromPoints(sanitizedPoints),
    [sanitizedPoints]
  );

  const fitCurve = useMemo<SNFitPoint[]>(() => {
    if (!fit) {
      return [];
    }

    return buildBasquinCurve(fit.sigma_f_prime, fit.b);
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
            {ignoredPointsCount > 0 ? ` (${ignoredPointsCount} ignored)` : ""}
          </p>
        </div>
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#475569]">
            sigma_f&apos;
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
          <div>
            <p className="text-sm font-semibold text-[#0f172a]">
              Preliminary S-N fit preview
            </p>
            <p className="text-xs text-[#64748b]">
              Uses the same log10-log10 Basquin regression as the backend. Final
              analysis also applies the modified endurance limit and operating
              point selection.
            </p>
          </div>
          <p className="text-sm text-[#475569]">
            {fit
              ? `R^2 = ${fit.r_squared.toFixed(4)} from ${fit.points_used} points`
              : "Awaiting valid points"}
          </p>
        </div>
        {ignoredPointsCount > 0 ? (
          <p className="mb-3 text-xs text-[#b45309]">
            Non-positive points stay visible in the table but are ignored by the
            preview and by the backend request.
          </p>
        ) : null}
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
