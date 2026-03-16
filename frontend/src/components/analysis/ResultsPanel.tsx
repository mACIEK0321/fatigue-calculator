"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { FatigueAnalysisResponse } from "@/types/fatigue";
import { ShieldCheck, ShieldAlert } from "lucide-react";

interface ResultsPanelProps {
  results: FatigueAnalysisResponse | null;
}

function formatCycles(n: number): string {
  if (!isFinite(n) || n <= 0) return "Infinite";
  if (n >= 1e15) return "Infinite";
  const exp = Math.floor(Math.log10(n));
  const mantissa = n / Math.pow(10, exp);

  const superscripts: Record<string, string> = {
    "0": "\u2070",
    "1": "\u00B9",
    "2": "\u00B2",
    "3": "\u00B3",
    "4": "\u2074",
    "5": "\u2075",
    "6": "\u2076",
    "7": "\u2077",
    "8": "\u2078",
    "9": "\u2079",
  };

  const expStr = String(exp)
    .split("")
    .map((c) => superscripts[c] || c)
    .join("");

  return `${mantissa.toFixed(2)} \u00D7 10${expStr}`;
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
            Run an analysis to see results
          </div>
        </CardContent>
      </Card>
    );
  }

  const selectedResult = results.selected_mean_stress_result;
  const isSafe = selectedResult.safety_factor > 1;
  const safetyFactor = selectedResult.safety_factor;
  const gaugeRatio = Math.max(0, Math.min(2, safetyFactor)) / 2;
  const gaugeAngle = -90 + gaugeRatio * 180;
  const cyclesFromSelected = results.selected_cycles_to_failure;

  return (
    <div className="space-y-4">
      {/* Verdict Banner */}
      <Card
        className={
          isSafe
            ? "border-green-600 bg-green-950/50"
            : "border-red-600 bg-red-950/50"
        }
      >
        <CardContent className="flex items-center gap-3 p-4">
          {isSafe ? (
            <ShieldCheck className="h-8 w-8 text-green-400" />
          ) : (
            <ShieldAlert className="h-8 w-8 text-red-400" />
          )}
          <div>
            <p
              className={`text-xl font-bold ${
                isSafe ? "text-green-400" : "text-red-400"
              }`}
            >
              {isSafe ? "SAFE" : "UNSAFE"}
            </p>
            <p className="text-sm text-slate-400">
              Based on {selectedResult.model_name} criterion (SF = {safetyFactor.toFixed(3)})
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Live Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
            <p className="text-xs text-slate-400">Safe / Fail Gauge</p>
            <div className="relative mt-3 h-28">
              <svg viewBox="0 0 200 110" className="h-24 w-full">
                <path d="M 20 100 A 80 80 0 0 1 100 20" fill="none" stroke="#f59e0b" strokeWidth="14" />
                <path d="M 100 20 A 80 80 0 0 1 180 100" fill="none" stroke="#22d3ee" strokeWidth="14" />
                <line
                  x1="100"
                  y1="100"
                  x2={100 + 66 * Math.cos((gaugeAngle * Math.PI) / 180)}
                  y2={100 + 66 * Math.sin((gaugeAngle * Math.PI) / 180)}
                  stroke={isSafe ? "#22d3ee" : "#ef4444"}
                  strokeWidth="4"
                />
                <circle cx="100" cy="100" r="6" fill="#e2e8f0" />
              </svg>
              <p className={`text-center text-lg font-semibold ${isSafe ? "text-cyan-300" : "text-red-400"}`}>
                SF {safetyFactor.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-center">
            <p className="text-xs text-slate-400">Calculated Life (N)</p>
            <p className="mt-3 text-lg font-semibold text-cyan-300">
              {cyclesFromSelected && cyclesFromSelected > 0 ? formatCycles(cyclesFromSelected) : "N/A"}
            </p>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-center">
            <p className="text-xs text-slate-400">Factor of Safety</p>
            <p className={`mt-3 text-2xl font-bold ${isSafe ? "text-cyan-300" : "text-red-400"}`}>
              {safetyFactor.toFixed(3)}
            </p>
            <p className="text-xs text-slate-500">Model: {results.selected_mean_stress_model}</p>
          </div>
        </CardContent>
      </Card>

      {/* Stress State */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Stress State</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-slate-800 p-3 text-center">
              <p className="text-xs text-slate-400">Stress Amplitude</p>
              <p className="mt-1 text-lg font-semibold text-cyan-400">
                {results.stress_amplitude.toFixed(1)} MPa
              </p>
            </div>
            <div className="rounded-lg bg-slate-800 p-3 text-center">
              <p className="text-xs text-slate-400">Mean Stress</p>
              <p className="mt-1 text-lg font-semibold text-blue-400">
                {results.mean_stress.toFixed(1)} MPa
              </p>
            </div>
            <div className="rounded-lg bg-slate-800 p-3 text-center">
              <p className="text-xs text-slate-400">Stress Ratio (R)</p>
              <p className="mt-1 text-lg font-semibold text-purple-400">
                {results.stress_ratio.toFixed(3)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modified Endurance Limit */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">
              Modified Endurance Limit
            </span>
            <span className="text-lg font-semibold text-amber-400">
              {results.modified_endurance_limit.toFixed(1)} MPa
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Cycles to Failure */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cycles to Failure</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {results.mean_stress_corrections.map((correction) => (
              <div
                key={correction.model_name}
                className="flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2"
              >
                <span className="text-sm text-slate-300">
                  {correction.model_name}
                </span>
                <span className="font-mono text-sm text-slate-100">
                  {formatCycles(results.cycles_to_failure[correction.model_name.toLowerCase()] ?? Number.NaN)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Safety Factors */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Safety Factors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {results.mean_stress_corrections.map((correction) => {
              const safe = correction.safety_factor > 1;
              return (
                <div
                  key={correction.model_name}
                  className="flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2"
                >
                  <span className="text-sm text-slate-300">
                    {correction.model_name}
                  </span>
                  <span
                    className={`font-mono text-sm font-semibold ${
                      safe ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {correction.safety_factor.toFixed(3)}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {results.notch_result && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Notch Sensitivity</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-800 p-3 text-center">
              <p className="text-xs text-slate-400">Model</p>
              <p className="mt-1 text-sm font-semibold text-cyan-300">{results.notch_result.model}</p>
            </div>
            <div className="rounded-lg bg-slate-800 p-3 text-center">
              <p className="text-xs text-slate-400">Kf</p>
              <p className="mt-1 text-sm font-semibold text-cyan-300">{results.notch_result.kf.toFixed(3)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {results.miner_damage && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Palmgren-Miner Damage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2">
              <span className="text-sm text-slate-300">Total Damage D</span>
              <span className={`font-mono ${results.miner_damage.is_failure ? "text-red-400" : "text-cyan-300"}`}>
                {results.miner_damage.total_damage.toFixed(4)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2">
              <span className="text-sm text-slate-300">Blocks to Failure</span>
              <span className="font-mono text-slate-100">
                {results.miner_damage.predicted_blocks_to_failure
                  ? results.miner_damage.predicted_blocks_to_failure.toFixed(3)
                  : "N/A"}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {results.basquin_fit && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Fitted Basquin Parameters</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-slate-800 p-3">
              <p className="text-xs text-slate-400">a</p>
              <p className="font-mono text-cyan-300">{results.basquin_fit.a.toExponential(3)}</p>
            </div>
            <div className="rounded-lg bg-slate-800 p-3">
              <p className="text-xs text-slate-400">b</p>
              <p className="font-mono text-cyan-300">{results.basquin_fit.b.toFixed(5)}</p>
            </div>
            <div className="rounded-lg bg-slate-800 p-3">
              <p className="text-xs text-slate-400">σ&apos;f</p>
              <p className="font-mono text-cyan-300">{results.basquin_fit.sigma_f_prime.toFixed(2)} MPa</p>
            </div>
            <div className="rounded-lg bg-slate-800 p-3">
              <p className="text-xs text-slate-400">R²</p>
              <p className="font-mono text-cyan-300">{results.basquin_fit.r_squared.toFixed(4)}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
