"use client";

import React, { useState } from "react";
import GoodmanDiagram from "./GoodmanDiagram";
import MaterialForm from "./MaterialForm";
import ResultsPanel from "./ResultsPanel";
import SNChart from "./SNChart";
import { ApiError, analyzeFatigueComparison } from "@/lib/api";
import type {
  FatigueAnalysisCompareRequest,
  FatigueAnalysisCompareResponse,
  SNCurveSourceMode,
  SNFitPoint,
} from "@/types/fatigue";

export default function AnalysisEngine() {
  const [response, setResponse] =
    useState<FatigueAnalysisCompareResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compareWithDeepSeek, setCompareWithDeepSeek] = useState(false);
  const [snCurveSourceMode, setSnCurveSourceMode] =
    useState<SNCurveSourceMode>("material_basquin");
  const [snPoints, setSnPoints] = useState<SNFitPoint[]>([
    { cycles: 1e4, stress: 420 },
    { cycles: 1e5, stress: 310 },
    { cycles: 1e6, stress: 245 },
  ]);

  const handleSubmit = async (request: FatigueAnalysisCompareRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await analyzeFatigueComparison(request);
      setResponse(result);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-2xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#991b1b]">
          <p className="font-semibold">Analysis error</p>
          <p className="mt-1">{error}</p>
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <MaterialForm
          onSubmit={handleSubmit}
          isLoading={isLoading}
          snCurveSourceMode={snCurveSourceMode}
          onSNCurveSourceModeChange={setSnCurveSourceMode}
          snPoints={snPoints}
          onSNPointsChange={setSnPoints}
          compareWithDeepSeek={compareWithDeepSeek}
          onCompareWithDeepSeekChange={setCompareWithDeepSeek}
        />
        <ResultsPanel
          results={response?.native_analysis ?? null}
          aiComparison={response?.ai_comparison ?? null}
          isLoading={isLoading}
          showAIComparison={compareWithDeepSeek}
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SNChart
          chartData={response?.native_analysis.sn_chart ?? null}
          curveSource={response?.native_analysis.sn_curve_source ?? null}
          aiComparison={response?.ai_comparison ?? null}
        />
        <GoodmanDiagram
          diagram={response?.native_analysis.haigh_diagram ?? null}
          selectedModel={response?.native_analysis.selected_mean_stress_model ?? null}
        />
      </section>
    </div>
  );
}
