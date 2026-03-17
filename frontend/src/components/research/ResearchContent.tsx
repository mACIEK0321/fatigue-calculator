"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3 font-mono text-sm text-cyan-300">
      {children}
    </div>
  );
}

const meanStressModels = [
  {
    model: "Goodman",
    relation: "$$\\frac{S_a}{S_e} + \\frac{S_m}{S_{ut}} = 1$$",
    bestFor: "General design screening and conservative baseline for mixed loading.",
    materialFit: "Works well for brittle or mixed-behavior materials where tensile mean stress is critical.",
  },
  {
    model: "Gerber",
    relation: "$$\\frac{S_a}{S_e} + \\left(\\frac{S_m}{S_{ut}}\\right)^2 = 1$$",
    bestFor: "Detailed life assessment of ductile metals when plastic reserve exists.",
    materialFit: "Typically preferred for ductile steels/aluminum where parabola better matches test data.",
  },
  {
    model: "Soderberg",
    relation: "$$\\frac{S_a}{S_e} + \\frac{S_m}{S_y} = 1$$",
    bestFor: "Safety-critical design, early concept sizing, and code-driven conservative checks.",
    materialFit: "Most conservative; suitable when yield avoidance is mandatory.",
  },
];

const marinFactors = [
  {
    factor: "$k_a$",
    name: "Surface finish factor",
    description:
      "Captures notch-scale roughness effects. Polished specimens retain higher endurance than as-forged surfaces due to delayed crack initiation.",
  },
  {
    factor: "$k_b$",
    name: "Size factor",
    description:
      "Adjusts for stress-gradient and volume effects. Larger loaded volumes have higher defect probability and reduced fatigue strength.",
  },
  {
    factor: "$k_c$",
    name: "Load factor",
    description:
      "Accounts for loading mode sensitivity (bending, axial, torsion). Shear-dominant states generally reduce equivalent endurance.",
  },
  {
    factor: "$k_d$",
    name: "Temperature factor",
    description:
      "Corrects endurance for elevated operating temperatures that degrade microstructural resistance and cyclic strength.",
  },
  {
    factor: "$k_e$",
    name: "Reliability factor",
    description:
      "Converts median material data to a target survival probability (e.g., 90%, 95%, 99%), tightening allowable stress.",
  },
];

export default function ResearchContent() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Physics of Failure — Research &amp; Theory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-slate-300">
          <p>
            Fatigue is a cumulative damage mechanism driven by cyclic stress amplitudes, mean stress bias, and microstructural defects.
            In engineering workflows, the objective is to map finite-element stress states into experimentally calibrated life curves.
          </p>
          <Formula>{"$$S_a = \\sigma_f'(2N_f)^b$$"}</Formula>
          <Formula>{"$$S_e = k_a k_b k_c k_d k_e S_e'$$"}</Formula>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>1) S-N Curve: LCF → HCF Transition</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-slate-300">
          <p>
            The stress-life (S-N) curve links alternating stress amplitude $S_a$ to cycles to failure $N_f$. In the low-cycle fatigue (LCF)
            regime (roughly below $10^4$–$10^5$ cycles), local plasticity dominates and Coffin-Manson strain terms are significant. In high-cycle
            fatigue (HCF), behavior is predominantly elastic and Basquin scaling becomes the governing approximation.
          </p>
          <Formula>{"$$S_a = \\sigma_f'(2N_f)^b, \\quad N_f \\gtrsim 10^4$$"}</Formula>
          <p>
            For many ferrous alloys, a practical endurance limit $S_e$ exists near $10^6$–$10^7$ cycles, below which infinite-life design is often
            assumed after safety and Marin corrections. Non-ferrous alloys (e.g., aluminum) usually do <span className="font-semibold text-amber-300">not</span> exhibit a strict
            fatigue limit; the curve continues to decline with log-cycle count, so finite-life design should be used across the full mission spectrum.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2) Mean Stress Effects — Goodman vs Gerber vs Soderberg</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-slate-300">
          <p>
            Mean stress shifts fatigue capacity because tensile bias accelerates crack opening, while compressive bias can retard growth.
            The following correction models are commonly used in CAE fatigue post-processing.
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="min-w-full divide-y divide-slate-700 text-sm">
              <thead className="bg-slate-900 text-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left">Model</th>
                  <th className="px-3 py-2 text-left">Equation</th>
                  <th className="px-3 py-2 text-left">When to Use</th>
                  <th className="px-3 py-2 text-left">Material Tendency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-950/40">
                {meanStressModels.map((item) => (
                  <tr key={item.model}>
                    <td className="px-3 py-3 font-semibold text-cyan-300">{item.model}</td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-300">{item.relation}</td>
                    <td className="px-3 py-3">{item.bestFor}</td>
                    <td className="px-3 py-3">{item.materialFit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3) Marin Factors ($k_a$ to $k_e$)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-slate-300">
          <p>
            Marin modifiers transform laboratory endurance limits into field-relevant design allowables for real geometry, finish, loading, and reliability.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {marinFactors.map((item) => (
              <div key={item.factor} className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
                <p className="text-sm font-semibold text-cyan-300">
                  {item.factor} — {item.name}
                </p>
                <p className="mt-2 text-sm text-slate-300">{item.description}</p>
              </div>
            ))}
          </div>
          <Formula>{"$$S_{e,design} = k_a k_b k_c k_d k_e S_e'$$"}</Formula>
        </CardContent>
      </Card>
    </div>
  );
}
