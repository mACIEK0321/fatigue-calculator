"use client";

import React from "react";
import { ArrowRight, Boxes, DatabaseZap, ShieldCheck, Sigma, Workflow } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const steps = [
  {
    id: "01",
    title: "Fusion 360 FEA",
    icon: Sigma,
    input: "Stress Tensor / Max Principal Stress",
    details: "Import nodal or element stress results exported from Fusion 360 simulation cases.",
  },
  {
    id: "02",
    title: "Material Mapping",
    icon: DatabaseZap,
    input: "User S-N Data / Marin Factors",
    details: "Map material constants to each load region and apply real-world endurance corrections.",
  },
  {
    id: "03",
    title: "Fatigue Solver",
    icon: Boxes,
    input: "Mean Stress Correction + Basquin Regression",
    details: "Run correction models and log-life fitting to convert stress amplitudes into fatigue life.",
  },
  {
    id: "04",
    title: "Life Prediction",
    icon: ShieldCheck,
    input: "Damage Map / Cycles to Failure",
    details: "Generate hotspot ranking, life contours, and critical cycle thresholds for design decisions.",
  },
];

export default function WorkflowComponent() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-cyan-300" /> Graphical Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-slate-300">
          <p className="text-sm text-slate-300">
            Stepper-style data flow from CAD/FEA outputs to validated fatigue life predictions.
          </p>

          <div className="grid gap-4 lg:grid-cols-4">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div key={step.id} className="relative rounded-xl border border-slate-700 bg-slate-900/60 p-4 shadow-[0_0_20px_rgba(34,211,238,0.08)]">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="rounded-full border border-cyan-700/70 bg-slate-950 px-2 py-0.5 text-xs font-semibold text-cyan-300">
                      Step {step.id}
                    </span>
                    <Icon className="h-4 w-4 text-cyan-300" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-100">{step.title}</h3>
                  <p className="mt-2 text-xs text-cyan-200">Input / Process: {step.input}</p>
                  <p className="mt-2 text-xs text-slate-400">{step.details}</p>

                  {idx < steps.length - 1 && (
                    <ArrowRight className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-cyan-300 lg:block" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
