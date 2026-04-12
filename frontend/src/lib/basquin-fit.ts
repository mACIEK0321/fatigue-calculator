import type { BasquinFitResult, SNDataPoint, SNFitPoint } from "@/types/fatigue";

export const DISPLAY_SN_CURVE_MIN_CYCLES = 1;
export const DISPLAY_SN_CURVE_MAX_CYCLES = 1e9;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function sanitizeSNFitPoints(points: SNFitPoint[]): SNFitPoint[] {
  return points.filter((point) => point.cycles > 0 && point.stress > 0);
}

export function fitBasquinFromPoints(
  points: SNFitPoint[]
): BasquinFitResult | null {
  if (points.length < 2) {
    return null;
  }

  if (new Set(points.map((point) => point.cycles)).size < 2) {
    return null;
  }

  const x = points.map((point) => Math.log10(point.cycles));
  const y = points.map((point) => Math.log10(point.stress));

  const xMean = x.reduce((sum, value) => sum + value, 0) / x.length;
  const yMean = y.reduce((sum, value) => sum + value, 0) / y.length;

  const numerator = x.reduce((sum, value, index) => {
    return sum + (value - xMean) * (y[index] - yMean);
  }, 0);
  const denominator = x.reduce((sum, value) => sum + (value - xMean) ** 2, 0);

  if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-12) {
    return null;
  }

  const b = numerator / denominator;
  const intercept = yMean - b * xMean;

  if (!Number.isFinite(b) || !Number.isFinite(intercept) || b >= 0) {
    return null;
  }

  const a = 10 ** intercept;
  const sigma_f_prime = a / 2 ** b;
  if (!Number.isFinite(a) || !Number.isFinite(sigma_f_prime) || sigma_f_prime <= 0) {
    return null;
  }

  const yPred = x.map((value) => intercept + b * value);
  const ssRes = y.reduce((sum, value, index) => sum + (value - yPred[index]) ** 2, 0);
  const ssTot = y.reduce((sum, value) => sum + (value - yMean) ** 2, 0);
  const rSquared = ssTot <= 1e-14 ? 1 : 1 - ssRes / ssTot;

  return {
    a,
    b,
    sigma_f_prime,
    r_squared: clamp(rSquared, 0, 1),
    points_used: points.length,
  };
}

export function basquinStressAmplitude(
  cycles: number,
  sigmaFPrime: number,
  b: number
): number {
  return sigmaFPrime * (2 * cycles) ** b;
}

export function buildBasquinCurve(
  sigmaFPrime: number,
  b: number,
  numPoints = 61,
  nMin = DISPLAY_SN_CURVE_MIN_CYCLES,
  nMax = DISPLAY_SN_CURVE_MAX_CYCLES
): SNDataPoint[] {
  const curve: SNDataPoint[] = [];

  for (let index = 0; index < numPoints; index += 1) {
    const fraction = numPoints === 1 ? 0 : index / (numPoints - 1);
    const logCycles =
      Math.log10(nMin) + fraction * (Math.log10(nMax) - Math.log10(nMin));
    const cycles = 10 ** logCycles;
    const stress = basquinStressAmplitude(cycles, sigmaFPrime, b);

    if (Number.isFinite(stress) && stress > 0) {
      curve.push({ cycles, stress });
    }
  }

  return curve;
}
