import { describe, expect, it } from "vitest";
import { getStressPrefillDecision } from "@/lib/stress-image";

describe("getStressPrefillDecision", () => {
  it("allows direct MPa prefill for a usable reading", () => {
    const decision = getStressPrefillDecision({
      success: true,
      detected_quantity: "von_mises",
      detected_label: "Equivalent Stress",
      detected_unit: "MPa",
      max_value: 312.6,
      min_value: 12,
      confidence: "high",
      notes: ["Legend visible"],
      is_usable_for_prefill: true,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.requiresConfirmation).toBe(false);
    expect(decision.valueMpa).toBe(312.6);
  });

  it("rejects prefill when the unit is unknown", () => {
    const decision = getStressPrefillDecision({
      success: true,
      detected_quantity: "von_mises",
      detected_label: "Equivalent Stress",
      detected_unit: "unknown",
      max_value: 312.6,
      min_value: null,
      confidence: "high",
      notes: ["Unit not clearly readable"],
      is_usable_for_prefill: true,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.message).toContain("Unit is unknown");
  });

  it("rejects prefill for low-confidence readings", () => {
    const decision = getStressPrefillDecision({
      success: false,
      detected_quantity: "unknown",
      detected_label: null,
      detected_unit: "MPa",
      max_value: 312.6,
      min_value: null,
      confidence: "low",
      notes: ["Image too low resolution"],
      is_usable_for_prefill: false,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.message).toContain("not reliable enough");
  });
});
