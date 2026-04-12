import type {
  FatigueAnalysisCompareRequest,
  FatigueAnalysisCompareResponse,
  FatigueAnalysisRequest,
  FatigueAnalysisResponse,
  MaterialPreset,
  SurfaceFinishInput,
} from "@/types/fatigue";

const DEFAULT_DEV_API_BASE_URL = "http://127.0.0.1:8000/api";

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function resolveApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (configured) {
    return normalizeBaseUrl(configured);
  }
  if (process.env.NODE_ENV !== "production") {
    return DEFAULT_DEV_API_BASE_URL;
  }
  throw new Error(
    "NEXT_PUBLIC_API_BASE_URL is not configured for this environment."
  );
}

export class ApiError extends Error {
  status: number;

  detail: string;

  constructor(status: number, detail: string) {
    super(`API Error ${status}: ${detail}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function parseErrorDetail(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as { detail?: unknown };
    if (typeof payload.detail === "string") {
      return payload.detail;
    }
  }

  const text = await response.text();
  return text || "Unexpected API failure.";
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${resolveApiBaseUrl()}${path}`, {
      headers: {
        "Content-Type": "application/json",
      },
      ...options,
    });
  } catch {
    throw new Error(
      `Unable to reach the fatigue API. Check NEXT_PUBLIC_API_BASE_URL and backend availability.`
    );
  }

  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorDetail(response));
  }

  return response.json() as Promise<T>;
}

export async function analyzeFatigue(
  request: FatigueAnalysisRequest
): Promise<FatigueAnalysisResponse> {
  return apiFetch<FatigueAnalysisResponse>("/analyze", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function analyzeFatigueComparison(
  request: FatigueAnalysisCompareRequest
): Promise<FatigueAnalysisCompareResponse> {
  return apiFetch<FatigueAnalysisCompareResponse>("/analyze/compare", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function getMaterialPresets(): Promise<MaterialPreset[]> {
  return apiFetch<MaterialPreset[]>("/materials/presets");
}

export async function calculateSurfaceFactor(
  input: SurfaceFinishInput
): Promise<{ surface_factor: number }> {
  return apiFetch<{ surface_factor: number }>("/surface-factor", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
