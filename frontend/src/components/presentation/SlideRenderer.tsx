"use client";

import { cn } from "@/lib/utils";
import type { Slide, SlideBadge, PromptAnatomySection } from "./presentationData";

// ─── Badge ────────────────────────────────────────────────────────────────────
const BADGE_COLORS: Record<SlideBadge, string> = {
  "Wstep":        "bg-[#eff6ff] text-[#2563eb] border-[#bfdbfe]",
  "Problem":      "bg-[#fef2f2] text-[#dc2626] border-[#fecaca]",
  "Teoria":       "bg-[#f0fdf4] text-[#16a34a] border-[#bbf7d0]",
  "Pipeline":     "bg-[#eff6ff] text-[#2563eb] border-[#bfdbfe]",
  "Architektura": "bg-[#faf5ff] text-[#7c3aed] border-[#ddd6fe]",
  "Proces":       "bg-[#eff6ff] text-[#2563eb] border-[#bfdbfe]",
  "Modele AI":    "bg-[#fff7ed] text-[#ea580c] border-[#fed7aa]",
  "Prompty":      "bg-[#0f172a] text-[#94a3b8] border-[#334155]",
  "Problemy":     "bg-[#fef2f2] text-[#dc2626] border-[#fecaca]",
  "Stan":         "bg-[#f0fdf4] text-[#16a34a] border-[#bbf7d0]",
  "Wnioski":      "bg-[#eff6ff] text-[#2563eb] border-[#bfdbfe]",
};

const BADGE_LABELS: Record<SlideBadge, string> = {
  "Wstep":        "Wstęp",
  "Problem":      "Problem",
  "Teoria":       "Teoria",
  "Pipeline":     "Pipeline",
  "Architektura": "Architektura",
  "Proces":       "Proces",
  "Modele AI":    "Modele AI",
  "Prompty":      "Prompty",
  "Problemy":     "Problemy",
  "Stan":         "Stan",
  "Wnioski":      "Wnioski",
};

function Badge({ badge }: { badge?: SlideBadge }) {
  if (!badge) return null;
  return (
    <span
      className={cn(
        "inline-block rounded-md border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-widest",
        BADGE_COLORS[badge]
      )}
    >
      {BADGE_LABELS[badge]}
    </span>
  );
}

// ─── Shared slide header ──────────────────────────────────────────────────────
function SlideHeader({ slide }: { slide: Slide }) {
  return (
    <div className="flex flex-col gap-2 border-b border-[#e2e8f0] pb-4">
      <Badge badge={slide.badge} />
      <h2 className="text-3xl font-bold tracking-tight text-[#0f172a] leading-tight">
        {slide.title}
      </h2>
      {slide.subtitle && (
        <p className="text-base text-[#475569]">{slide.subtitle}</p>
      )}
    </div>
  );
}

// ─── Title slide ──────────────────────────────────────────────────────────────
function TitleSlide({ slide }: { slide: Slide }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-[#bfdbfe] bg-[#eff6ff] shadow-sm">
        <span className="text-3xl font-black text-[#2563eb]">FC</span>
      </div>
      <div className="space-y-4 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#2563eb]">
          {slide.note}
        </p>
        <h1 className="text-5xl font-black tracking-tight text-[#0f172a] sm:text-6xl">
          {slide.title}
        </h1>
        <p className="mx-auto text-xl leading-relaxed text-[#475569]">
          {slide.subtitle}
        </p>
      </div>
    </div>
  );
}

// ─── Bullets slide ────────────────────────────────────────────────────────────
function BulletsSlide({ slide }: { slide: Slide }) {
  return (
    <div className="flex h-full flex-col gap-5">
      <SlideHeader slide={slide} />
      <ul className="flex flex-col gap-4 overflow-y-auto">
        {slide.bullets?.map((bullet, i) => (
          <li key={i} className="flex flex-col gap-1.5">
            <div className="flex items-start gap-3">
              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#2563eb]" />
              <span className="text-[16px] font-medium leading-6 text-[#1e293b]">
                {bullet.text}
              </span>
            </div>
            {bullet.sub && (
              <ul className="ml-5 flex flex-col gap-1.5 pl-3 border-l border-[#e2e8f0]">
                {bullet.sub.map((s, j) => (
                  <li key={j} className="flex items-start gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#94a3b8]" />
                    <span className="text-sm leading-6 text-[#475569]">{s}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Pipeline slide ───────────────────────────────────────────────────────────
function PipelineSlide({ slide }: { slide: Slide }) {
  const steps = slide.pipeline ?? [];
  return (
    <div className="flex h-full flex-col gap-5">
      <SlideHeader slide={slide} />
      <div className="flex flex-col gap-0 overflow-y-auto">
        {steps.map((step, i) => (
          <div key={i} className="flex items-stretch gap-4">
            <div className="flex flex-col items-center">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2563eb] text-sm font-bold text-white shadow-sm">
                {i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className="w-px flex-1 bg-[#bfdbfe]" style={{ minHeight: "1.75rem" }} />
              )}
            </div>
            <div className={cn("pb-4", i === steps.length - 1 && "pb-0")}>
              <p className="text-base font-semibold text-[#0f172a]">{step.label}</p>
              {step.detail && (
                <p className="mt-0.5 text-sm leading-5 text-[#475569]">{step.detail}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Prompt slide ─────────────────────────────────────────────────────────────
function PromptSlide({ slide }: { slide: Slide }) {
  const p = slide.prompt!;
  const isWarning = p.variant === "warning";
  return (
    <div className="flex h-full flex-col gap-5">
      <SlideHeader slide={slide} />
      <div
        className={cn(
          "flex flex-1 flex-col gap-3 rounded-xl border overflow-hidden",
          isWarning ? "border-[#fca5a5] bg-[#fff1f2]" : "border-[#1e293b] bg-[#0f172a]"
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2 border-b px-4 py-2.5",
            isWarning ? "border-[#fca5a5] bg-[#fee2e2]" : "border-[#1e293b] bg-[#1e293b]"
          )}
        >
          <div className="flex gap-1.5">
            <span className={cn("h-3 w-3 rounded-full", isWarning ? "bg-[#fca5a5]" : "bg-[#ef4444]")} />
            <span className={cn("h-3 w-3 rounded-full", isWarning ? "bg-[#fcd34d]" : "bg-[#f59e0b]")} />
            <span className={cn("h-3 w-3 rounded-full", isWarning ? "bg-[#86efac]" : "bg-[#22c55e]")} />
          </div>
          <span
            className={cn(
              "ml-2 text-xs font-semibold uppercase tracking-widest",
              isWarning ? "text-[#dc2626]" : "text-[#64748b]"
            )}
          >
            {p.label}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-4">
          <pre className={cn(
            "whitespace-pre-wrap font-mono text-[13px] leading-6",
            isWarning ? "text-[#1e293b]" : "text-[#e2e8f0]"
          )}>
            {p.code}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ─── Prompt anatomy slide ─────────────────────────────────────────────────────

const KIND_META = {
  analityczny: {
    accent: "#2563eb",
    accentBg: "#eff6ff",
    accentBorder: "#bfdbfe",
    accentText: "#1d4ed8",
    tag: "TYPE 1 / 3",
  },
  wykonawczy: {
    accent: "#7c3aed",
    accentBg: "#faf5ff",
    accentBorder: "#ddd6fe",
    accentText: "#6d28d9",
    tag: "TYPE 2 / 3",
  },
  naprawczy: {
    accent: "#dc2626",
    accentBg: "#fef2f2",
    accentBorder: "#fecaca",
    accentText: "#b91c1c",
    tag: "TYPE 3 / 3",
  },
} as const;

const SECTION_ICONS: Record<string, string> = {
  "Opis problemu": "01",
  "Kontekst": "02",
  "Ograniczenia": "03",
  "Oczekiwany rezultat": "04",
  "Wskazanie pliku": "01",
  "Sygnatura i typy": "02",
  "Wymagania brzegowe": "03",
  "Zakaz modyfikacji": "04",
  "Objaw bledu": "01",
  "Kontekst lokalizacji": "02",
  "Oczekiwane zachowanie": "03",
  "Regresja": "04",
};

function AnatomySection({ section, accent }: { section: PromptAnatomySection; accent: string }) {
  const num = SECTION_ICONS[section.label] ?? "—";
  return (
    <div className="flex items-start gap-3">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-black text-white"
        style={{ backgroundColor: accent }}
      >
        {num}
      </span>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-[#0f172a]">{section.label}</p>
        <p className="text-xs leading-5 text-[#475569]">{section.value}</p>
      </div>
    </div>
  );
}

function PromptAnatomySlide({ slide }: { slide: Slide }) {
  const a = slide.promptAnatomy!;
  const meta = KIND_META[a.kind];

  return (
    <div className="flex h-full flex-col gap-4">
      <SlideHeader slide={slide} />

      {/* Purpose + when strip */}
      <div
        className="rounded-lg border px-4 py-2.5 text-sm leading-5"
        style={{
          backgroundColor: meta.accentBg,
          borderColor: meta.accentBorder,
          color: meta.accentText,
        }}
      >
        <span className="font-semibold">Po co:</span> {a.purpose}
        <span className="ml-3 font-semibold">Kiedy:</span> {a.when}
      </div>

      {/* Main body: structure (left) + code (right) */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Left: anatomy */}
        <div
          className="flex w-[42%] shrink-0 flex-col gap-3 rounded-xl border p-4"
          style={{ borderColor: meta.accentBorder, backgroundColor: meta.accentBg }}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: meta.accent }}>
              Struktura
            </p>
            <span
              className="rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold"
              style={{ borderColor: meta.accentBorder, color: meta.accent }}
            >
              {meta.tag}
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {a.sections.map((s, i) => (
              <AnatomySection key={i} section={s} accent={meta.accent} />
            ))}
          </div>
        </div>

        {/* Right: example prompt */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-[#1e293b] bg-[#0f172a]">
          <div className="flex items-center gap-2 border-b border-[#1e293b] bg-[#1e293b] px-4 py-2">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
            </div>
            <span className="ml-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-[#64748b]">
              przyklad
            </span>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <pre className="whitespace-pre-wrap font-mono text-[11.5px] leading-[1.65] text-[#e2e8f0]">
              {a.example}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Comparison slide ─────────────────────────────────────────────────────────
function ComparisonSlide({ slide }: { slide: Slide }) {
  return (
    <div className="flex h-full flex-col gap-5">
      <SlideHeader slide={slide} />
      {slide.intro && (
        <p className="text-sm leading-6 text-[#475569] italic border-l-4 border-[#2563eb] bg-[#eff6ff] px-4 py-2 rounded-r-lg">
          {slide.intro}
        </p>
      )}
      <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto sm:grid-cols-2">
        {slide.columns?.map((col, i) => (
          <div
            key={i}
            className={cn(
              "flex flex-col gap-3 rounded-xl border p-5",
              i === 0 ? "border-[#bfdbfe] bg-[#eff6ff]" : "border-[#ddd6fe] bg-[#faf5ff]"
            )}
          >
            <p className={cn(
              "text-xs font-bold uppercase tracking-widest",
              i === 0 ? "text-[#2563eb]" : "text-[#7c3aed]"
            )}>
              {col.heading}
            </p>
            <ul className="flex flex-col gap-2">
              {col.items.map((item, j) => (
                <li key={j} className="flex items-start gap-2">
                  <span className={cn(
                    "mt-2 h-1.5 w-1.5 shrink-0 rounded-full",
                    i === 0 ? "bg-[#2563eb]" : "bg-[#7c3aed]"
                  )} />
                  <span className="text-sm leading-6 text-[#1e293b]">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Status slide ─────────────────────────────────────────────────────────────
function StatusSlide({ slide }: { slide: Slide }) {
  return (
    <div className="flex h-full flex-col gap-5">
      <SlideHeader slide={slide} />
      <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto sm:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] p-5">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#16a34a]" />
            <p className="text-xs font-bold uppercase tracking-widest text-[#16a34a]">Gotowe</p>
          </div>
          <ul className="flex flex-col gap-2">
            {slide.statusDone?.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-sm font-bold text-[#16a34a]">&#10003;</span>
                <span className="text-sm leading-5 text-[#1e293b]">{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-3 rounded-xl border border-[#fed7aa] bg-[#fff7ed] p-5">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ea580c]" />
            <p className="text-xs font-bold uppercase tracking-widest text-[#ea580c]">W toku / MVP</p>
          </div>
          <ul className="flex flex-col gap-2">
            {slide.statusPending?.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-sm text-[#ea580c]">&#8594;</span>
                <span className="text-sm leading-5 text-[#1e293b]">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ─── Conclusions slide ────────────────────────────────────────────────────────
function ConclusionsSlide({ slide }: { slide: Slide }) {
  return (
    <div className="flex h-full flex-col gap-5">
      <SlideHeader slide={slide} />
      <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto sm:grid-cols-2">
        {slide.conclusions?.map((c, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-5 hover:border-[#bfdbfe] hover:bg-[#eff6ff] transition-colors duration-150"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2563eb] text-xs font-bold text-white">
                {i + 1}
              </span>
              <p className="text-sm font-bold text-[#0f172a]">{c.heading}</p>
            </div>
            <p className="pl-8 text-sm leading-6 text-[#475569]">{c.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main renderer ────────────────────────────────────────────────────────────
export function SlideRenderer({ slide }: { slide: Slide }) {
  switch (slide.type) {
    case "title":
      return <TitleSlide slide={slide} />;
    case "bullets":
      return <BulletsSlide slide={slide} />;
    case "pipeline":
      return <PipelineSlide slide={slide} />;
    case "prompt":
      return <PromptSlide slide={slide} />;
    case "prompt-anatomy":
      return <PromptAnatomySlide slide={slide} />;
    case "comparison":
      return <ComparisonSlide slide={slide} />;
    case "status":
      return <StatusSlide slide={slide} />;
    case "conclusions":
      return <ConclusionsSlide slide={slide} />;
    default:
      return <BulletsSlide slide={slide} />;
  }
}
