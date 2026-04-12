"use client";

import React from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  AIComparisonEnvelope,
  AIComparisonLife,
  FatigueAnalysisResponse,
  FatigueLifeResult,
  MeanStressCorrectionResult,
} from "@/types/fatigue";

interface ResultsPanelProps {
  results: FatigueAnalysisResponse | null;
  aiComparison: AIComparisonEnvelope | null;
  isLoading: boolean;
  showAIComparison: boolean;
}

function formatCycles(value: number): string {
  if (value <= 0) return "0";
  if (value < 1e3) return value.toFixed(1);
  if (value < 1e6) return `${(value / 1e3).toFixed(1)}k`;
  if (value < 1e9) return `${(value / 1e6).toFixed(2)}M`;
  return value.toExponential(2);
}

function formatLife(life: FatigueLifeResult): string {
  if (life.status === "infinite") return "Infinite life";
  if (!life.cycles || life.cycles <= 0) return "Immediate failure";
  return `${formatCycles(life.cycles)} cycles`;
}

function formatAIComparisonLife(life: AIComparisonLife): string {
  if (life.status === "infinite") return "Infinite life";
  if (!life.cycles || life.cycles <= 0) return "Immediate failure";
  return `${formatCycles(life.cycles)} cycles`;
}

function formatStress(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "N/A";
  }

  return `${value.toFixed(1)} MPa`;
}

function formatEquivalentStress(result: MeanStressCorrectionResult): string {
  if (result.equivalent_alternating_stress === null) return "N/A";
  return `${result.equivalent_alternating_stress.toFixed(1)} MPa`;
}

function getStatusLabel(
  selectedLife: FatigueLifeResult,
  isSafe: boolean
): string {
  if (selectedLife.status === "infinite") {
    return "Infinite life";
  }

  return isSafe ? "Safe" : "Unsafe";
}

export default function ResultsPanel({
  results,
  aiComparison,
  isLoading,
  showAIComparison,
}: ResultsPanelProps) {
  const aiResult = aiComparison?.status === "success" ? aiComparison.result : null;
  const aiAssumptions = aiResult?.assumptions ?? [];
  const aiWarnings = aiResult?.warnings ?? [];

  if (!results) {
    return (
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-slate-900">
            Analysis Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
              Run an analysis to see results.
            </div>
            {showAIComparison ? (
              <div className="rounded-xl border border-dashed border-[#99f6e4] bg-[#f0fdfa] px-4 py-3 text-sm text-[#115e59]">
                {isLoading
                  ? "AI comparison requested. The backend is preparing the native result and the optional AI JSON response."
                  : "AI comparison is enabled. A comparison card will appear here after the next run."}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  }

  const selectedResult = results.selected_mean_stress_result;
  const selectedLife = results.selected_life;
  const isSafe = selectedResult.is_safe;
  const stressState = results.stress_state;
  const curveSource = results.sn_curve_source;
  const statusLabel = getStatusLabel(selectedLife, isSafe);
  const StatusIcon =
    selectedLife.status === "infinite" || isSafe ? ShieldCheck : ShieldAlert;

  return (
    <div className="space-y-4">
      <Card
        className={
          isSafe
            ? "border-green-200 bg-green-50 shadow-sm"
            : selectedLife.status === "infinite"
              ? "border-amber-200 bg-amber-50 shadow-sm"
              : "border-red-200 bg-red-50 shadow-sm"
        }
      >
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                Result status
              </p>
              <p
                className={`text-2xl font-semibold ${
                  selectedLife.status === "infinite"
                    ? "text-amber-700"
                    : isSafe
                      ? "text-green-700"
                      : "text-red-700"
                }`}
              >
                {statusLabel}
              </p>
              <p className="text-sm text-slate-600">
                Primary model: {selectedResult.model_name}
              </p>
            </div>
            <div
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                selectedLife.status === "infinite"
                  ? "bg-amber-100 text-amber-700"
                  : isSafe
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
              }`}
            >
              <StatusIcon className="mr-1 inline-block h-3.5 w-3.5" />
              {statusLabel}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              Cycles to failure
            </p>
            <p className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">
              {formatLife(selectedLife)}
            </p>
            <p className="mt-2 text-sm text-slate-600">{selectedLife.reason}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-500">
                Safety factor
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {selectedResult.safety_factor.toFixed(3)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-500">
                Model used
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {selectedResult.model_name}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {results.selected_mean_stress_model}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-500">
                Sa
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {formatStress(stressState.stress_amplitude)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-500">
                Sm
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {formatStress(stressState.mean_stress)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-500">
                Se
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {results.modified_endurance_limit.toFixed(1)} MPa
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-slate-900">
            Mean stress comparison
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {results.mean_stress_corrections.map((correction) => (
            <div
              key={correction.model_name}
              className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 md:grid-cols-4"
            >
              <div>
                <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-500">
                  Model
                </p>
                <p className="font-medium text-slate-900">
                  {correction.model_name}
                </p>
              </div>
              <div>
                <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-500">
                  Life
                </p>
                <p className="font-medium text-slate-900">
                  {formatLife(correction.life)}
                </p>
              </div>
              <div>
                <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-500">
                  Safety factor
                </p>
                <p className="font-medium text-slate-900">
                  {correction.safety_factor.toFixed(3)}
                </p>
              </div>
              <div>
                <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-500">
                  Corrected Sa
                </p>
                <p className="font-medium text-slate-900">
                  {formatEquivalentStress(correction)}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-slate-900">S-N model</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-500">
              Source
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {curveSource.mode === "points_fit"
                ? "S-N points + fit"
                : "Basquin parameters"}
            </p>
            {curveSource.mode === "points_fit" && curveSource.basquin_fit ? (
              <p className="mt-1 text-sm text-slate-600">
                Backend fit R^2 = {curveSource.basquin_fit.r_squared.toFixed(4)} from{" "}
                {curveSource.basquin_fit.points_used} valid points.
              </p>
            ) : null}
            <p className="mt-1 text-sm text-slate-600">
              sigma_f&apos; = {curveSource.basquin_parameters.sigma_f_prime.toFixed(1)} MPa, b ={" "}
              {curveSource.basquin_parameters.b.toFixed(4)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-500">
              Modified Se
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {results.modified_endurance_limit.toFixed(1)} MPa
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Basquin source: {curveSource.basquin_parameters.source}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Final chart and life result use the backend response, not the local
              form preview.
            </p>
          </div>
        </CardContent>
      </Card>

      {showAIComparison ? (
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-900">
              AI comparison
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {aiComparison?.status === "success" && aiResult ? (
              <>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-500">
                      Life comparison
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      Native: {formatLife(results.selected_life)}
                    </p>
                    <p className="mt-1 text-sm text-slate-900">
                      AI: {formatAIComparisonLife(aiResult.life)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-500">
                      Safety factor comparison
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      Native: {results.selected_mean_stress_result.safety_factor.toFixed(3)}
                    </p>
                    <p className="mt-1 text-sm text-slate-900">
                      AI:{" "}
                      {aiResult.safety_factor === null ||
                      aiResult.safety_factor === undefined
                        ? "N/A"
                        : aiResult.safety_factor.toFixed(3)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-500">
                      Basquin parameters
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      Native: sigma_f&apos; ={" "}
                      {results.sn_curve_source.basquin_parameters.sigma_f_prime.toFixed(1)} MPa, b ={" "}
                      {results.sn_curve_source.basquin_parameters.b.toFixed(4)}
                    </p>
                    <p className="mt-1 text-sm text-slate-900">
                      AI:{" "}
                      {aiResult.basquin_parameters.sigma_f_prime !== null &&
                      aiResult.basquin_parameters.sigma_f_prime !== undefined &&
                      aiResult.basquin_parameters.b !== null &&
                      aiResult.basquin_parameters.b !== undefined
                        ? `sigma_f' = ${aiResult.basquin_parameters.sigma_f_prime.toFixed(1)} MPa, b = ${aiResult.basquin_parameters.b.toFixed(4)}`
                        : "N/A"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Model: {aiResult.raw_model_name}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-500">
                      AI summary
                    </p>
                    <p className="mt-2 text-sm text-slate-900">
                      {aiResult.summary}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-500">
                      Assumptions
                    </p>
                    <div className="mt-2 space-y-1 text-sm text-slate-700">
                      {aiAssumptions.length > 0 ? (
                        aiAssumptions.map((assumption, index) => (
                          <p key={`${assumption}-${index}`}>{assumption}</p>
                        ))
                      ) : (
                        <p>No explicit assumptions returned.</p>
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-500">
                      Warnings
                    </p>
                    <div className="mt-2 space-y-1 text-sm text-slate-700">
                      {aiWarnings.length > 0 ? (
                        aiWarnings.map((warning, index) => (
                          <p key={`${warning}-${index}`}>{warning}</p>
                        ))
                      ) : (
                        <p>No AI warnings returned.</p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : aiComparison?.status === "error" && aiComparison.error ? (
              <div className="rounded-xl border border-[#fed7aa] bg-[#fff7ed] px-4 py-3 text-sm text-[#9a3412]">
                <p className="font-semibold">AI comparison unavailable</p>
                <p className="mt-1">{aiComparison.error.message}</p>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                {isLoading
                  ? "Waiting for the optional AI comparison."
                  : "AI comparison was skipped for this run."}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {results.notch_result ? (
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-900">
              Notch correction
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
              <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-500">
                Model
              </p>
              <p className="mt-1 font-semibold text-slate-900">
                {results.notch_result.model}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
              <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-500">
                Kt
              </p>
              <p className="mt-1 font-semibold text-slate-900">
                {results.notch_result.kt.toFixed(3)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
              <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-500">
                q
              </p>
              <p className="mt-1 font-semibold text-slate-900">
                {results.notch_result.q.toFixed(3)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
              <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-500">
                Kf
              </p>
              <p className="mt-1 font-semibold text-slate-900">
                {results.notch_result.kf.toFixed(3)}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {results.miner_damage ? (
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-900">
              Palmgren-Miner damage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-500">
                  Total damage
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {results.miner_damage.total_damage === null
                    ? "Immediate failure"
                    : results.miner_damage.total_damage.toFixed(4)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-500">
                  Sequence life
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {formatLife(results.miner_damage.sequence_life)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-500">
                  Failure status
                </p>
                <p
                  className={`mt-1 text-lg font-semibold ${
                    results.miner_damage.is_failure
                      ? "text-red-700"
                      : "text-green-700"
                  }`}
                >
                  {results.miner_damage.is_failure
                    ? "Sequence fails"
                    : "Sequence survives"}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {results.miner_damage.block_results.map((block) => (
                <div
                  key={block.block_index}
                  className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 md:grid-cols-5"
                >
                  <div>
                    <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-500">
                      Block
                    </p>
                    <p className="font-medium text-slate-900">
                      {block.block_index + 1}
                    </p>
                  </div>
                  <div>
                    <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-500">
                      Life
                    </p>
                    <p className="font-medium text-slate-900">
                      {formatLife(block.life)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-500">
                      Applied cycles
                    </p>
                    <p className="font-medium text-slate-900">
                      {formatCycles(block.applied_cycles)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-500">
                      Damage
                    </p>
                    <p className="font-medium text-slate-900">
                      {block.damage === null ? "N/A" : block.damage.toFixed(4)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-500">
                      Corrected Sa
                    </p>
                    <p className="font-medium text-slate-900">
                      {block.equivalent_alternating_stress === null
                        ? "N/A"
                        : `${block.equivalent_alternating_stress.toFixed(1)} MPa`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
