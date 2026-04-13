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
import { ApiError, getMaterialPresets, readStressFromImage } from "@/lib/api";
import {
  buildFatigueInterpretationRequest,
  type FatigueFormValues,
  sanitizePoints,
} from "@/lib/analysis-request";
import { parseNumericDraft, toNumericDraft } from "@/lib/analysis-form";
import { getStressPrefillDecision } from "@/lib/stress-image";
import type {
  FatigueAnalysisInterpretRequest,
  ConfidenceLevel,
  LoadingBlock,
  MarinFactors,
  MaterialPreset,
  MaterialProperties,
  MeanStressModel,
  NotchSensitivityInput,
  SNCurveSourceMode,
  SNFitPoint,
  StressImageReadResponse,
  SurfaceFactorMode,
  SurfaceFinishType,
} from "@/types/fatigue";

interface MaterialFormProps {
  onSubmit: (request: FatigueAnalysisInterpretRequest) => void;
  isLoading: boolean;
  snCurveSourceMode: SNCurveSourceMode;
  onSNCurveSourceModeChange: (mode: SNCurveSourceMode) => void;
  snPoints: SNFitPoint[];
  onSNPointsChange: (points: SNFitPoint[]) => void;
  includeAIInterpretation: boolean;
  onIncludeAIInterpretationChange: (enabled: boolean) => void;
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

type EditableMaterialField =
  | "uts"
  | "yield_strength"
  | "endurance_limit"
  | "elastic_modulus"
  | "fatigue_strength_coefficient"
  | "fatigue_strength_exponent";

type MaterialDrafts = Record<EditableMaterialField, string>;
type MarinFactorDrafts = Record<keyof MarinFactors, string>;
type NotchDrafts = Record<
  Exclude<keyof NotchSensitivityInput, "model">,
  string
>;
type LoadingBlockDraft = Record<keyof LoadingBlock, string>;

function getMaterialDrafts(material: MaterialProperties): MaterialDrafts {
  return {
    uts: toNumericDraft(material.uts),
    yield_strength: toNumericDraft(material.yield_strength),
    endurance_limit: toNumericDraft(material.endurance_limit),
    elastic_modulus: toNumericDraft(material.elastic_modulus),
    fatigue_strength_coefficient: toNumericDraft(
      material.fatigue_strength_coefficient
    ),
    fatigue_strength_exponent: toNumericDraft(material.fatigue_strength_exponent),
  };
}

function getMarinFactorDrafts(factors: MarinFactors): MarinFactorDrafts {
  return {
    size_factor: toNumericDraft(factors.size_factor),
    load_factor: toNumericDraft(factors.load_factor),
    temperature_factor: toNumericDraft(factors.temperature_factor),
    reliability_factor: toNumericDraft(factors.reliability_factor),
  };
}

function getNotchDrafts(notch: NotchSensitivityInput): NotchDrafts {
  return {
    kt: toNumericDraft(notch.kt),
    notch_radius_mm: toNumericDraft(notch.notch_radius_mm),
    notch_constant_mm: toNumericDraft(notch.notch_constant_mm),
  };
}

function getLoadingBlockDraft(block: LoadingBlock): LoadingBlockDraft {
  return {
    max_stress: toNumericDraft(block.max_stress),
    min_stress: toNumericDraft(block.min_stress),
    cycles: toNumericDraft(block.cycles),
    repeats: toNumericDraft(block.repeats),
  };
}

function formatDetectedValue(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "N/A";
  }
  if (Math.abs(value) >= 1000) {
    return value.toFixed(1);
  }
  return value.toFixed(3);
}

function confidenceTone(confidence: ConfidenceLevel): string {
  if (confidence === "high") {
    return "bg-[#dcfce7] text-[#166534]";
  }
  if (confidence === "medium") {
    return "bg-[#fef3c7] text-[#92400e]";
  }
  return "bg-[#fee2e2] text-[#991b1b]";
}

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
  block: LoadingBlockDraft;
  index: number;
  onChange: (index: number, field: keyof LoadingBlockDraft, value: string) => void;
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
  includeAIInterpretation,
  onIncludeAIInterpretationChange,
}: MaterialFormProps) {
  const [presets, setPresets] = useState<MaterialPreset[]>([]);
  const [material, setMaterial] = useState<MaterialProperties>(defaultMaterial);
  const [materialDrafts, setMaterialDrafts] = useState<MaterialDrafts>(() =>
    getMaterialDrafts(defaultMaterial)
  );
  const [surfaceFactorMode, setSurfaceFactorMode] =
    useState<SurfaceFactorMode>("empirical_surface_finish");
  const [surfaceFinish, setSurfaceFinish] =
    useState<SurfaceFinishType>("machined");
  const [manualSurfaceFactorDraft, setManualSurfaceFactorDraft] = useState(
    toNumericDraft(0.85)
  );
  const [marinFactorDrafts, setMarinFactorDrafts] =
    useState<MarinFactorDrafts>(() => getMarinFactorDrafts(defaultMarinFactors));
  const [selectedModel, setSelectedModel] =
    useState<MeanStressModel>("goodman");
  const [maxStressDraft, setMaxStressDraft] = useState(toNumericDraft(300));
  const [minStressDraft, setMinStressDraft] = useState(toNumericDraft(-100));
  const [useNotch, setUseNotch] = useState(false);
  const [notchModel, setNotchModel] =
    useState<NotchSensitivityInput["model"]>(defaultNotch.model);
  const [notchDrafts, setNotchDrafts] = useState<NotchDrafts>(() =>
    getNotchDrafts(defaultNotch)
  );
  const [loadingBlocks, setLoadingBlocks] = useState<LoadingBlockDraft[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageReadResult, setImageReadResult] =
    useState<StressImageReadResponse | null>(null);
  const [imageReadError, setImageReadError] = useState<string | null>(null);
  const [isReadingImage, setIsReadingImage] = useState(false);

  useEffect(() => {
    getMaterialPresets()
      .then(setPresets)
      .catch(() => {
        setPresets([]);
      });
  }, []);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  const validSNPoints = useMemo(() => sanitizePoints(snPoints), [snPoints]);
  const imagePrefillDecision = useMemo(
    () => getStressPrefillDecision(imageReadResult),
    [imageReadResult]
  );

  const handlePresetChange = (presetName: string) => {
    const preset = presets.find((item) => item.name === presetName);
    if (!preset) {
      return;
    }

    const nextMaterial: MaterialProperties = {
      uts: preset.uts,
      yield_strength: preset.yield_strength,
      endurance_limit: preset.endurance_limit ?? undefined,
      elastic_modulus: preset.elastic_modulus,
      fatigue_strength_coefficient: preset.fatigue_strength_coefficient,
      fatigue_strength_exponent: preset.fatigue_strength_exponent,
      fatigue_ductility_coefficient: preset.fatigue_ductility_coefficient,
      fatigue_ductility_exponent: preset.fatigue_ductility_exponent,
    };

    setMaterial(nextMaterial);
    setMaterialDrafts(getMaterialDrafts(nextMaterial));
  };

  const updateMaterialNumber = (
    field: EditableMaterialField,
    value: string,
    allowEmpty = false
  ) => {
    setMaterialDrafts((current) => ({ ...current, [field]: value }));

    if (allowEmpty && value.trim() === "") {
      setMaterial((current) => ({ ...current, [field]: undefined } as MaterialProperties));
      return;
    }

    const parsed = parseNumericDraft(value);
    if (parsed === undefined) {
      return;
    }

    setMaterial((current) => ({ ...current, [field]: parsed } as MaterialProperties));
  };

  const updateMarinFactor = (field: keyof MarinFactors, value: string) => {
    setMarinFactorDrafts((current) => ({ ...current, [field]: value }));
  };

  const updateNotch = (field: keyof NotchDrafts, value: string) => {
    setNotchDrafts((current) => ({ ...current, [field]: value }));
  };

  const addLoadingBlock = () => {
    const primaryMaxStress = parseNumericDraft(maxStressDraft) ?? 300;
    const primaryMinStress = parseNumericDraft(minStressDraft) ?? -100;

    setLoadingBlocks((current) => [
      ...current,
      getLoadingBlockDraft({
        max_stress: primaryMaxStress,
        min_stress: primaryMinStress,
        cycles: 1e5,
        repeats: 1,
      }),
    ]);
  };

  const updateLoadingBlock = (
    index: number,
    field: keyof LoadingBlockDraft,
    value: string
  ) => {
    setLoadingBlocks((current) =>
      current.map((block, blockIndex) =>
        blockIndex === index ? { ...block, [field]: value } : block
      )
    );
  };

  const removeLoadingBlock = (index: number) => {
    setLoadingBlocks((current) =>
      current.filter((_, blockIndex) => blockIndex !== index)
    );
  };

  const handleImageSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setImageFile(file);
    setImageReadResult(null);
    setImageReadError(null);

    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    setImagePreviewUrl(file ? URL.createObjectURL(file) : null);
  };

  const handleReadStressFromImage = async () => {
    if (!imageFile) {
      setImageReadError("Select a screenshot before requesting image reading.");
      return;
    }

    setIsReadingImage(true);
    setImageReadError(null);
    setImageReadResult(null);

    try {
      const result = await readStressFromImage(imageFile);
      setImageReadResult(result);
    } catch (error) {
      if (error instanceof ApiError) {
        setImageReadError(error.detail);
      } else if (error instanceof Error) {
        setImageReadError(error.message);
      } else {
        setImageReadError("Image reading failed.");
      }
    } finally {
      setIsReadingImage(false);
    }
  };

  const handleUseDetectedStress = () => {
    const decision = imagePrefillDecision;
    if (!decision.allowed || decision.valueMpa === undefined) {
      setImageReadError(decision.message ?? "Detected value cannot be used safely.");
      return;
    }

    if (
      decision.requiresConfirmation &&
      typeof window !== "undefined" &&
      !window.confirm(
        `Detected unit is ${imageReadResult?.detected_unit}. Insert ${decision.valueMpa.toFixed(
          3
        )} MPa as Maximum stress?`
      )
    ) {
      return;
    }

    setMaxStressDraft(toNumericDraft(decision.valueMpa));
    setImageReadError(null);
  };

  const parseFormValues = (): {
    error: string | null;
    values?: FatigueFormValues;
  } => {
    const uts = parseNumericDraft(materialDrafts.uts);
    const yieldStrength = parseNumericDraft(materialDrafts.yield_strength);
    const enduranceLimit = parseNumericDraft(materialDrafts.endurance_limit);
    const elasticModulus = parseNumericDraft(materialDrafts.elastic_modulus);
    const fatigueStrengthCoefficient = parseNumericDraft(
      materialDrafts.fatigue_strength_coefficient
    );
    const fatigueStrengthExponent = parseNumericDraft(
      materialDrafts.fatigue_strength_exponent
    );
    const maxStress = parseNumericDraft(maxStressDraft);
    const minStress = parseNumericDraft(minStressDraft);
    const manualSurfaceFactor = parseNumericDraft(manualSurfaceFactorDraft);
    const sizeFactor = parseNumericDraft(marinFactorDrafts.size_factor);
    const loadFactor = parseNumericDraft(marinFactorDrafts.load_factor);
    const temperatureFactor = parseNumericDraft(
      marinFactorDrafts.temperature_factor
    );
    const reliabilityFactor = parseNumericDraft(
      marinFactorDrafts.reliability_factor
    );

    if (uts === undefined || yieldStrength === undefined || uts <= 0 || yieldStrength <= 0) {
      return { error: "UTS and yield strength must be positive." };
    }
    if (elasticModulus === undefined || elasticModulus <= 0) {
      return { error: "Elastic modulus must be positive." };
    }
    if (yieldStrength > uts) {
      return { error: "Yield strength cannot exceed UTS." };
    }
    if (maxStress === undefined || minStress === undefined) {
      return { error: "Enter valid maximum and minimum stress values." };
    }
    if (maxStress < minStress) {
      return {
        error: "Maximum stress must be greater than or equal to minimum stress.",
      };
    }

    if (snCurveSourceMode === "material_basquin") {
      const hasSigmaF = fatigueStrengthCoefficient !== undefined;
      const hasB = fatigueStrengthExponent !== undefined;
      if (hasSigmaF !== hasB) {
        return {
          error: "Provide both sigma_f' and b, or leave both empty to use defaults.",
        };
      }
      if (fatigueStrengthExponent !== undefined && fatigueStrengthExponent >= 0) {
        return { error: "Basquin exponent b must be negative." };
      }
    }

    if (snCurveSourceMode === "points_fit" && validSNPoints.length < 2) {
      return { error: "Points + fit mode requires at least two valid S-N points." };
    }

    if (
      surfaceFactorMode === "manual_factor" &&
      !(manualSurfaceFactor !== undefined && manualSurfaceFactor > 0)
    ) {
      return { error: "Manual surface factor must be positive." };
    }

    if (
      sizeFactor === undefined ||
      loadFactor === undefined ||
      temperatureFactor === undefined ||
      reliabilityFactor === undefined
    ) {
      return { error: "Marin factors must be valid numbers." };
    }

    const parsedLoadingBlocks: LoadingBlock[] = [];
    for (const block of loadingBlocks) {
      const blockMaxStress = parseNumericDraft(block.max_stress);
      const blockMinStress = parseNumericDraft(block.min_stress);
      const cycles = parseNumericDraft(block.cycles);
      const repeats = parseNumericDraft(block.repeats);

      if (blockMaxStress === undefined || blockMinStress === undefined) {
        return { error: "Every loading block must use valid numeric stresses." };
      }
      if (blockMaxStress < blockMinStress) {
        return {
          error: "Every loading block must satisfy max stress >= min stress.",
        };
      }
      if (
        !(cycles !== undefined && cycles > 0) ||
        !(repeats !== undefined && repeats >= 1)
      ) {
        return { error: "Loading blocks require positive cycles and repeats >= 1." };
      }

      parsedLoadingBlocks.push({
        max_stress: blockMaxStress,
        min_stress: blockMinStress,
        cycles,
        repeats: Math.max(1, Math.round(repeats)),
      });
    }

    const kt = parseNumericDraft(notchDrafts.kt);
    const notchRadius = parseNumericDraft(notchDrafts.notch_radius_mm);
    const notchConstant = parseNumericDraft(notchDrafts.notch_constant_mm);

    if (
      useNotch &&
      (!(kt !== undefined && kt >= 1) ||
        !(notchRadius !== undefined && notchRadius > 0) ||
        !(notchConstant !== undefined && notchConstant > 0))
    ) {
      return {
        error: "Notch inputs must satisfy Kt >= 1 and positive geometric values.",
      };
    }

    return {
      error: null,
      values: {
        material: {
          ...material,
          uts: uts,
          yield_strength: yieldStrength,
          endurance_limit: enduranceLimit,
          elastic_modulus: elasticModulus,
          fatigue_strength_coefficient: fatigueStrengthCoefficient,
          fatigue_strength_exponent: fatigueStrengthExponent,
        },
        maxStress: maxStress,
        minStress: minStress,
        snCurveSourceMode,
        snPoints: validSNPoints,
        surfaceFactorMode,
        surfaceFinish,
        manualSurfaceFactor: manualSurfaceFactor ?? 0.85,
        marinFactors: {
          size_factor: sizeFactor,
          load_factor: loadFactor,
          temperature_factor: temperatureFactor,
          reliability_factor: reliabilityFactor,
        },
        selectedModel,
        useNotch,
        notch: {
          model: notchModel,
          kt: kt ?? defaultNotch.kt,
          notch_radius_mm: notchRadius ?? defaultNotch.notch_radius_mm,
          notch_constant_mm: notchConstant ?? defaultNotch.notch_constant_mm,
        },
        loadingBlocks: parsedLoadingBlocks,
      },
    };
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const { error, values } = parseFormValues();
    setFormError(error);
    if (error || !values) {
      return;
    }

    const request: FatigueAnalysisInterpretRequest =
      buildFatigueInterpretationRequest(
        values,
        {
          enabled: includeAIInterpretation,
        },
        imageReadResult ?? undefined
      );

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
                value={materialDrafts.uts}
                placeholder="e.g. 600"
                onChange={(value) => updateMaterialNumber("uts", value)}
              />
              <NumericField
                label="Yield strength"
                unit="MPa"
                value={materialDrafts.yield_strength}
                placeholder="e.g. 400"
                onChange={(value) =>
                  updateMaterialNumber("yield_strength", value)
                }
              />
              <NumericField
                label="Endurance limit Se"
                unit="MPa"
                value={materialDrafts.endurance_limit}
                placeholder="Leave empty to estimate"
                onChange={(value) =>
                  updateMaterialNumber("endurance_limit", value, true)
                }
              />
              <NumericField
                label="Elastic modulus"
                unit="GPa"
                value={materialDrafts.elastic_modulus}
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
                  value={materialDrafts.fatigue_strength_coefficient}
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
                  value={materialDrafts.fatigue_strength_exponent}
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
                value={maxStressDraft}
                placeholder="e.g. 300"
                onChange={setMaxStressDraft}
              />
              <NumericField
                label="Minimum stress"
                unit="MPa"
                value={minStressDraft}
                placeholder="e.g. -100"
                onChange={setMinStressDraft}
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
            title="Stress screenshot"
            description="Upload one FEA screenshot, read a suggested maximum stress, and review it before using it."
          >
            <div className="space-y-4 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-end">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="stress-screenshot">Screenshot upload</Label>
                  <Input
                    id="stress-screenshot"
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelection}
                  />
                  <p className="text-sm text-[#475569]">
                    Supported for single screenshots only. Native solver inputs still stay under user control.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!imageFile || isReadingImage}
                  onClick={handleReadStressFromImage}
                >
                  {isReadingImage ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Reading image
                    </>
                  ) : (
                    "Read stress from image"
                  )}
                </Button>
              </div>

              {imagePreviewUrl ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">
                    Preview
                  </p>
                  <img
                    src={imagePreviewUrl}
                    alt="Uploaded stress screenshot preview"
                    className="max-h-72 w-full rounded-2xl border border-[#cbd5e1] bg-white object-contain"
                  />
                </div>
              ) : null}

              {imageReadError ? (
                <div className="rounded-2xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#991b1b]">
                  {imageReadError}
                </div>
              ) : null}

              {imageReadResult ? (
                <div
                  className={`space-y-4 rounded-2xl border px-4 py-4 ${
                    imageReadResult.is_usable_for_prefill
                      ? "border-[#99f6e4] bg-[#f0fdfa]"
                      : "border-[#fde68a] bg-[#fffbeb]"
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#475569]">
                        Detected from image
                      </p>
                      <p className="mt-1 text-lg font-semibold text-[#0f172a]">
                        Review before using
                      </p>
                    </div>
                    <span
                      className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold uppercase ${confidenceTone(
                        imageReadResult.confidence
                      )}`}
                    >
                      {imageReadResult.confidence} confidence
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-[#dbeafe] bg-white p-3">
                      <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-[#64748b]">
                        Quantity
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#0f172a]">
                        {imageReadResult.detected_quantity}
                      </p>
                      <p className="mt-1 text-xs text-[#64748b]">
                        {imageReadResult.detected_label ?? "No label detected"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#dbeafe] bg-white p-3">
                      <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-[#64748b]">
                        Max value
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#0f172a]">
                        {formatDetectedValue(imageReadResult.max_value)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#dbeafe] bg-white p-3">
                      <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-[#64748b]">
                        Unit
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#0f172a]">
                        {imageReadResult.detected_unit}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#dbeafe] bg-white p-3">
                      <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-[#64748b]">
                        Min value
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#0f172a]">
                        {formatDetectedValue(imageReadResult.min_value)}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#e2e8f0] bg-white p-3">
                    <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-[#64748b]">
                      Notes
                    </p>
                    <div className="mt-2 space-y-1 text-sm text-[#334155]">
                      {imageReadResult.notes.length > 0 ? (
                        imageReadResult.notes.map((note, index) => (
                          <p key={`${note}-${index}`}>{note}</p>
                        ))
                      ) : (
                        <p>No additional notes returned.</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-[#475569]">
                      {imagePrefillDecision.message}
                    </p>
                    <Button
                      type="button"
                      variant="default"
                      disabled={!imagePrefillDecision.allowed}
                      onClick={handleUseDetectedStress}
                    >
                      Use as max stress
                    </Button>
                  </div>
                </div>
              ) : null}
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
                        value={manualSurfaceFactorDraft}
                        placeholder="e.g. 0.85"
                        onChange={setManualSurfaceFactorDraft}
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
                      value={marinFactorDrafts.size_factor}
                      placeholder="e.g. 1.00"
                      onChange={(value) => updateMarinFactor("size_factor", value)}
                    />
                    <NumericField
                      label="Load factor k_c"
                      value={marinFactorDrafts.load_factor}
                      placeholder="e.g. 1.00"
                      onChange={(value) => updateMarinFactor("load_factor", value)}
                    />
                    <NumericField
                      label="Temperature factor k_d"
                      value={marinFactorDrafts.temperature_factor}
                      placeholder="e.g. 1.00"
                      onChange={(value) =>
                        updateMarinFactor("temperature_factor", value)
                      }
                    />
                    <NumericField
                      label="Reliability factor k_e"
                      value={marinFactorDrafts.reliability_factor}
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
                          value={notchModel}
                          onValueChange={(value) =>
                            setNotchModel(value as NotchSensitivityInput["model"])
                          }
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
                        value={notchDrafts.kt}
                        placeholder="e.g. 2.2"
                        onChange={(value) => updateNotch("kt", value)}
                      />
                      <NumericField
                        label="Notch radius r"
                        unit="mm"
                        value={notchDrafts.notch_radius_mm}
                        placeholder="e.g. 0.8"
                        onChange={(value) =>
                          updateNotch("notch_radius_mm", value)
                        }
                      />
                      <NumericField
                        label="Notch constant a"
                        unit="mm"
                        value={notchDrafts.notch_constant_mm}
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
            <div className="space-y-3">
              <p className="text-sm text-[#475569]">
                Units are applied directly in the request. Review values before
                running the analysis.
              </p>
              <label className="flex items-start gap-3 rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
                <input
                  type="checkbox"
                  checked={includeAIInterpretation}
                  onChange={(event) =>
                    onIncludeAIInterpretationChange(event.target.checked)
                  }
                  className="mt-1 h-4 w-4 rounded border-[#94a3b8] text-[#0f766e] focus:ring-[#0f766e]"
                />
                <span>
                  <span className="block text-sm font-semibold text-[#0f172a]">
                    AI interpretation
                  </span>
                  <span className="block text-sm text-[#475569]">
                    Run the native backend analysis first and optionally request a
                    short textual interpretation of the result.
                  </span>
                </span>
              </label>
            </div>
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
