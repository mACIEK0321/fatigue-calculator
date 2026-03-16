import type {
  FatigueAnalysisRequest,
  FatigueAnalysisResponse,
  MaterialPreset,
  SurfaceFinishInput,
} from "@/types/fatigue";

const BASE_URL = "http://localhost:8000/api";

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API Error ${response.status}: ${errorBody}`);
  }
  return response.json() as Promise<T>;
}

export async function analyzeFatigue(
  request: FatigueAnalysisRequest
): Promise<FatigueAnalysisResponse> {
  return apiFetch<FatigueAnalysisResponse>(`${BASE_URL}/analyze`, {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function getMaterialPresets(): Promise<MaterialPreset[]> {
  return apiFetch<MaterialPreset[]>(`${BASE_URL}/materials/presets`);
}

export async function calculateSurfaceFactor(
  input: SurfaceFinishInput
): Promise<{ surface_factor: number }> {
  return apiFetch<{ surface_factor: number }>(`${BASE_URL}/surface-factor`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
