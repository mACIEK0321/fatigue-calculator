"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
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
import { Slider } from "@/components/ui/slider";
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

export default function MaterialForm({
  onSubmit,
  isLoading,
  snCurveSourceMode,
  onSNCurveSourceModeChange,
  snPoints,
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

  const updateMarinFactor = (field: keyof MarinFactors, value: number) => {
    setMarinFactors((current) => ({ ...current, [field]: value }));
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Material Selection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {presets.length > 0 ? (
            <div className="space-y-1.5">
              <Label>Material preset</Label>
              <Select onValueChange={handlePresetChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a material preset..." />
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>UTS (MPa)</Label>
              <Input
                type="number"
                value={material.uts}
                onChange={(event) =>
                  updateMaterialNumber("uts", event.target.value)
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Yield strength (MPa)</Label>
              <Input
                type="number"
                value={material.yield_strength}
                onChange={(event) =>
                  updateMaterialNumber("yield_strength", event.target.value)
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Endurance limit Se&apos; (MPa)</Label>
              <Input
                type="number"
                value={material.endurance_limit ?? ""}
                placeholder="Leave empty to estimate from UTS"
                onChange={(event) =>
                  updateMaterialNumber(
                    "endurance_limit",
                    event.target.value,
                    true
                  )
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Elastic modulus (GPa)</Label>
              <Input
                type="number"
                value={material.elastic_modulus}
                onChange={(event) =>
                  updateMaterialNumber("elastic_modulus", event.target.value)
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">S-N Curve Source</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Source mode</Label>
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
                <SelectItem value="material_basquin">
                  Material parameters / Basquin
                </SelectItem>
                <SelectItem value="points_fit">S-N points + fit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {snCurveSourceMode === "material_basquin" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>sigma_f&apos; (MPa)</Label>
                <Input
                  type="number"
                  step="any"
                  value={material.fatigue_strength_coefficient ?? ""}
                  placeholder="Optional"
                  onChange={(event) =>
                    updateMaterialNumber(
                      "fatigue_strength_coefficient",
                      event.target.value,
                      true
                    )
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Basquin exponent b</Label>
                <Input
                  type="number"
                  step="any"
                  value={material.fatigue_strength_exponent ?? ""}
                  placeholder="Optional"
                  onChange={(event) =>
                    updateMaterialNumber(
                      "fatigue_strength_exponent",
                      event.target.value,
                      true
                    )
                  }
                />
              </div>
              <div className="col-span-2 rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-400">
                Leave both fields empty to let the backend use default Basquin
                estimates from the material strength.
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-300">
              The backend will fit Basquin parameters from the interactive S-N
              points. Valid points ready:{" "}
              <span className="font-medium text-slate-100">
                {validSNPoints.length}
              </span>
              .
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Surface and Marin Factors</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
            <div className="space-y-1.5">
              <Label>Manual k_a</Label>
              <Input
                type="number"
                step="any"
                value={manualSurfaceFactor}
                onChange={(event) =>
                  setManualSurfaceFactor(Number(event.target.value) || 0)
                }
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>k_b (size)</Label>
              <Slider
                value={[marinFactors.size_factor]}
                min={0.2}
                max={1.2}
                step={0.01}
                onValueChange={(value) =>
                  updateMarinFactor("size_factor", value[0])
                }
              />
              <p className="text-xs text-slate-400">
                {marinFactors.size_factor.toFixed(2)}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>k_c (load)</Label>
              <Slider
                value={[marinFactors.load_factor]}
                min={0.2}
                max={1.2}
                step={0.01}
                onValueChange={(value) =>
                  updateMarinFactor("load_factor", value[0])
                }
              />
              <p className="text-xs text-slate-400">
                {marinFactors.load_factor.toFixed(2)}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>k_d (temperature)</Label>
              <Slider
                value={[marinFactors.temperature_factor]}
                min={0.2}
                max={1.2}
                step={0.01}
                onValueChange={(value) =>
                  updateMarinFactor("temperature_factor", value[0])
                }
              />
              <p className="text-xs text-slate-400">
                {marinFactors.temperature_factor.toFixed(2)}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>k_e (reliability)</Label>
              <Slider
                value={[marinFactors.reliability_factor]}
                min={0.2}
                max={1.2}
                step={0.01}
                onValueChange={(value) =>
                  updateMarinFactor("reliability_factor", value[0])
                }
              />
              <p className="text-xs text-slate-400">
                {marinFactors.reliability_factor.toFixed(2)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Loading Conditions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Max stress (MPa)</Label>
              <Input
                type="number"
                step="any"
                value={maxStress}
                onChange={(event) =>
                  setMaxStress(Number(event.target.value) || 0)
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Min stress (MPa)</Label>
              <Input
                type="number"
                step="any"
                value={minStress}
                onChange={(event) =>
                  setMinStress(Number(event.target.value) || 0)
                }
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Primary mean stress model</Label>
            <Select
              value={selectedModel}
              onValueChange={(value) => setSelectedModel(value as MeanStressModel)}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Notch Correction</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setUseNotch((current) => !current)}
          >
            {useNotch ? "Disable notch correction" : "Enable notch correction"}
          </Button>

          {useNotch ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Model</Label>
                <Select
                  value={notch.model}
                  onValueChange={(value) => updateNotch("model", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="neuber">Neuber</SelectItem>
                    <SelectItem value="kuhn_hardrath">Kuhn-Hardrath</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Kt</Label>
                <Input
                  type="number"
                  step="any"
                  value={notch.kt}
                  onChange={(event) => updateNotch("kt", event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Radius r (mm)</Label>
                <Input
                  type="number"
                  step="any"
                  value={notch.notch_radius_mm}
                  onChange={(event) =>
                    updateNotch("notch_radius_mm", event.target.value)
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Constant a (mm)</Label>
                <Input
                  type="number"
                  step="any"
                  value={notch.notch_constant_mm}
                  onChange={(event) =>
                    updateNotch("notch_constant_mm", event.target.value)
                  }
                />
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Palmgren-Miner Loading Blocks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={addLoadingBlock}
          >
            <Plus className="mr-2 h-4 w-4" /> Add load block
          </Button>

          {loadingBlocks.length === 0 ? (
            <p className="text-sm text-slate-400">
              No blocks added. The backend will analyse only the primary stress
              state.
            </p>
          ) : (
            <div className="space-y-3">
              {loadingBlocks.map((block, index) => (
                <div
                  key={`${block.max_stress}-${block.min_stress}-${index}`}
                  className="rounded-lg border border-slate-700 bg-slate-900/50 p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-200">
                      Block {index + 1}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeLoadingBlock(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      step="any"
                      value={block.max_stress}
                      placeholder="Max stress"
                      onChange={(event) =>
                        updateLoadingBlock(index, "max_stress", event.target.value)
                      }
                    />
                    <Input
                      type="number"
                      step="any"
                      value={block.min_stress}
                      placeholder="Min stress"
                      onChange={(event) =>
                        updateLoadingBlock(index, "min_stress", event.target.value)
                      }
                    />
                    <Input
                      type="number"
                      step="any"
                      value={block.cycles}
                      placeholder="Cycles"
                      onChange={(event) =>
                        updateLoadingBlock(index, "cycles", event.target.value)
                      }
                    />
                    <Input
                      type="number"
                      step="1"
                      value={block.repeats}
                      placeholder="Repeats"
                      onChange={(event) =>
                        updateLoadingBlock(index, "repeats", event.target.value)
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {formError ? (
        <div className="rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">
          {formError}
        </div>
      ) : null}

      <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Analyzing...
          </>
        ) : (
          "Run Analysis"
        )}
      </Button>
    </form>
  );
}
