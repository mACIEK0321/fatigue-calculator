import { describe, expect, it } from "vitest";
import { parseNumericDraft, toNumericDraft } from "@/lib/analysis-form";

describe("analysis-form helpers", () => {
  it("keeps empty numeric drafts empty instead of coercing them to zero", () => {
    expect(parseNumericDraft("")).toBeUndefined();
    expect(parseNumericDraft("   ")).toBeUndefined();
  });

  it("round-trips valid numeric drafts without changing zero semantics", () => {
    expect(parseNumericDraft("0")).toBe(0);
    expect(parseNumericDraft("1e5")).toBe(100000);
    expect(toNumericDraft(0)).toBe("0");
    expect(toNumericDraft(undefined)).toBe("");
  });
});
