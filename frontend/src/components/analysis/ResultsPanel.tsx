"use client";

import React from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  FatigueAnalysisResponse,
  FatigueLifeResult,
  MeanStressCorrectionResult,
} from "@/types/fatigue";

interface ResultsPanelProps {
  results: FatigueAnalysisResponse | null;
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

function formatEquivalentStress(result: MeanStressCorrectionResult): string {
  if (result.equivalent_alternating_stress === null) return "N/A";
  return `${result.equivalent_alternating_stress.toFixed(1)} MPa`;
}

export default function ResultsPanel({ results }: ResultsPanelProps) {
  if (!results) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Analysis Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 items-center justify-center text-slate-500">
            Run an analysis to see results.
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

  return (
    <div className="space-y-4">
      <Card
        className={
          isSafe
            ? "border-green-700 bg-green-950/40"
            : "border-red-700 bg-red-950/40"
        }
      >
        <CardContent className="flex items-start gap-3 p-4">
          {isSafe ? (
            <ShieldCheck className="mt-0.5 h-8 w-8 text-green-400" />
          ) : (
            <ShieldAlert className="mt-0.5 h-8 w-8 text-red-400" />
          )}
          <div className="space-y-1">
            <p
              className={`text-xl font-bold ${
                isSafe ? "text-green-300" : "text-red-300"
              }`}
            >
              {isSafe ? "SAFE" : "UNSAFE"}
            </p>
            <p className="text-sm text-slate-200">
              Primary result from {selectedResult.model_name}
            </p>
            <p className="text-sm text-slate-400">{selectedLife.reason}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Primary Result</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
            <p className="text-xs text-slate-400">Selected Life</p>
            <p className="mt-2 text-xl font-semibold text-cyan-300">
              {formatLife(selectedLife)}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Model: {results.selected_mean_stress_model}
            </p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
            <p className="text-xs text-slate-400">Safety Factor</p>
            <p
              className={`mt-2 text-xl font-semibold ${
                isSafe ? "text-green-300" : "text-red-300"
              }`}
            >
              {selectedResult.safety_factor.toFixed(3)}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Equivalent alternating stress: {formatEquivalentStress(selectedResult)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
            <p className="text-xs text-slate-400">S-N Source</p>
            <p className="mt-2 text-lg font-semibold text-cyan-300">
              {curveSource.mode === "points_fit" ? "Points + fit" : "Material Basquin"}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              sigma_f&apos; = {curveSource.basquin_parameters.sigma_f_prime.toFixed(1)} MPa,
              b = {curveSource.basquin_parameters.b.toFixed(4)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Stress State</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg bg-slate-800 p-3 text-center">
            <p className="text-xs text-slate-400">Input Max</p>
            <p className="mt-1 font-semibold text-slate-100">
              {stressState.input_max_stress.toFixed(1)} MPa
            </p>
          </div>
          <div className="rounded-lg bg-slate-800 p-3 text-center">
            <p className="text-xs text-slate-400">Input Min</p>
            <p className="mt-1 font-semibold text-slate-100">
              {stressState.input_min_stress.toFixed(1)} MPa
            </p>
          </div>
          <div className="rounded-lg bg-slate-800 p-3 text-center">
            <p className="text-xs text-slate-400">Corrected Sa</p>
            <p className="mt-1 font-semibold text-cyan-300">
              {stressState.stress_amplitude.toFixed(1)} MPa
            </p>
          </div>
          <div className="rounded-lg bg-slate-800 p-3 text-center">
            <p className="text-xs text-slate-400">Corrected Sm</p>
            <p className="mt-1 font-semibold text-cyan-300">
              {stressState.mean_stress.toFixed(1)} MPa
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Model Comparison</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {results.mean_stress_corrections.map((correction) => (
            <div
              key={correction.model_name}
              className="grid grid-cols-1 gap-2 rounded-lg bg-slate-800 px-3 py-3 md:grid-cols-4"
            >
              <div>
                <p className="text-xs text-slate-400">Model</p>
                <p className="font-medium text-slate-100">{correction.model_name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Life</p>
                <p className="font-medium text-slate-100">{formatLife(correction.life)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Safety Factor</p>
                <p className="font-medium text-slate-100">
                  {correction.safety_factor.toFixed(3)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Corrected Sa</p>
                <p className="font-medium text-slate-100">
                  {formatEquivalentStress(correction)}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Endurance Limit and Active Curve</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-lg bg-slate-800 p-3">
            <p className="text-xs text-slate-400">Modified Endurance Limit</p>
            <p className="mt-1 text-lg font-semibold text-amber-300">
              {results.modified_endurance_limit.toFixed(1)} MPa
            </p>
          </div>
          <div className="rounded-lg bg-slate-800 p-3">
            <p className="text-xs text-slate-400">Basquin Parameter Source</p>
            <p className="mt-1 text-lg font-semibold text-slate-100">
              {curveSource.basquin_parameters.source}
            </p>
          </div>
        </CardContent>
      </Card>

      {results.notch_result && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Notch Correction</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-lg bg-slate-800 p-3 text-center">
              <p className="text-xs text-slate-400">Model</p>
              <p className="mt-1 font-semibold text-slate-100">
                {results.notch_result.model}
              </p>
            </div>
            <div className="rounded-lg bg-slate-800 p-3 text-center">
              <p className="text-xs text-slate-400">Kt</p>
              <p className="mt-1 font-semibold text-slate-100">
                {results.notch_result.kt.toFixed(3)}
              </p>
            </div>
            <div className="rounded-lg bg-slate-800 p-3 text-center">
              <p className="text-xs text-slate-400">q</p>
              <p className="mt-1 font-semibold text-slate-100">
                {results.notch_result.q.toFixed(3)}
              </p>
            </div>
            <div className="rounded-lg bg-slate-800 p-3 text-center">
              <p className="text-xs text-slate-400">Kf</p>
              <p className="mt-1 font-semibold text-cyan-300">
                {results.notch_result.kf.toFixed(3)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {results.miner_damage && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Palmgren-Miner Damage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-lg bg-slate-800 p-3">
                <p className="text-xs text-slate-400">Total Damage</p>
                <p className="mt-1 text-lg font-semibold text-slate-100">
                  {results.miner_damage.total_damage === null
                    ? "Immediate failure"
                    : results.miner_damage.total_damage.toFixed(4)}
                </p>
              </div>
              <div className="rounded-lg bg-slate-800 p-3">
                <p className="text-xs text-slate-400">Sequence Life</p>
                <p className="mt-1 text-lg font-semibold text-cyan-300">
                  {formatLife(results.miner_damage.sequence_life)}
                </p>
              </div>
              <div className="rounded-lg bg-slate-800 p-3">
                <p className="text-xs text-slate-400">Failure Status</p>
                <p
                  className={`mt-1 text-lg font-semibold ${
                    results.miner_damage.is_failure
                      ? "text-red-300"
                      : "text-green-300"
                  }`}
                >
                  {results.miner_damage.is_failure ? "Sequence fails" : "Sequence survives"}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {results.miner_damage.block_results.map((block) => (
                <div
                  key={block.block_index}
                  className="grid grid-cols-1 gap-2 rounded-lg bg-slate-800 px-3 py-3 md:grid-cols-5"
                >
                  <div>
                    <p className="text-xs text-slate-400">Block</p>
                    <p className="font-medium text-slate-100">{block.block_index + 1}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Life</p>
                    <p className="font-medium text-slate-100">{formatLife(block.life)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Applied Cycles</p>
                    <p className="font-medium text-slate-100">
                      {formatCycles(block.applied_cycles)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Damage</p>
                    <p className="font-medium text-slate-100">
                      {block.damage === null ? "N/A" : block.damage.toFixed(4)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Corrected Sa</p>
                    <p className="font-medium text-slate-100">
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
      )}
    </div>
  );
}
