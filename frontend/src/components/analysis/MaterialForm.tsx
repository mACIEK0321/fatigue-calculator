"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  MaterialProperties,
  MarinFactors,
  MaterialPreset,
} from "@/types/fatigue";
import { Loader2 } from "lucide-react";

interface MaterialFormProps {
  onSubmit: (request: FatigueAnalysisRequest) => void;
  isLoading: boolean;
}

const defaultMaterial: MaterialProperties = {
  ultimate_tensile_strength: 400,
  yield_strength: 250,
  endurance_limit: 200,
  elastic_modulus: 207000,
  fatigue_strength_coefficient: 900,
  fatigue_strength_exponent: -0.106,
  fatigue_ductility_coefficient: 0.58,
  fatigue_ductility_exponent: -0.58,
};

const defaultMarinFactors: MarinFactors = {
  surface: 1.0,
  size: 1.0,
  load: 1.0,
  temperature: 1.0,
  reliability: 1.0,
};

export default function MaterialForm({ onSubmit, isLoading }: MaterialFormProps) {
  const [presets, setPresets] = useState<MaterialPreset[]>([]);
  const [material, setMaterial] = useState<MaterialProperties>(defaultMaterial);
  const [marinFactors, setMarinFactors] = useState<MarinFactors>(defaultMarinFactors);
  const [surfaceFinish, setSurfaceFinish] = useState("machined");
  const [maxStress, setMaxStress] = useState(300);
  const [minStress, setMinStress] = useState(-100);

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
      setMaterial(preset.properties);
    }
  };

  const updateMaterial = (field: keyof MaterialProperties, value: string) => {
    setMaterial((prev) => ({ ...prev, [field]: parseFloat(value) || 0 }));
  };

  const updateMarin = (field: keyof MarinFactors, value: string) => {
    setMarinFactors((prev) => ({ ...prev, [field]: parseFloat(value) || 0 }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      material,
      max_stress: maxStress,
      min_stress: minStress,
      surface_finish: surfaceFinish,
      marin_factors: marinFactors,
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
                value={material.ultimate_tensile_strength}
                onChange={(e) =>
                  updateMaterial("ultimate_tensile_strength", e.target.value)
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Yield Strength (MPa)</Label>
              <Input
                type="number"
                value={material.yield_strength}
                onChange={(e) => updateMaterial("yield_strength", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Endurance Limit (MPa)</Label>
              <Input
                type="number"
                value={material.endurance_limit}
                onChange={(e) => updateMaterial("endurance_limit", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Elastic Modulus (MPa)</Label>
              <Input
                type="number"
                value={material.elastic_modulus}
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
                value={material.fatigue_strength_coefficient}
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
                value={material.fatigue_strength_exponent}
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
                value={material.fatigue_ductility_coefficient}
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
                value={material.fatigue_ductility_exponent}
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
              <Input
                type="number"
                step="any"
                value={marinFactors.surface}
                onChange={(e) => updateMarin("surface", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>k_b (Size)</Label>
              <Input
                type="number"
                step="any"
                value={marinFactors.size}
                onChange={(e) => updateMarin("size", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>k_c (Load)</Label>
              <Input
                type="number"
                step="any"
                value={marinFactors.load}
                onChange={(e) => updateMarin("load", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>k_d (Temperature)</Label>
              <Input
                type="number"
                step="any"
                value={marinFactors.temperature}
                onChange={(e) => updateMarin("temperature", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>k_e (Reliability)</Label>
              <Input
                type="number"
                step="any"
                value={marinFactors.reliability}
                onChange={(e) => updateMarin("reliability", e.target.value)}
              />
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
