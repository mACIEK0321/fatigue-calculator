import { describe, expect, it } from "vitest";
import { mapSNChartPositionToPoint } from "@/lib/sn-chart";

describe("mapSNChartPositionToPoint", () => {
  it("maps clicks inside the plot area through the provided inverse scales", () => {
    const plotArea = { x: 40, y: 20, width: 100, height: 200 };

    const point = mapSNChartPositionToPoint({
      chartX: 90,
      chartY: 120,
      plotArea,
      getCyclesAtPixel: (pixel) => 10 ** ((Number(pixel) - 40) / 20),
      getStressAtPixel: (pixel) => 10 ** (3 - (Number(pixel) - 20) / 100),
    });

    expect(point).toStrictEqual({
      cycles: 316,
      stress: 100,
    });
  });

  it("ignores clicks outside the real plot area", () => {
    const plotArea = { x: 40, y: 20, width: 100, height: 200 };

    const point = mapSNChartPositionToPoint({
      chartX: 20,
      chartY: 120,
      plotArea,
      getCyclesAtPixel: (pixel) => pixel,
      getStressAtPixel: (pixel) => pixel,
    });

    expect(point).toBeNull();
  });
});
