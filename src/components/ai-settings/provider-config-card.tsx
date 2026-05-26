"use client";

import Image from "next/image";
import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import type { SyntheticEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  getGeminiModelSpec,
  getImageGenerationConfig,
  normalizeImageGenerationForModel,
} from "@/lib/gemini-image-models";
import type {
  AiImageGenerationConfig,
  AiImageSize,
  AiProviderConfig,
  AiProviderDefinition,
  AiResponseModality,
  AiThinkingLevel,
} from "@/types/ai";

interface ProviderConfigCardProps {
  provider: AiProviderDefinition;
  config: AiProviderConfig;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onChange: (config: AiProviderConfig) => void;
  onSave: () => void;
  saved?: boolean;
}

export function ProviderConfigCard({
  provider,
  config,
  expanded,
  onExpandedChange,
  onChange,
  onSave,
  saved,
}: ProviderConfigCardProps) {
  const [logoError, setLogoError] = useState(false);

  const handleLogoError = (e: SyntheticEvent<HTMLImageElement>) => {
    setLogoError(true);
    (e.target as HTMLImageElement).style.display = "none";
  };

  const update = (patch: Partial<AiProviderConfig>) => {
    onChange({ ...config, ...patch });
  };

  const modelSpec = getGeminiModelSpec(config.model);
  const imageCfg = getImageGenerationConfig(config, config.model);

  const updateImageGeneration = (patch: Partial<AiImageGenerationConfig>) => {
    const next = normalizeImageGenerationForModel(config.model, {
      ...imageCfg,
      ...patch,
    });
    update({
      imageGenerationByModel: {
        ...config.imageGenerationByModel,
        [config.model]: next,
      },
    });
  };

  const toggleModality = (modality: AiResponseModality) => {
    const current = imageCfg.responseModalities;
    if (current.includes(modality)) {
      if (modality === "IMAGE" && current.length === 1) return;
      updateImageGeneration({
        responseModalities: current.filter((m) => m !== modality),
      });
      return;
    }
    updateImageGeneration({
      responseModalities: [...current, modality],
    });
  };

  return (
    <Card
      className={cn(
        "overflow-hidden transition-shadow",
        !provider.available && "opacity-75",
        config.enabled && provider.available && "ring-1 ring-primary/20"
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-background">
              {logoError ? (
                <span className="text-sm font-semibold text-muted-foreground">
                  {provider.name.charAt(0)}
                </span>
              ) : (
                <Image
                  src={provider.logo}
                  alt={`${provider.name} logo`}
                  width={44}
                  height={44}
                  className="object-contain p-1"
                  onError={handleLogoError}
                />
              )}
            </div>
            <div>
              <CardTitle className="text-lg">{provider.name}</CardTitle>
              <CardDescription className="mt-0.5">
                {provider.available
                  ? config.enabled
                    ? "已启用 · 点击展开配置"
                    : "未启用"
                  : "即将支持"}
              </CardDescription>
            </div>
          </div>

          {provider.available ? (
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <span className="text-muted-foreground">启用</span>
              <button
                type="button"
                role="switch"
                aria-checked={config.enabled}
                onClick={() => {
                  const enabled = !config.enabled;
                  update({ enabled });
                  if (enabled) onExpandedChange(true);
                }}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors",
                  config.enabled ? "bg-primary" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-sm transition-transform",
                    config.enabled ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </label>
          ) : (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
              即将支持
            </span>
          )}
        </div>
      </CardHeader>

      {provider.available && (
        <>
          <div className="border-t px-6">
            <button
              type="button"
              onClick={() => onExpandedChange(!expanded)}
              className="flex w-full items-center justify-between py-3 text-sm text-muted-foreground hover:text-foreground"
            >
              <span>API 与模型配置</span>
              <ChevronDown
                className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")}
              />
            </button>
          </div>

          {expanded && (
            <CardContent className="space-y-4 border-t pt-4">
              <div className="space-y-2">
                <Label htmlFor={`${provider.id}-base-url`}>API 地址</Label>
                <Input
                  id={`${provider.id}-base-url`}
                  value={config.baseUrl}
                  onChange={(e) => update({ baseUrl: e.target.value })}
                  placeholder={provider.baseUrl}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`${provider.id}-api-key`}>API Key</Label>
                <Input
                  id={`${provider.id}-api-key`}
                  type="password"
                  value={config.apiKey}
                  onChange={(e) => update({ apiKey: e.target.value })}
                  placeholder="sk-..."
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2">
                <Label>默认模型</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {provider.models.map((model) => {
                    const selected = config.model === model.id;
                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => update({ model: model.id })}
                        className={cn(
                          "flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent",
                          selected && "border-primary bg-primary/5 ring-1 ring-primary/30"
                        )}
                      >
                        <span>
                          <span className="font-medium">{model.label}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {model.id}
                          </span>
                        </span>
                        {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {provider.imageOnly && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor={`${provider.id}-aspect-ratio`}>宽高比</Label>
                    <select
                      id={`${provider.id}-aspect-ratio`}
                      value={imageCfg.aspectRatio}
                      onChange={(e) =>
                        updateImageGeneration({ aspectRatio: e.target.value })
                      }
                      className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {(modelSpec?.aspectRatios ?? ["1:1"]).map((ar) => (
                        <option key={ar} value={ar}>
                          {ar}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      {modelSpec?.aspectRatios.length ?? 0} 种宽高比 ·
                      生图时若按模板选区匹配，会优先使用最接近的宽高比
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`${provider.id}-image-size`}>输出分辨率</Label>
                    <select
                      id={`${provider.id}-image-size`}
                      value={imageCfg.imageSize}
                      onChange={(e) =>
                        updateImageGeneration({
                          imageSize: e.target.value as AiImageSize,
                        })
                      }
                      className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {(modelSpec?.imageSizes ?? ["1K", "2K", "4K"]).map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </div>

                  {modelSpec?.supportsThinking && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor={`${provider.id}-thinking-level`}>
                          推理深度
                        </Label>
                        <select
                          id={`${provider.id}-thinking-level`}
                          value={imageCfg.thinkingLevel ?? "minimal"}
                          onChange={(e) =>
                            updateImageGeneration({
                              thinkingLevel: e.target.value as AiThinkingLevel,
                            })
                          }
                          className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <option value="minimal">minimal（快速）</option>
                          <option value="High">High（深度推理）</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={imageCfg.includeThoughts ?? false}
                            onChange={(e) =>
                              updateImageGeneration({
                                includeThoughts: e.target.checked,
                              })
                            }
                            className="h-4 w-4 rounded border-input"
                          />
                          返回思维过程文本 (includeThoughts)
                        </label>
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label>响应类型</Label>
                    <div className="flex flex-wrap gap-3">
                      {(["IMAGE", "TEXT"] as const).map((modality) => (
                        <label
                          key={modality}
                          className="flex cursor-pointer items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={imageCfg.responseModalities.includes(modality)}
                            onChange={() => toggleModality(modality)}
                            className="h-4 w-4 rounded border-input"
                          />
                          {modality === "IMAGE" ? "图片 (IMAGE)" : "文本 (TEXT)"}
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      至少勾选 IMAGE；可同时勾选 TEXT 以返回图文
                    </p>
                  </div>
                </>
              )}

              {!provider.imageOnly && (
                <div className="space-y-2">
                  <Label htmlFor={`${provider.id}-temperature`}>
                    温度 (Temperature)
                  </Label>
                  <Input
                    id={`${provider.id}-temperature`}
                    type="number"
                    min={0}
                    max={2}
                    step={0.1}
                    value={config.temperature}
                    onChange={(e) =>
                      update({ temperature: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <Button type="button" onClick={onSave}>
                  保存 {provider.name} 配置
                </Button>
                {saved && (
                  <span className="flex items-center gap-1 text-sm text-green-600">
                    <Check className="h-4 w-4" />
                    已保存
                  </span>
                )}
              </div>
            </CardContent>
          )}
        </>
      )}
    </Card>
  );
}
