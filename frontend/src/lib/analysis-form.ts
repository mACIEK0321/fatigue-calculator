export function toNumericDraft(value: number | null | undefined): string {
  return value === null || value === undefined || Number.isNaN(value)
    ? ""
    : String(value);
}

export function parseNumericDraft(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === "") {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}
