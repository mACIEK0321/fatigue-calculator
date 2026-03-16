"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const steps = [
  "Fusion 360 Export",
  "Stress Tensor",
  "FatigueMaster Mapping",
  "Life Prediction",
];

export default function WorkflowPipeline() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Workflow Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-300">
            Engineering data path from CAD/FEA output to fatigue life estimation.
          </p>
          <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-4">
            <svg viewBox="0 0 1200 260" className="w-full" role="img" aria-label="Fatigue workflow pipeline infographic">
              <defs>
                <linearGradient id="nodeFill" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#0f172a" />
                  <stop offset="100%" stopColor="#1e293b" />
                </linearGradient>
                <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill="#38bdf8" />
                </marker>
              </defs>

              {steps.map((step, index) => {
                const x = 40 + index * 290;
                return (
                  <g key={step}>
                    <rect x={x} y={70} width={230} height={120} rx={14} fill="url(#nodeFill)" stroke="#334155" strokeWidth="2" />
                    <text x={x + 115} y={118} textAnchor="middle" fill="#e2e8f0" fontSize="20" fontWeight="600">
                      {step}
                    </text>
                    <text x={x + 115} y={150} textAnchor="middle" fill="#7dd3fc" fontSize="14">
                      Step {index + 1}
                    </text>
                  </g>
                );
              })}

              <line x1="270" y1="130" x2="330" y2="130" stroke="#38bdf8" strokeWidth="4" markerEnd="url(#arrow)" />
              <line x1="560" y1="130" x2="620" y2="130" stroke="#38bdf8" strokeWidth="4" markerEnd="url(#arrow)" />
              <line x1="850" y1="130" x2="910" y2="130" stroke="#38bdf8" strokeWidth="4" markerEnd="url(#arrow)" />
            </svg>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
