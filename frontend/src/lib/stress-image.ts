import type { StressImageReadResponse } from "@/types/fatigue";

const STRESS_UNIT_TO_MPA: Record<string, number> = {
  pa: 1e-6,
  kpa: 1e-3,
  mpa: 1,
  gpa: 1e3,
  psi: 0.00689476,
  ksi: 6.89476,
};

export interface StressPrefillDecision {
  allowed: boolean;
  valueMpa?: number;
  requiresConfirmation: boolean;
  message?: string;
}

export function normalizeStressUnit(unit: string | null | undefined): string {
  return (unit ?? "").trim().toLowerCase();
}

export function getStressPrefillDecision(
  result: StressImageReadResponse | null | undefined
): StressPrefillDecision {
  if (!result) {
    return {
      allowed: false,
      requiresConfirmation: false,
      message: "No image reading is available yet.",
    };
  }

  if (result.max_value === null || result.max_value === undefined) {
    return {
      allowed: false,
      requiresConfirmation: false,
      message: "No maximum stress value was detected in the screenshot.",
    };
  }

  if (!result.success || !result.is_usable_for_prefill) {
    return {
      allowed: false,
      requiresConfirmation: false,
      message: "Detected value is not reliable enough to prefill automatically.",
    };
  }

  if (result.confidence === "low") {
    return {
      allowed: false,
      requiresConfirmation: false,
      message: "Confidence is low. Review the screenshot manually before using it.",
    };
  }

  const normalizedUnit = normalizeStressUnit(result.detected_unit);
  if (!normalizedUnit || normalizedUnit === "unknown") {
    return {
      allowed: false,
      requiresConfirmation: false,
      message: "Unit is unknown. The value cannot be inserted safely.",
    };
  }

  const factor = STRESS_UNIT_TO_MPA[normalizedUnit];
  if (factor === undefined) {
    return {
      allowed: false,
      requiresConfirmation: false,
      message: `Unit ${result.detected_unit} is not supported for direct prefill.`,
    };
  }

  return {
    allowed: true,
    valueMpa: result.max_value * factor,
    requiresConfirmation: normalizedUnit !== "mpa",
    message:
      normalizedUnit === "mpa"
        ? "Detected value is ready to use as max stress."
        : `Convert ${result.max_value} ${result.detected_unit} to MPa before using it.`,
  };
}
