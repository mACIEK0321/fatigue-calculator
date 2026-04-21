"use client";

import Link from "next/link";
import { Activity, ArrowRight, PresentationIcon } from "lucide-react";
import AnalysisEngine from "@/components/analysis/AnalysisEngine";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f8fafc]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="mb-8 rounded-[28px] border border-[#e2e8f0] bg-white px-6 py-6 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_16px_48px_rgba(15,23,42,0.06)] sm:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#bfdbfe] bg-[#eff6ff]">
                <Activity className="h-6 w-6 text-[#2563eb]" />
              </div>
              <div className="space-y-2">
                <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-[#2563eb]">
                  Fatigue analysis workspace
                </p>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-[#0f172a] sm:text-3xl">
                    Fatigue life analysis
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[#475569] sm:text-[15px]">
                    Configure material data, choose the S-N model, define
                    loading, then review life, safety factor and chart outputs
                    in one view.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-sm text-[#475569]">
                <span>Input</span>
                <ArrowRight className="h-4 w-4 text-[#94a3b8]" />
                <span>Results</span>
                <ArrowRight className="h-4 w-4 text-[#94a3b8]" />
                <span>Charts</span>
              </div>
              <Link
                href="/presentation"
                className="flex items-center gap-1.5 rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-3 py-1.5 text-xs font-medium text-[#2563eb] transition-colors hover:bg-[#dbeafe]"
              >
                <PresentationIcon className="h-3.5 w-3.5" />
                Prezentacja projektu
              </Link>
            </div>
          </div>
        </header>

        <AnalysisEngine />
      </div>
    </main>
  );
}
