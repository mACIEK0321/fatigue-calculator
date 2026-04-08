"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";
import SNInteractiveInput from "./SNInteractiveInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getMaterialPresets } from "@/lib/api";
import {
  buildFatigueAnalysisRequest,
  sanitizePoints,
} from "@/lib/analysis-request";
import type {
  FatigueAnalysisRequest,
  LoadingBlock,
  MarinFactors,
  MaterialPreset,
  MaterialProperties,
  MeanStressModel,
  NotchSensitivityInput,
  SNCurveSourceMode,
  SNFitPoint,
  SurfaceFactorMode,
  SurfaceFinishType,
} from "@/types/fatigue";

interface MaterialFormProps {
  onSubmit: (request: FatigueAnalysisRequest) => void;
  isLoading: boolean;
  snCurveSourceMode: SNCurveSourceMode;
  onSNCurveSourceModeChange: (mode: SNCurveSourceMode) => void;
  snPoints: SNFitPoint[];
  onSNPointsChange: (points: SNFitPoint[]) => void;
}

const defaultMaterial: MaterialProperties = {
  uts: 400,
  yield_strength: 250,
  endurance_limit: 200,
  elastic_modulus: 210,
  fatigue_strength_coefficient: 900,
  fatigue_strength_exponent: -0.106,
  fatigue_ductility_coefficient: 0.58,
  fatigue_ductility_exponent: -0.58,
};

const defaultMarinFactors: MarinFactors = {
  size_factor: 1,
  load_factor: 1,
  temperature_factor: 1,
  reliability_factor: 1,
};

const defaultNotch: NotchSensitivityInput = {
  model: "neuber",
  kt: 1,
  notch_radius_mm: 1,
  notch_constant_mm: 0.25,
};

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 border-t border-[#e2e8f0] pt-6 first:border-t-0 first:pt-0">
      <div className="space-y-1">
        <h3 className="text-[17px] font-semibold text-[#0f172a]">{title}</h3>
        {description ? (
          <p className="text-sm leading-6 text-[#475569]">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function NumericField({
  label,
  unit,
  value,
  onChange,
  placeholder,
  step = "any",
  min,
}: {
  label: string;
  unit?: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  step?: string;
  min?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="relative">
        <Input
          type="number"
          step={step}
          min={min}
          value={value}
          placeholder={placeholder}
          className={unit ? "pr-20" : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        {unit ? (
          <span className="pointer-events-none absolute inset-y-1 right-1 flex items-center rounded-lg bg-[#f8fafc] px-2 text-[11px] font-semibold text-[#475569]">
            {unit}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function LoadingBlockRow({
  block,
  index,
  onChange,
  onRemove,
}: {
  block: LoadingBlock;
  index: number;
  onChange: (index: number, field: keyof LoadingBlock, value: string) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 rounded-2xl border border-[#e2e8f0] bg-white p-3 md:grid-cols-[1fr_1fr_1fr_110px_48px]">
      <NumericField
        label="Max stress"
        unit="MPa"
        value={block.max_stress}
        placeholder="e.g. 320"
        onChange={(value) => onChange(index, "max_stress", value)}
      />
      <NumericField
        label="Min stress"
        unit="MPa"
        value={block.min_stress}
        placeholder="e.g. -20"
        onChange={(value) => onChange(index, "min_stress", value)}
      />
      <NumericField
        label="Cycles"
        value={block.cycles}
        placeholder="e.g. 2e5"
        onChange={(value) => onChange(index, "cycles", value)}
      />
      <NumericField
        label="Repeats"
        value={block.repeats}
        step="1"
        min="1"
        placeholder="e.g. 1"
        onChange={(value) => onChange(index, "repeats", value)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="self-end md:self-center"
        onClick={() => onRemove(index)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function MaterialForm({
  onSubmit,
  isLoading,
  snCurveSourceMode,
  onSNCurveSourceModeChange,
  snPoints,
  onSNPointsChange,
}: MaterialFormProps) {
  const [presets, setPresets] = useState<MaterialPreset[]>([]);
  const [material, setMaterial] = useState<MaterialProperties>(defaultMaterial);
  const [surfaceFactorMode, setSurfaceFactorMode] =
    useState<SurfaceFactorMode>("empirical_surface_finish");
  const [surfaceFinish, setSurfaceFinish] =
    useState<SurfaceFinishType>("machined");
  const [manualSurfaceFactor, setManualSurfaceFactor] = useState(0.85);
  const [marinFactors, setMarinFactors] =
    useState<MarinFactors>(defaultMarinFactors);
  const [selectedModel, setSelectedModel] =
    useState<MeanStressModel>("goodman");
  const [maxStress, setMaxStress] = useState(300);
  const [minStress, setMinStress] = useState(-100);
  const [useNotch, setUseNotch] = useState(false);
  const [notch, setNotch] = useState<NotchSensitivityInput>(defaultNotch);
  const [loadingBlocks, setLoadingBlocks] = useState<LoadingBlock[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    getMaterialPresets()
      .then(setPresets)
      .catch(() => {
        setPresets([]);
      });
  }, []);

  const validSNPoints = useMemo(() => sanitizePoints(snPoints), [snPoints]);

  const handlePresetChange = (presetName: string) => {
    const preset = presets.find((item) => item.name === presetName);
    if (!preset) {
      return;
    }

    setMaterial({
      uts: preset.uts,
      yield_strength: preset.yield_strength,
      endurance_limit: preset.endurance_limit ?? undefined,
      elastic_modulus: preset.elastic_modulus,
      fatigue_strength_coefficient: preset.fatigue_strength_coefficient,
      fatigue_strength_exponent: preset.fatigue_strength_exponent,
      fatigue_ductility_coefficient: preset.fatigue_ductility_coefficient,
      fatigue_ductility_exponent: preset.fatigue_ductility_exponent,
    });
  };

  const updateMaterialNumber = (
    field: keyof MaterialProperties,
    value: string,
    allowEmpty = false
  ) => {
    if (allowEmpty && value.trim() === "") {
      setMaterial((current) => ({ ...current, [field]: undefined }));
      return;
    }

    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return;
    }

    setMaterial((current) => ({ ...current, [field]: parsed }));
  };

  const updateMarinFactor = (field: keyof MarinFactors, value: string) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return;
    }

    setMarinFactors((current) => ({ ...current, [field]: parsed }));
  };

  const updateNotch = (
    field: keyof NotchSensitivityInput,
    value: string | NotchSensitivityInput["model"]
  ) => {
    if (field === "model") {
      setNotch((current) => ({
        ...current,
        model: value as NotchSensitivityInput["model"],
      }));
      return;
    }

    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return;
    }

    setNotch((current) => ({ ...current, [field]: parsed }));
  };

  const addLoadingBlock = () => {
    setLoadingBlocks((current) => [
      ...current,
      { max_stress: maxStress, min_stress: minStress, cycles: 1e5, repeats: 1 },
    ]);
  };

  const updateLoadingBlock = (
    index: number,
    field: keyof LoadingBlock,
    value: string
  ) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return;
    }

    setLoadingBlocks((current) =>
      current.map((block, blockIndex) =>
        blockIndex === index
          ? {
              ...block,
              [field]:
                field === "repeats" ? Math.max(1, Math.round(parsed)) : parsed,
            }
          : block
      )
    );
  };

  const removeLoadingBlock = (index: number) => {
    setLoadingBlocks((current) =>
      current.filter((_, blockIndex) => blockIndex !== index)
    );
  };

  const validate = (): string | null => {
    if (material.uts <= 0 || material.yield_strength <= 0) {
      return "UTS and yield strength must be positive.";
    }
    if (material.yield_strength > material.uts) {
      return "Yield strength cannot exceed UTS.";
    }
    if (maxStress < minStress) {
      return "Maximum stress must be greater than or equal to minimum stress.";
    }

    if (snCurveSourceMode === "material_basquin") {
      const hasSigmaF = material.fatigue_strength_coefficient !== undefined;
      const hasB = material.fatigue_strength_exponent !== undefined;
      if (hasSigmaF !== hasB) {
        return "Provide both sigma_f' and b, or leave both empty to use defaults.";
      }
      if (
        material.fatigue_strength_exponent !== undefined &&
        material.fatigue_strength_exponent >= 0
      ) {
        return "Basquin exponent b must be negative.";
      }
    }

    if (snCurveSourceMode === "points_fit" && validSNPoints.length < 2) {
      return "Points + fit mode requires at least two valid S-N points.";
    }

    if (
      surfaceFactorMode === "manual_factor" &&
      (!Number.isFinite(manualSurfaceFactor) || manualSurfaceFactor <= 0)
    ) {
      return "Manual surface factor must be positive.";
    }

    if (
      useNotch &&
      (notch.kt < 1 ||
        notch.notch_radius_mm <= 0 ||
        notch.notch_constant_mm <= 0)
    ) {
      return "Notch inputs must satisfy Kt >= 1 and positive geometric values.";
    }

    for (const block of loadingBlocks) {
      if (block.max_stress < block.min_stress) {
        return "Every loading block must satisfy max stress >= min stress.";
      }
      if (block.cycles <= 0 || block.repeats < 1) {
        return "Loading blocks require positive cycles and repeats >= 1.";
      }
    }

    return null;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validate();
    setFormError(validationError);
    if (validationError) {
      return;
    }

    const request: FatigueAnalysisRequest = buildFatigueAnalysisRequest({
      material,
      maxStress,
      minStress,
      snCurveSourceMode,
      snPoints: validSNPoints,
      surfaceFactorMode,
      surfaceFinish,
      manualSurfaceFactor,
      marinFactors,
      selectedModel,
      useNotch,
      notch,
      loadingBlocks,
    });

    onSubmit(request);
  };

  return (
    <Card>
      <CardHeader className="pb-5">
        <CardTitle>Analysis setup</CardTitle>
        <p className="text-sm leading-6 text-[#475569]">
          Define material properties, choose the S-N source and configure the
          stress case before running the fatigue calculation.
        </p>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Section
            title="Material properties"
            description="Core mechanical properties used in the fatigue model."
          >
            {presets.length > 0 ? (
              <div className="space-y-1.5">
                <Label>Material preset</Label>
                <Select onValueChange={handlePresetChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a preset" />
                  </SelectTrigger>
                  <SelectContent>
                    {presets.map((preset) => (
                      <SelectItem key={preset.name} value={preset.name}>
                        {preset.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <NumericField
                label="Ultimate tensile strength UTS"
                unit="MPa"
                value={material.uts}
                placeholder="e.g. 600"
                onChange={(value) => updateMaterialNumber("uts", value)}
              />
              <NumericField
                label="Yield strength"
                unit="MPa"
                value={material.yield_strength}
                placeholder="e.g. 400"
                onChange={(value) =>
                  updateMaterialNumber("yield_strength", value)
                }
              />
              <NumericField
                label="Endurance limit Se"
                unit="MPa"
                value={material.endurance_limit ?? ""}
                placeholder="Leave empty to estimate"
                onChange={(value) =>
                  updateMaterialNumber("endurance_limit", value, true)
                }
              />
              <NumericField
                label="Elastic modulus"
                unit="GPa"
                value={material.elastic_modulus}
                placeholder="e.g. 210"
                onChange={(value) =>
                  updateMaterialNumber("elastic_modulus", value)
                }
              />
            </div>
          </Section>

          <Section
            title="S-N model"
            description="Choose whether the curve is defined by Basquin parameters or by fitted S-N points."
          >
            <div className="space-y-1.5">
              <Label>Curve source</Label>
              <Select
                value={snCurveSourceMode}
                onValueChange={(value) =>
                  onSNCurveSourceModeChange(value as SNCurveSourceMode)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="material_basquin">Basquin parameters</SelectItem>
                  <SelectItem value="points_fit">S-N points</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {snCurveSourceMode === "material_basquin" ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <NumericField
                  label="Fatigue strength coefficient σf'"
                  unit="MPa"
                  value={material.fatigue_strength_coefficient ?? ""}
                  placeholder="e.g. 900 MPa"
                  onChange={(value) =>
                    updateMaterialNumber(
                      "fatigue_strength_coefficient",
                      value,
                      true
                    )
                  }
                />
                <NumericField
                  label="Basquin exponent b"
                  value={material.fatigue_strength_exponent ?? ""}
                  placeholder="e.g. -0.09"
                  onChange={(value) =>
                    updateMaterialNumber(
                      "fatigue_strength_exponent",
                      value,
                      true
                    )
                  }
                />
              </div>
            ) : (
              <SNInteractiveInput
                points={snPoints}
                onPointsChange={onSNPointsChange}
              />
            )}
          </Section>

          <Section
            title="Loading conditions"
            description="Primary loading state used for life estimation and mean stress correction."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <NumericField
                label="Maximum stress"
                unit="MPa"
                value={maxStress}
                placeholder="e.g. 300"
                onChange={(value) => setMaxStress(Number(value) || 0)}
              />
              <NumericField
                label="Minimum stress"
                unit="MPa"
                value={minStress}
                placeholder="e.g. -100"
                onChange={(value) => setMinStress(Number(value) || 0)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Mean stress model</Label>
              <Select
                value={selectedModel}
                onValueChange={(value) =>
                  setSelectedModel(value as MeanStressModel)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="goodman">Goodman</SelectItem>
                  <SelectItem value="gerber">Gerber</SelectItem>
                  <SelectItem value="soderberg">Soderberg</SelectItem>
                  <SelectItem value="morrow">Morrow</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Section>

          <Section
            title="Advanced options"
            description="Optional corrections and spectrum loading settings."
          >
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-left"
              onClick={() => setAdvancedOpen((current) => !current)}
            >
              <div>
                <p className="text-sm font-semibold text-[#0f172a]">
                  {advancedOpen ? "Hide advanced options" : "Show advanced options"}
                </p>
                <p className="text-sm text-[#475569]">
                  Surface factor, Marin factors, notch correction and loading
                  blocks.
                </p>
              </div>
              {advancedOpen ? (
                <ChevronDown className="h-5 w-5 text-[#475569]" />
              ) : (
                <ChevronRight className="h-5 w-5 text-[#475569]" />
              )}
            </button>

            {advancedOpen ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
                  <p className="text-sm font-semibold text-[#0f172a]">
                    Surface factor
                  </p>
                  <div className="mt-4 space-y-4">
                    <div className="space-y-1.5">
                      <Label>Surface factor source</Label>
                      <Select
                        value={surfaceFactorMode}
                        onValueChange={(value) =>
                          setSurfaceFactorMode(value as SurfaceFactorMode)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="empirical_surface_finish">
                            Surface finish lookup
                          </SelectItem>
                          <SelectItem value="manual_factor">Manual k_a</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {surfaceFactorMode === "empirical_surface_finish" ? (
                      <div className="space-y-1.5">
                        <Label>Surface finish</Label>
                        <Select
                          value={surfaceFinish}
                          onValueChange={(value) =>
                            setSurfaceFinish(value as SurfaceFinishType)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ground">Ground</SelectItem>
                            <SelectItem value="machined">Machined</SelectItem>
                            <SelectItem value="hot_rolled">Hot-rolled</SelectItem>
                            <SelectItem value="forged">Forged</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <NumericField
                        label="Manual surface factor k_a"
                        value={manualSurfaceFactor}
                        placeholder="e.g. 0.85"
                        onChange={(value) =>
                          setManualSurfaceFactor(Number(value) || 0)
                        }
                      />
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
                  <p className="text-sm font-semibold text-[#0f172a]">
                    Marin factors
                  </p>
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <NumericField
                      label="Size factor k_b"
                      value={marinFactors.size_factor}
                      placeholder="e.g. 1.00"
                      onChange={(value) => updateMarinFactor("size_factor", value)}
                    />
                    <NumericField
                      label="Load factor k_c"
                      value={marinFactors.load_factor}
                      placeholder="e.g. 1.00"
                      onChange={(value) => updateMarinFactor("load_factor", value)}
                    />
                    <NumericField
                      label="Temperature factor k_d"
                      value={marinFactors.temperature_factor}
                      placeholder="e.g. 1.00"
                      onChange={(value) =>
                        updateMarinFactor("temperature_factor", value)
                      }
                    />
                    <NumericField
                      label="Reliability factor k_e"
                      value={marinFactors.reliability_factor}
                      placeholder="e.g. 1.00"
                      onChange={(value) =>
                        updateMarinFactor("reliability_factor", value)
                      }
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#0f172a]">
                        Notch correction
                      </p>
                      <p className="text-sm text-[#475569]">
                        Apply notch sensitivity if local stress concentration is
                        relevant.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant={useNotch ? "default" : "outline"}
                      onClick={() => setUseNotch((current) => !current)}
                    >
                      {useNotch ? "Enabled" : "Enable"}
                    </Button>
                  </div>

                  {useNotch ? (
                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-1.5 md:col-span-2">
                        <Label>Notch model</Label>
                        <Select
                          value={notch.model}
                          onValueChange={(value) => updateNotch("model", value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="neuber">Neuber</SelectItem>
                            <SelectItem value="kuhn_hardrath">
                              Kuhn-Hardrath
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <NumericField
                        label="Theoretical concentration Kt"
                        value={notch.kt}
                        placeholder="e.g. 2.2"
                        onChange={(value) => updateNotch("kt", value)}
                      />
                      <NumericField
                        label="Notch radius r"
                        unit="mm"
                        value={notch.notch_radius_mm}
                        placeholder="e.g. 0.8"
                        onChange={(value) =>
                          updateNotch("notch_radius_mm", value)
                        }
                      />
                      <NumericField
                        label="Notch constant a"
                        unit="mm"
                        value={notch.notch_constant_mm}
                        placeholder="e.g. 0.25"
                        onChange={(value) =>
                          updateNotch("notch_constant_mm", value)
                        }
                      />
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#0f172a]">
                        Loading blocks
                      </p>
                      <p className="text-sm text-[#475569]">
                        Add Palmgren-Miner blocks for spectrum loading.
                      </p>
                    </div>
                    <Button type="button" variant="outline" onClick={addLoadingBlock}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add block
                    </Button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {loadingBlocks.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[#cbd5e1] bg-white px-4 py-5 text-sm text-[#475569]">
                        No spectrum blocks defined. The analysis will use only
                        the primary loading state.
                      </div>
                    ) : (
                      loadingBlocks.map((block, index) => (
                        <LoadingBlockRow
                          key={`${block.max_stress}-${block.min_stress}-${index}`}
                          block={block}
                          index={index}
                          onChange={updateLoadingBlock}
                          onRemove={removeLoadingBlock}
                        />
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </Section>

          {formError ? (
            <div className="rounded-2xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#991b1b]">
              {formError}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-[#e2e8f0] pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[#475569]">
              Units are applied directly in the request. Review values before
              running the analysis.
            </p>
            <Button type="submit" size="lg" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running analysis
                </>
              ) : (
                "Run analysis"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
