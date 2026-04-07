"use client";

import React, { useMemo, useRef, useState } from "react";
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
import type { TooltipProps, TooltipValueType } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SNFitPoint } from "@/types/fatigue";
import { Plus, Trash2 } from "lucide-react";

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

const CHART_MARGINS = { top: 20, right: 24, left: 56, bottom: 32 };
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

export default function SNInteractiveInput({
  points,
  onPointsChange,
}: SNInteractiveInputProps) {
  const [activeMode, setActiveMode] = useState("table");
  const wrapperRef = useRef<HTMLDivElement | null>(null);

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
    const parsed = parseFloat(value);
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

  const handleChartClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const chartX = event.clientX - rect.left;
    const chartY = event.clientY - rect.top;

    const plotLeft = CHART_MARGINS.left;
    const plotRight = rect.width - CHART_MARGINS.right;
    const plotTop = CHART_MARGINS.top;
    const plotBottom = rect.height - CHART_MARGINS.bottom;

    if (
      chartX < plotLeft ||
      chartX > plotRight ||
      chartY < plotTop ||
      chartY > plotBottom
    ) {
      return;
    }

    const xFraction = (chartX - plotLeft) / (plotRight - plotLeft);
    const yFraction = (plotBottom - chartY) / (plotBottom - plotTop);
    const logX =
      Math.log10(X_MIN) +
      xFraction * (Math.log10(X_MAX) - Math.log10(X_MIN));
    const logY =
      Math.log10(yDomain[0]) +
      yFraction * (Math.log10(yDomain[1]) - Math.log10(yDomain[0]));

    const cycles = clamp(10 ** logX, X_MIN, X_MAX);
    const stress = Math.max(1, 10 ** logY);
    onPointsChange([
      ...points,
      { cycles: Math.round(cycles), stress: Number(stress.toFixed(2)) },
    ]);
  };

  return (
    <Card className="border-slate-700 bg-slate-900/70">
      <CardHeader>
        <CardTitle className="text-base text-slate-100">
          S-N Points and Basquin Fit
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeMode} onValueChange={setActiveMode}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="table">Manual Table</TabsTrigger>
            <TabsTrigger value="canvas">Canvas Interaction</TabsTrigger>
          </TabsList>

          <TabsContent value="table" className="space-y-3 pt-3">
            <Button type="button" variant="outline" className="w-full" onClick={addPoint}>
              <Plus className="mr-2 h-4 w-4" /> Add S-N Point
            </Button>
            <div className="space-y-2">
              {points.length === 0 ? (
                <p className="rounded-md border border-slate-700 bg-slate-950/70 p-3 text-sm text-slate-400">
                  Add at least two points to fit Basquin parameters.
                </p>
              ) : (
                points.map((point, index) => (
                  <div
                    key={`${point.cycles}-${point.stress}-${index}`}
                    className="grid grid-cols-12 gap-2"
                  >
                    <Input
                      className="col-span-5"
                      type="number"
                      step="any"
                      value={point.cycles}
                      onChange={(event) =>
                        updatePoint(index, "cycles", event.target.value)
                      }
                      placeholder="Cycles N"
                    />
                    <Input
                      className="col-span-5"
                      type="number"
                      step="any"
                      value={point.stress}
                      onChange={(event) =>
                        updatePoint(index, "stress", event.target.value)
                      }
                      placeholder="Stress amplitude MPa"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      className="col-span-2"
                      onClick={() => removePoint(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="canvas" className="space-y-3 pt-3">
            <p className="text-sm text-slate-400">
              Click inside the log-log chart to add S-N points between 10^0 and
              10^9 cycles.
            </p>
            <div
              ref={wrapperRef}
              className="h-[320px] w-full cursor-crosshair"
              onClick={handleChartClick}
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart margin={CHART_MARGINS}>
                  <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    dataKey="cycles"
                    scale="log"
                    domain={[X_MIN, X_MAX]}
                    tickFormatter={formatLogTick}
                    stroke="#94a3b8"
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    label={{
                      value: "Cycles (N)",
                      position: "insideBottom",
                      offset: -16,
                      fill: "#cbd5e1",
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="stress"
                    scale="log"
                    domain={yDomain}
                    stroke="#94a3b8"
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    label={{
                      value: "Stress amplitude (MPa)",
                      angle: -90,
                      position: "insideLeft",
                      fill: "#cbd5e1",
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border: "1px solid #334155",
                      color: "#e2e8f0",
                    }}
                    formatter={tooltipFormatter}
                  />
                  <Scatter
                    data={sanitizedPoints}
                    dataKey="stress"
                    fill="#22d3ee"
                    name="Input points"
                  />
                  <Line
                    type="monotone"
                    data={fitCurve}
                    dataKey="stress"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    dot={false}
                    name="Fitted curve"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>

        <div className="rounded-md border border-slate-700 bg-slate-950/70 p-3 text-sm text-slate-300">
          {fit ? (
            <div className="space-y-1">
              <p>
                Fit: S = {fit.a.toExponential(3)} * N^{fit.b.toFixed(4)}
              </p>
              <p>
                Basquin: sigma_f&apos; = {fit.sigma_f_prime.toFixed(2)} MPa, b ={" "}
                {fit.b.toFixed(4)}
              </p>
              <p>R^2 = {fit.rSquared.toFixed(4)}</p>
            </div>
          ) : (
            <p>
              Need at least two valid points with positive cycles and stress to
              compute a fit.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
