"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3 font-mono text-sm text-cyan-300">
      {children}
    </div>
  );
}

export default function ResearchContent() {
  const [deltaSigma, setDeltaSigma] = useState(120);
  const [crackLengthMm, setCrackLengthMm] = useState(2);

  const crackMetrics = useMemo(() => {
    const cParis = 1e-11;
    const mParis = 3.1;
    const yGeom = 1.12;
    const aMeters = crackLengthMm / 1000;
    const deltaK = yGeom * deltaSigma * Math.sqrt(Math.PI * aMeters);
    const daDn = cParis * deltaK ** mParis;
    const severity = deltaK < 12 ? "Stable" : deltaK < 24 ? "Warning" : "Rapid Growth";

    return { deltaK, daDn, severity };
  }, [deltaSigma, crackLengthMm]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Research & Problem Definition</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-slate-300">
          <p>
            Fatigue failure is progressive and local: cyclic loading initiates micro-cracks, then cracks propagate until unstable fracture.
            The goal of FatigueMaster Pro is to connect FEA stress extraction with physics-based life estimates.
          </p>
          <Formula>{"$$ S_a = \\sigma_f' (2N_f)^b $$"}</Formula>
          <Formula>{"$$ \\frac{S_a}{S_e} + \\frac{S_m}{S_{ut}} = 1 \\;\\; (\\text{Goodman}) $$"}</Formula>
          <Formula>{"$$ S_e = k_a k_b k_c k_d k_e S_e' $$"}</Formula>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mean Stress Models</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 text-sm text-slate-300">
          <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
            <p className="font-semibold text-cyan-300">Goodman</p>
            <Formula>{"$$ \\frac{S_a}{S_e} + \\frac{S_m}{S_{ut}} = 1 $$"}</Formula>
            <p>Linear, robust for design screening.</p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
            <p className="font-semibold text-emerald-300">Gerber</p>
            <Formula>{"$$ \\frac{S_a}{S_e} + \\left(\\frac{S_m}{S_{ut}}\\right)^2 = 1 $$"}</Formula>
            <p>Parabolic, often less conservative for ductile alloys.</p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
            <p className="font-semibold text-amber-300">Soderberg</p>
            <Formula>{"$$ \\frac{S_a}{S_e} + \\frac{S_m}{S_y} = 1 $$"}</Formula>
            <p>Most conservative, limits by yield-based boundary.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Interactive What-If: Crack Propagation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-slate-300">
          <p>
            Explore sensitivity using Paris law. Increase stress range or initial crack size to see the growth-rate acceleration.
          </p>
          <Formula>{"$$ \\frac{da}{dN} = C(\\Delta K)^m, \\quad \\Delta K = Y\\Delta\\sigma\\sqrt{\\pi a} $$"}</Formula>

          <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-900/60 p-4">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                <span>Stress Range Δσ (MPa)</span>
                <span>{deltaSigma.toFixed(0)} MPa</span>
              </div>
              <Slider
                value={[deltaSigma]}
                min={20}
                max={400}
                step={1}
                onValueChange={(value) => setDeltaSigma(value[0])}
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                <span>Initial Crack Length a (mm)</span>
                <span>{crackLengthMm.toFixed(2)} mm</span>
              </div>
              <Slider
                value={[crackLengthMm]}
                min={0.2}
                max={10}
                step={0.1}
                onValueChange={(value) => setCrackLengthMm(value[0])}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-center">
              <p className="text-xs text-slate-400">ΔK (MPa√m)</p>
              <p className="mt-1 text-lg font-semibold text-cyan-300">{crackMetrics.deltaK.toFixed(2)}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-center">
              <p className="text-xs text-slate-400">da/dN (m/cycle)</p>
              <p className="mt-1 text-lg font-semibold text-cyan-300">{crackMetrics.daDn.toExponential(2)}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-center">
              <p className="text-xs text-slate-400">Regime</p>
              <p className={`mt-1 text-lg font-semibold ${crackMetrics.severity === "Rapid Growth" ? "text-red-400" : crackMetrics.severity === "Warning" ? "text-amber-400" : "text-cyan-300"}`}>
                {crackMetrics.severity}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
