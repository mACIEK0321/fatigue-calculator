"use client";

import React, { useState } from "react";
import MaterialForm from "./MaterialForm";
import SNChart from "./SNChart";
import GoodmanDiagram from "./GoodmanDiagram";
import ResultsPanel from "./ResultsPanel";
import SNInteractiveInput from "./SNInteractiveInput";
import { ApiError, analyzeFatigue } from "@/lib/api";
import type {
  FatigueAnalysisRequest,
  FatigueAnalysisResponse,
  SNCurveSourceMode,
  SNFitPoint,
} from "@/types/fatigue";

export default function AnalysisEngine() {
  const [response, setResponse] = useState<FatigueAnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snCurveSourceMode, setSnCurveSourceMode] =
    useState<SNCurveSourceMode>("material_basquin");
  const [snPoints, setSnPoints] = useState<SNFitPoint[]>([
    { cycles: 1e4, stress: 420 },
    { cycles: 1e5, stress: 310 },
    { cycles: 1e6, stress: 245 },
  ]);

  const handleSubmit = async (request: FatigueAnalysisRequest) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await analyzeFatigue(request);
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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="space-y-6 lg:col-span-5">
        <MaterialForm
          onSubmit={handleSubmit}
          isLoading={isLoading}
          snCurveSourceMode={snCurveSourceMode}
          onSNCurveSourceModeChange={setSnCurveSourceMode}
          snPoints={snPoints}
        />
        {snCurveSourceMode === "points_fit" ? (
          <SNInteractiveInput points={snPoints} onPointsChange={setSnPoints} />
        ) : (
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
            S-N points are disabled while the analysis uses material Basquin
            parameters. Switch the curve source to <span className="text-slate-200">Points + fit</span>
            to edit the fitted curve.
          </div>
        )}
      </div>

      <div className="space-y-6 lg:col-span-7">
        {error && (
          <div className="rounded-lg border border-red-800 bg-red-950/50 p-4 text-red-200">
            <p className="font-medium">Analysis Error</p>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        )}

        <ResultsPanel results={response} />

        <div className="grid grid-cols-1 gap-6">
          <SNChart
            chartData={response?.sn_chart ?? null}
            curveSource={response?.sn_curve_source ?? null}
          />
          <GoodmanDiagram
            diagram={response?.haigh_diagram ?? null}
            selectedModel={response?.selected_mean_stress_model ?? null}
          />
        </div>
      </div>
    </div>
  );
}
