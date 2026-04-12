import { describe, expect, it } from "vitest";
import {
  buildBasquinCurve,
  DISPLAY_SN_CURVE_MAX_CYCLES,
  DISPLAY_SN_CURVE_MIN_CYCLES,
  fitBasquinFromPoints,
  sanitizeSNFitPoints,
} from "@/lib/basquin-fit";

describe("basquin-fit", () => {
  it("filters invalid points consistently with the backend request payload", () => {
    expect(
      sanitizeSNFitPoints([
        { cycles: 1e4, stress: 420 },
        { cycles: 0, stress: 320 },
        { cycles: 1e5, stress: -10 },
        { cycles: 1e6, stress: 245 },
      ])
    ).toStrictEqual([
      { cycles: 1e4, stress: 420 },
      { cycles: 1e6, stress: 245 },
    ]);
  });

  it("matches the backend Basquin regression parameters for points_fit", () => {
    const fit = fitBasquinFromPoints([
      { cycles: 1e4, stress: 420 },
      { cycles: 1e5, stress: 320 },
      { cycles: 1e6, stress: 245 },
    ]);

    expect(fit).not.toBeNull();
    expect(fit?.a).toBeCloseTo(1233.284100972462, 9);
    expect(fit?.b).toBeCloseTo(-0.11704160301668387, 12);
    expect(fit?.sigma_f_prime).toBeCloseTo(1337.5073153506498, 9);
    expect(fit?.r_squared).toBeCloseTo(0.9999727780739391, 12);
    expect(fit?.points_used).toBe(3);
  });

  it("builds the same preview curve range used by the final backend chart", () => {
    const curve = buildBasquinCurve(1337.5073153506498, -0.11704160301668387, 5);

    expect(curve[0]?.cycles).toBeCloseTo(DISPLAY_SN_CURVE_MIN_CYCLES, 12);
    expect(curve.at(-1)?.cycles).toBeCloseTo(DISPLAY_SN_CURVE_MAX_CYCLES, 3);
    expect(curve).toHaveLength(5);
  });
});
