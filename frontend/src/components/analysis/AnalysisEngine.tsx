"use client";

import React, { useState } from "react";
import MaterialForm from "./MaterialForm";
import SNChart from "./SNChart";
import GoodmanDiagram from "./GoodmanDiagram";
import ResultsPanel from "./ResultsPanel";
import { analyzeFatigue } from "@/lib/api";
import type {
  FatigueAnalysisRequest,
  FatigueAnalysisResponse,
} from "@/types/fatigue";

export default function AnalysisEngine() {
  const [response, setResponse] = useState<FatigueAnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (request: FatigueAnalysisRequest) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await analyzeFatigue(request);
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
      <div className="lg:col-span-4">
        <MaterialForm onSubmit={handleSubmit} isLoading={isLoading} />
      </div>

      {/* Right panel - Results */}
      <div className="space-y-6 lg:col-span-8">
        {error && (
          <div className="rounded-lg border border-red-700 bg-red-950/50 p-4 text-red-300">
            <p className="font-medium">Analysis Error</p>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        )}

        <ResultsPanel results={response} />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
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
