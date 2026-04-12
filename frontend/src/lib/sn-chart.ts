import type { PlotArea } from "recharts";
import type { SNFitPoint } from "@/types/fatigue";

export interface SNChartPointMappingInput {
  chartX: number;
  chartY: number;
  plotArea: PlotArea;
  getCyclesAtPixel: (pixel: number) => unknown;
  getStressAtPixel: (pixel: number) => unknown;
  xMin?: number;
  xMax?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function mapSNChartPositionToPoint({
  chartX,
  chartY,
  plotArea,
  getCyclesAtPixel,
  getStressAtPixel,
  xMin = 1,
  xMax = 1e9,
}: SNChartPointMappingInput): SNFitPoint | null {
  const withinX = chartX >= plotArea.x && chartX <= plotArea.x + plotArea.width;
  const withinY = chartY >= plotArea.y && chartY <= plotArea.y + plotArea.height;

  if (!withinX || !withinY) {
    return null;
  }

  const cycles = Number(getCyclesAtPixel(chartX));
  const stress = Number(getStressAtPixel(chartY));

  if (!Number.isFinite(cycles) || !Number.isFinite(stress) || stress <= 0) {
    return null;
  }

  return {
    cycles: Math.round(clamp(cycles, xMin, xMax)),
    stress: Number(stress.toFixed(2)),
  };
}
