"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { getMaterialPresets } from "@/lib/api";
import type {
  FatigueAnalysisRequest,
  LoadingBlock,
  MaterialProperties,
  MarinFactors,
  MaterialPreset,
  NotchSensitivityInput,
} from "@/types/fatigue";
import { Loader2, Plus, Trash2 } from "lucide-react";

interface MaterialFormProps {
  onSubmit: (request: FatigueAnalysisRequest) => void;
  isLoading: boolean;
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
  surface_factor: 1.0,
  size_factor: 1.0,
  load_factor: 1.0,
  temperature_factor: 1.0,
  reliability_factor: 1.0,
};

const defaultNotch: NotchSensitivityInput = {
  model: "neuber",
  kt: 1.0,
  notch_radius_mm: 1.0,
  notch_constant_mm: 0.25,
};

export default function MaterialForm({ onSubmit, isLoading }: MaterialFormProps) {
  const [presets, setPresets] = useState<MaterialPreset[]>([]);
  const [material, setMaterial] = useState<MaterialProperties>(defaultMaterial);
  const [marinFactors, setMarinFactors] = useState<MarinFactors>(defaultMarinFactors);
  const [surfaceFinish, setSurfaceFinish] = useState("machined");
  const [selectedModel, setSelectedModel] = useState<"goodman" | "gerber" | "soderberg">("goodman");
  const [maxStress, setMaxStress] = useState(300);
  const [minStress, setMinStress] = useState(-100);
  const [useNotch, setUseNotch] = useState(false);
  const [notch, setNotch] = useState<NotchSensitivityInput>(defaultNotch);
  const [loadingBlocks, setLoadingBlocks] = useState<LoadingBlock[]>([]);

  useEffect(() => {
    getMaterialPresets()
      .then(setPresets)
      .catch(() => {
        // API not available, use empty presets
      });
  }, []);

  const handlePresetChange = (presetName: string) => {
    const preset = presets.find((p) => p.name === presetName);
    if (preset) {
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
    }
  };

  const updateMaterial = (field: keyof MaterialProperties, value: string) => {
    const parsed = parseFloat(value);
    if (Number.isNaN(parsed)) {
      if (field === "endurance_limit") {
        setMaterial((prev) => ({ ...prev, endurance_limit: undefined }));
      }
      return;
    }
    setMaterial((prev) => ({ ...prev, [field]: parsed }));
  };

  const updateMarin = (field: keyof MarinFactors, value: string) => {
    setMarinFactors((prev) => ({ ...prev, [field]: parseFloat(value) || 0 }));
  };

  const updateNotch = (field: keyof NotchSensitivityInput, value: string) => {
    if (field === "model") {
      setNotch((prev) => ({ ...prev, model: value as NotchSensitivityInput["model"] }));
      return;
    }
    setNotch((prev) => ({ ...prev, [field]: parseFloat(value) || 0 }));
  };

  const addLoadingBlock = () => {
    setLoadingBlocks((prev) => [
      ...prev,
      { max_stress: maxStress, min_stress: minStress, cycles: 1e5, repeats: 1 },
    ]);
  };

  const updateLoadingBlock = (
    index: number,
    field: keyof LoadingBlock,
    value: string
  ) => {
    setLoadingBlocks((prev) =>
      prev.map((block, blockIndex) => {
        if (blockIndex !== index) return block;
        const numeric = parseFloat(value) || 0;
        return {
          ...block,
          [field]: field === "repeats" ? Math.max(1, Math.round(numeric)) : numeric,
        };
      })
    );
  };

  const removeLoadingBlock = (index: number) => {
    setLoadingBlocks((prev) => prev.filter((_, blockIndex) => blockIndex !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      material,
      max_stress: maxStress,
      min_stress: minStress,
      surface_finish: {
        finish_type: surfaceFinish as "ground" | "machined" | "hot_rolled" | "forged",
        uts: material.uts,
      },
      marin_factors: marinFactors,
      selected_mean_stress_model: selectedModel,
      notch: useNotch ? notch : undefined,
      loading_blocks: loadingBlocks.length > 0 ? loadingBlocks : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Material Preset Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Material Selection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {presets.length > 0 && (
            <div className="space-y-1.5">
              <Label>Material Preset</Label>
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
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>UTS (MPa)</Label>
              <Input
                type="number"
                value={material.uts ?? ""}
                onChange={(e) => updateMaterial("uts", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Yield Strength (MPa)</Label>
              <Input
                type="number"
                value={material.yield_strength ?? ""}
                onChange={(e) => updateMaterial("yield_strength", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Endurance Limit (MPa)</Label>
              <Input
                type="number"
                value={material.endurance_limit ?? ""}
                onChange={(e) => updateMaterial("endurance_limit", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Elastic Modulus (GPa)</Label>
              <Input
                type="number"
                value={material.elastic_modulus ?? ""}
                onChange={(e) => updateMaterial("elastic_modulus", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fatigue Parameters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Fatigue Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Strength Coeff. (MPa)</Label>
              <Input
                type="number"
                step="any"
                value={material.fatigue_strength_coefficient ?? ""}
                onChange={(e) =>
                  updateMaterial("fatigue_strength_coefficient", e.target.value)
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Strength Exponent</Label>
              <Input
                type="number"
                step="any"
                value={material.fatigue_strength_exponent ?? ""}
                onChange={(e) =>
                  updateMaterial("fatigue_strength_exponent", e.target.value)
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ductility Coeff.</Label>
              <Input
                type="number"
                step="any"
                value={material.fatigue_ductility_coefficient ?? ""}
                onChange={(e) =>
                  updateMaterial("fatigue_ductility_coefficient", e.target.value)
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ductility Exponent</Label>
              <Input
                type="number"
                step="any"
                value={material.fatigue_ductility_exponent ?? ""}
                onChange={(e) =>
                  updateMaterial("fatigue_ductility_exponent", e.target.value)
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Surface Finish & Marin Factors */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Surface &amp; Marin Factors</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Surface Finish</Label>
            <Select value={surfaceFinish} onValueChange={setSurfaceFinish}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ground">Ground</SelectItem>
                <SelectItem value="machined">Machined</SelectItem>
                <SelectItem value="hot_rolled">Hot-Rolled</SelectItem>
                <SelectItem value="forged">Forged</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>k_a (Surface)</Label>
              <Slider
                value={[marinFactors.surface_factor]}
                min={0.2}
                max={1.2}
                step={0.01}
                onValueChange={(v) => updateMarin("surface_factor", String(v[0]))}
              />
              <p className="text-xs text-slate-400">{marinFactors.surface_factor.toFixed(2)}</p>
            </div>
            <div className="space-y-1.5">
              <Label>k_b (Size)</Label>
              <Slider
                value={[marinFactors.size_factor]}
                min={0.2}
                max={1.2}
                step={0.01}
                onValueChange={(v) => updateMarin("size_factor", String(v[0]))}
              />
              <p className="text-xs text-slate-400">{marinFactors.size_factor.toFixed(2)}</p>
            </div>
            <div className="space-y-1.5">
              <Label>k_c (Load)</Label>
              <Slider
                value={[marinFactors.load_factor]}
                min={0.2}
                max={1.2}
                step={0.01}
                onValueChange={(v) => updateMarin("load_factor", String(v[0]))}
              />
              <p className="text-xs text-slate-400">{marinFactors.load_factor.toFixed(2)}</p>
            </div>
            <div className="space-y-1.5">
              <Label>k_d (Temperature)</Label>
              <Slider
                value={[marinFactors.temperature_factor]}
                min={0.2}
                max={1.2}
                step={0.01}
                onValueChange={(v) => updateMarin("temperature_factor", String(v[0]))}
              />
              <p className="text-xs text-slate-400">{marinFactors.temperature_factor.toFixed(2)}</p>
            </div>
            <div className="space-y-1.5">
              <Label>k_e (Reliability)</Label>
              <Slider
                value={[marinFactors.reliability_factor]}
                min={0.2}
                max={1.2}
                step={0.01}
                onValueChange={(v) => updateMarin("reliability_factor", String(v[0]))}
              />
              <p className="text-xs text-slate-400">{marinFactors.reliability_factor.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading Conditions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Loading Conditions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Max Stress (MPa)</Label>
              <Input
                type="number"
                step="any"
                value={maxStress}
                onChange={(e) => setMaxStress(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Min Stress (MPa)</Label>
              <Input
                type="number"
                step="any"
                value={minStress}
                onChange={(e) => setMinStress(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <Label>Primary Mean Stress Model</Label>
            <Select value={selectedModel} onValueChange={(v) => setSelectedModel(v as "goodman" | "gerber" | "soderberg")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="goodman">Goodman</SelectItem>
                <SelectItem value="gerber">Gerber</SelectItem>
                <SelectItem value="soderberg">Soderberg</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Notch Sensitivity (Kf)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setUseNotch((prev) => !prev)}
          >
            {useNotch ? "Disable Notch Correction" : "Enable Notch Correction"}
          </Button>
          {useNotch && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Model</Label>
                <Select value={notch.model} onValueChange={(value) => updateNotch("model", value)}>
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
                <Input type="number" step="any" value={notch.kt} onChange={(e) => updateNotch("kt", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Radius r (mm)</Label>
                <Input
                  type="number"
                  step="any"
                  value={notch.notch_radius_mm}
                  onChange={(e) => updateNotch("notch_radius_mm", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Constant a (mm)</Label>
                <Input
                  type="number"
                  step="any"
                  value={notch.notch_constant_mm}
                  onChange={(e) => updateNotch("notch_constant_mm", e.target.value)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Palmgren-Miner Loading Blocks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button type="button" variant="outline" className="w-full" onClick={addLoadingBlock}>
            <Plus className="mr-2 h-4 w-4" /> Add Load Block
          </Button>
          {loadingBlocks.length === 0 ? (
            <p className="text-sm text-slate-400">No blocks added. Analysis will run as single stress state.</p>
          ) : (
            <div className="space-y-3">
              {loadingBlocks.map((block, index) => (
                <div key={index} className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-200">Block {index + 1}</p>
                    <Button type="button" size="sm" variant="ghost" onClick={() => removeLoadingBlock(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      step="any"
                      value={block.max_stress}
                      onChange={(e) => updateLoadingBlock(index, "max_stress", e.target.value)}
                      placeholder="Max stress"
                    />
                    <Input
                      type="number"
                      step="any"
                      value={block.min_stress}
                      onChange={(e) => updateLoadingBlock(index, "min_stress", e.target.value)}
                      placeholder="Min stress"
                    />
                    <Input
                      type="number"
                      step="any"
                      value={block.cycles}
                      onChange={(e) => updateLoadingBlock(index, "cycles", e.target.value)}
                      placeholder="Cycles"
                    />
                    <Input
                      type="number"
                      step="1"
                      value={block.repeats}
                      onChange={(e) => updateLoadingBlock(index, "repeats", e.target.value)}
                      placeholder="Repeats"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
