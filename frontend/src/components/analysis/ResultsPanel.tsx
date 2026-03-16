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

  const goodmanResult = results.mean_stress_corrections.find(
    (r) => r.model.toLowerCase() === "goodman"
  );
  const isSafe = goodmanResult ? goodmanResult.safety_factor > 1 : false;

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
              Based on Goodman criterion (SF ={" "}
              {goodmanResult ? goodmanResult.safety_factor.toFixed(3) : "N/A"})
            </p>
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
                key={correction.model}
                className="flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2"
              >
                <span className="text-sm text-slate-300">
                  {correction.model}
                </span>
                <span className="font-mono text-sm text-slate-100">
                  {formatCycles(correction.cycles_to_failure)}
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
                  key={correction.model}
                  className="flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2"
                >
                  <span className="text-sm text-slate-300">
                    {correction.model}
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
    </div>
  );
}
