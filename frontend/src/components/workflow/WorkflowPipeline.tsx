"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Box, Grid3X3, Zap, FileOutput, Activity, ArrowRight, ArrowDown } from "lucide-react";

interface WorkflowStep {
  icon: React.ReactNode;
  title: string;
  description: string;
  stepName: string;
}

const steps: WorkflowStep[] = [
  {
    icon: <Box className="h-8 w-8" />,
    title: "CAD Model",
    description: "Design in Fusion 360 or your preferred CAD tool. Define geometry, materials, and constraints.",
    stepName: "cad_model",
  },
  {
    icon: <Grid3X3 className="h-8 w-8" />,
    title: "Mesh Generation",
    description: "Create FEA mesh with appropriate element types and refinement for stress concentration areas.",
    stepName: "mesh_generation",
  },
  {
    icon: <Zap className="h-8 w-8" />,
    title: "Stress Analysis",
    description: "Run FEA simulation with applied loads, boundary conditions, and material properties.",
    stepName: "stress_analysis",
  },
  {
    icon: <FileOutput className="h-8 w-8" />,
    title: "Extract Results",
    description: "Identify maximum and minimum principal stresses from cyclic loading scenarios.",
    stepName: "extract_results",
  },
  {
    icon: <Activity className="h-8 w-8" />,
    title: "FatigueSim Pro",
    description: "Input extracted stress values for fatigue life prediction using multiple mean stress models.",
    stepName: "fatigue_sim",
  },
];

export default function WorkflowPipeline() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">
          Engineering Workflow Pipeline
        </h2>
        <p className="mt-2 text-slate-400">
          From CAD design to fatigue life prediction -- a complete engineering analysis workflow
        </p>
      </div>

      {/* Desktop: horizontal layout */}
      <div className="hidden lg:flex lg:items-start lg:justify-center lg:gap-2">
        {steps.map((step, index) => (
          <React.Fragment key={step.stepName}>
            <div className="flex w-52 flex-col items-center">
              <Card className="w-full border-slate-600 bg-gradient-to-b from-slate-800 to-slate-900 transition-all hover:border-blue-500 hover:shadow-blue-500/10 hover:shadow-lg">
                <CardContent className="flex flex-col items-center p-5 text-center">
                  <div className="mb-3 rounded-full bg-blue-600/20 p-3 text-blue-400">
                    {step.icon}
                  </div>
                  <span className="mb-1 text-xs font-medium text-blue-400">
                    Step {index + 1}
                  </span>
                  <h3 className="mb-2 text-sm font-semibold text-white">
                    {step.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-slate-400">
                    {step.description}
                  </p>
                  <div className="mt-3 w-full rounded bg-slate-700/50 px-2 py-4 text-xs text-slate-500 italic">
                    [Image: {step.stepName}]
                  </div>
                </CardContent>
              </Card>
            </div>
            {index < steps.length - 1 && (
              <div className="flex h-40 items-center">
                <ArrowRight className="h-6 w-6 text-blue-500" />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Mobile: vertical layout */}
      <div className="flex flex-col items-center gap-2 lg:hidden">
        {steps.map((step, index) => (
          <React.Fragment key={step.stepName}>
            <Card className="w-full max-w-sm border-slate-600 bg-gradient-to-b from-slate-800 to-slate-900 transition-all hover:border-blue-500">
              <CardContent className="flex flex-col items-center p-5 text-center">
                <div className="mb-3 rounded-full bg-blue-600/20 p-3 text-blue-400">
                  {step.icon}
                </div>
                <span className="mb-1 text-xs font-medium text-blue-400">
                  Step {index + 1}
                </span>
                <h3 className="mb-2 text-sm font-semibold text-white">
                  {step.title}
                </h3>
                <p className="text-xs leading-relaxed text-slate-400">
                  {step.description}
                </p>
                <div className="mt-3 w-full rounded bg-slate-700/50 px-2 py-4 text-xs text-slate-500 italic">
                  [Image: {step.stepName}]
                </div>
              </CardContent>
            </Card>
            {index < steps.length - 1 && (
              <ArrowDown className="h-6 w-6 text-blue-500" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
