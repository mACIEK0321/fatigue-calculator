"use client";

import React, { useState } from "react";
import MaterialForm from "./MaterialForm";
import SNChart from "./SNChart";
import GoodmanDiagram from "./GoodmanDiagram";
import ResultsPanel from "./ResultsPanel";
import SNInteractiveInput from "./SNInteractiveInput";
import { analyzeFatigue } from "@/lib/api";
import type {
  FatigueAnalysisRequest,
  FatigueAnalysisResponse,
  SNFitPoint,
} from "@/types/fatigue";

export default function AnalysisEngine() {
  const [response, setResponse] = useState<FatigueAnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snPoints, setSnPoints] = useState<SNFitPoint[]>([
    { cycles: 1e4, stress: 420 },
    { cycles: 1e5, stress: 310 },
    { cycles: 1e6, stress: 245 },
  ]);
  const [hasLocalFit, setHasLocalFit] = useState(false);

  const handleSubmit = async (request: FatigueAnalysisRequest) => {
    setIsLoading(true);
    setError(null);
    try {
      const payload: FatigueAnalysisRequest = {
        ...request,
        sn_fit_points: snPoints.length > 1 ? snPoints : undefined,
      };

      const result = await analyzeFatigue(payload);
      setResponse(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left panel - Form */}
      <div className="space-y-6 lg:col-span-5">
        <MaterialForm onSubmit={handleSubmit} isLoading={isLoading} />
        <SNInteractiveInput
          points={snPoints}
          onPointsChange={setSnPoints}
          onFitChange={(fit) => setHasLocalFit(Boolean(fit))}
        />
      </div>

      {/* Right panel - Results */}
      <div className="space-y-6 lg:col-span-7">
        {error && (
          <div className="rounded-lg border border-red-700 bg-red-950/50 p-4 text-red-300">
            <p className="font-medium">Analysis Error</p>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        )}

        {hasLocalFit && !response?.basquin_fit && (
          <div className="rounded-lg border border-amber-700 bg-amber-950/40 p-3 text-sm text-amber-200">
            Local fit ready. Run analysis to apply fitted Basquin parameters to backend calculations.
          </div>
        )}

        <ResultsPanel results={response} />

        <div className="grid grid-cols-1 gap-6">
          <SNChart data={response?.sn_curve_data ?? []} />
          <GoodmanDiagram
            goodmanEnvelope={response?.goodman_envelope ?? []}
            gerberEnvelope={response?.gerber_envelope ?? []}
            soderbergEnvelope={response?.soderberg_envelope ?? []}
            morrowEnvelope={response?.morrow_envelope ?? []}
            operatingPoint={response?.operating_point ?? null}
          />
        </div>
      </div>
    </div>
  );
}
