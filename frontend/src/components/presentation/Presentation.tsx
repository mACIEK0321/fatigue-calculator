"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { slides } from "./presentationData";
import { SlideRenderer } from "./SlideRenderer";

export default function Presentation() {
  const [current, setCurrent] = useState(0);
  const total = slides.length;

  const prev = useCallback(() => setCurrent((c) => Math.max(0, c - 1)), []);
  const next = useCallback(() => setCurrent((c) => Math.min(total - 1, c + 1)), [total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") next();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  const slide = slides[current];
  const progress = ((current + 1) / total) * 100;

  return (
    <div className="flex min-h-screen flex-col bg-[#f1f5f9]">
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-[#e2e8f0] bg-white shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#bfdbfe] bg-[#eff6ff]">
              <span className="text-xs font-black text-[#2563eb]">FC</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-[#0f172a] leading-none">
                Fatigue Calculator
              </span>
              <span className="text-[11px] text-[#94a3b8] leading-tight mt-0.5 hidden sm:block">
                {slide.title}
              </span>
            </div>
          </div>
          <span className="rounded-md bg-[#f8fafc] border border-[#e2e8f0] px-3 py-1 text-sm font-semibold tabular-nums text-[#475569]">
            {current + 1} / {total}
          </span>
        </div>
        {/* Progress bar */}
        <div className="mx-auto max-w-5xl px-6 pb-2.5">
          <div className="h-1.5 w-full rounded-full bg-[#e2e8f0]">
            <div
              className="h-1.5 rounded-full bg-[#2563eb] transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Slide area ──────────────────────────────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-5xl">
          <div
            className="rounded-2xl border border-[#e2e8f0] bg-white px-10 py-8 shadow-[0_2px_4px_rgba(15,23,42,0.04),0_12px_40px_rgba(15,23,42,0.08)]"
            style={{ minHeight: "560px" }}
          >
            <SlideRenderer slide={slide} />
          </div>
        </div>
      </div>

      {/* ── Bottom navigation ───────────────────────────────────────────────── */}
      <div className="border-t border-[#e2e8f0] bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          {/* Prev */}
          <Button
            variant="outline"
            size="sm"
            onClick={prev}
            disabled={current === 0}
            className="gap-1.5 min-w-[110px] justify-center"
          >
            <ChevronLeft className="h-4 w-4" />
            Poprzedni
          </Button>

          {/* Dot pager */}
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setCurrent(i)}
                title={s.title}
                className={cn(
                  "rounded-full transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]",
                  i === current
                    ? "h-3 w-3 bg-[#2563eb]"
                    : "h-2 w-2 bg-[#cbd5e1] hover:bg-[#64748b]"
                )}
              />
            ))}
          </div>

          {/* Next */}
          <Button
            variant={current === total - 1 ? "outline" : "default"}
            size="sm"
            onClick={next}
            disabled={current === total - 1}
            className="gap-1.5 min-w-[110px] justify-center"
          >
            Następny
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Keyboard hint */}
        <p className="mt-2 text-center text-[11px] text-[#cbd5e1]">
          ← → klawiatura
        </p>
      </div>
    </div>
  );
}
