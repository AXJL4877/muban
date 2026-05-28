"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Download, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AI_SETTINGS_STORAGE_KEY,
  buildDefaultSettings,
  mergeWithDefaults,
} from "@/lib/ai-providers";
import {
  getEnabledImageModelOptions,
  getImageModelOption,
  parseImageModelValue,
} from "@/lib/ai-image-models";
import { getImageGenerationConfig } from "@/lib/gemini-image-models";
import {
  buildImagePromptWithAppend,
  DEFAULT_PROMPT_APPEND_CONFIG,
  migrateAppendConfig,
  type PromptAppendConfig,
} from "@/lib/ai-prompt-append";
import { getTemplateTextBlockKeys } from "@/lib/template-text-blocks";
import { parseAiJsonOutput } from "@/lib/apply-ai-json-to-canvas";
import {
  loadAiPlusState,
  subscribeAiPlusJsonOutput,
} from "@/lib/ai-plus-storage";
import {
  loadAiPlusImageState,
  saveAiPlusImageState,
  type AiPlusImagePersistedState,
} from "@/lib/ai-plus-image-storage";
import { loadTemplateLibrary, updateTemplatePromptConfig } from "@/lib/image-templates";
import { getImageZonesForTemplate } from "@/lib/template-image-zones";
import { PromptAppendSettings } from "@/components/ai-plus/prompt-append-settings";
import type { AiSettingsStore } from "@/types/ai";
import type { SavedImageTemplate } from "@/types/image-template";

export function ImageGeneratorPanel() {
  const [settings, setSettings] = useState<AiSettingsStore>(buildDefaultSettings);
  const [mounted, setMounted] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const [templates, setTemplates] = useState<SavedImageTemplate[]>([]);
  const [imageModelValue, setImageModelValue] = useState("");
  const [coverModelValue, setCoverModelValue] = useState("");
  const [imageSize, setImageSize] = useState("");
  const [coverSize, setCoverSize] = useState("");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [zoneElementIndex, setZoneElementIndex] = useState<number | null>(null);
  const [imagePrompt, setImagePrompt] = useState("");
  const [coverPrompt, setCoverPrompt] = useState("");
  const [imageAppendConfig, setImageAppendConfig] = useState<PromptAppendConfig>(
    DEFAULT_PROMPT_APPEND_CONFIG
  );
  const [coverAppendConfig, setCoverAppendConfig] = useState<PromptAppendConfig>(
    DEFAULT_PROMPT_APPEND_CONFIG
  );
  const [generatedImageSrc, setGeneratedImageSrc] = useState("");
  const [generatedCoverSrc, setGeneratedCoverSrc] = useState("");
  const [imageLoading, setImageLoading] = useState(false);
  const [coverLoading, setCoverLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTemplateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
      if (raw) {
        setSettings(mergeWithDefaults(JSON.parse(raw) as Partial<AiSettingsStore>));
      }
    } catch {
      /* ignore */
    }

    const saved = loadAiPlusImageState();
    setImageModelValue(saved.imageModelValue);
    setCoverModelValue(saved.coverModelValue);
    setImageSize(saved.imageSize);
    setCoverSize(saved.coverSize);
    setTemplateId(saved.templateId);
    setZoneElementIndex(saved.zoneElementIndex);
    setImagePrompt(saved.imagePrompt);
    setCoverPrompt(saved.coverPrompt);
    setGeneratedImageSrc(saved.lastPreviewUrl);
    setGeneratedCoverSrc(saved.lastCoverUrl);
    setImageAppendConfig(
      migrateAppendConfig({
        appendEnabled: saved.imageAppendEnabled,
        appendJsonKey: saved.appendJsonKey,
        appendSelectedKeys: saved.imageAppendSelectedKeys,
      })
    );
    setCoverAppendConfig(
      migrateAppendConfig({
        appendEnabled: saved.coverAppendEnabled,
        appendSelectedKeys: saved.coverAppendSelectedKeys,
      })
    );

    void (async () => {
      setTemplates(await loadTemplateLibrary());
      setMounted(true);
      setHydrated(true);
    })();
  }, []);

  const template = useMemo(
    () => (templateId ? templates.find((t) => t.id === templateId) : undefined),
    [templateId, templates]
  );

  useEffect(() => {
    if (!template) return;
    if (template.imagePromptConfig) {
      setImagePrompt(
        template.imagePromptConfig.imagePrompt ??
          // 兼容旧字段
          (template.imagePromptConfig as { prompt?: string }).prompt ??
          ""
      );
      setCoverPrompt(template.imagePromptConfig.coverPrompt ?? "");
      setImageAppendConfig((prev) => ({
        ...prev,
        enabled:
          template.imagePromptConfig?.imageAppendEnabled ??
          // 兼容旧字段
          (template.imagePromptConfig as { appendEnabled?: boolean }).appendEnabled ??
          prev.enabled,
        selectedKeys:
          template.imagePromptConfig?.imageAppendSelectedKeys ??
          // 兼容旧字段
          (template.imagePromptConfig as { appendSelectedKeys?: string[] })
            .appendSelectedKeys ??
          prev.selectedKeys,
      }));
      setCoverAppendConfig((prev) => ({
        ...prev,
        enabled: template.imagePromptConfig?.coverAppendEnabled ?? prev.enabled,
        selectedKeys:
          template.imagePromptConfig?.coverAppendSelectedKeys ??
          prev.selectedKeys,
      }));
      setImageModelValue(template.imagePromptConfig?.imageModelValue ?? "");
      setCoverModelValue(template.imagePromptConfig?.coverModelValue ?? "");
      setImageSize(template.imagePromptConfig?.imageSize ?? "");
      setCoverSize(template.imagePromptConfig?.coverSize ?? "");
    }
  }, [template?.id]);

  const zones = useMemo(
    () => (template ? getImageZonesForTemplate(template) : []),
    [template]
  );

  const selectedZone = useMemo(
    () => zones.find((z) => z.elementIndex === zoneElementIndex) ?? null,
    [zones, zoneElementIndex]
  );

  useEffect(() => {
    if (!templateId || zones.length === 0) {
      setZoneElementIndex(null);
      return;
    }
    if (
      zoneElementIndex != null &&
      zones.some((z) => z.elementIndex === zoneElementIndex)
    ) {
      return;
    }
    setZoneElementIndex(zones[0].elementIndex);
  }, [templateId, zones, zoneElementIndex]);

  useEffect(() => {
    if (!template) return;
    const validKeys = new Set(getTemplateTextBlockKeys(template));
    setImageAppendConfig((prev) => {
      const filtered = prev.selectedKeys.filter((k) => validKeys.has(k));
      if (filtered.length === prev.selectedKeys.length) return prev;
      return { ...prev, selectedKeys: filtered };
    });
    setCoverAppendConfig((prev) => {
      const filtered = prev.selectedKeys.filter((k) => validKeys.has(k));
      if (filtered.length === prev.selectedKeys.length) return prev;
      return { ...prev, selectedKeys: filtered };
    });
  }, [template?.id]);

  const jsonLastOutput = useSyncExternalStore(
    subscribeAiPlusJsonOutput,
    () => loadAiPlusState().lastOutput,
    () => ""
  );

  const jsonData = useMemo(
    () => parseAiJsonOutput(jsonLastOutput),
    [jsonLastOutput]
  );

  const imagePromptPreview = useMemo(
    () => buildImagePromptWithAppend(imagePrompt, imageAppendConfig, jsonData),
    [imagePrompt, imageAppendConfig, jsonData]
  );
  const coverPromptPreview = useMemo(
    () => buildImagePromptWithAppend(coverPrompt, coverAppendConfig, jsonData),
    [coverPrompt, coverAppendConfig, jsonData]
  );

  const persistState = useCallback(() => {
    if (!hydrated) return;
    const state: AiPlusImagePersistedState = {
      imageModelValue,
      coverModelValue,
      imageSize,
      coverSize,
      templateId,
      zoneElementIndex,
      imagePrompt,
      coverPrompt,
      lastPreviewUrl: generatedImageSrc,
      lastCoverUrl: generatedCoverSrc,
      imageAppendEnabled: imageAppendConfig.enabled,
      imageAppendSelectedKeys: imageAppendConfig.selectedKeys,
      coverAppendEnabled: coverAppendConfig.enabled,
      coverAppendSelectedKeys: coverAppendConfig.selectedKeys,
    };
    saveAiPlusImageState(state);
  }, [
    hydrated,
    imageModelValue,
    coverModelValue,
    imageSize,
    coverSize,
    templateId,
    zoneElementIndex,
    imagePrompt,
    coverPrompt,
    generatedImageSrc,
    generatedCoverSrc,
    imageAppendConfig,
    coverAppendConfig,
  ]);

  useEffect(() => {
    if (!hydrated) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(persistState, 280);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [hydrated, persistState]);

  useEffect(() => {
    if (!hydrated || !templateId) return;
    if (saveTemplateTimerRef.current) clearTimeout(saveTemplateTimerRef.current);
    saveTemplateTimerRef.current = setTimeout(() => {
      void updateTemplatePromptConfig(templateId, {
        imagePromptConfig: {
          imageModelValue,
          coverModelValue,
          imageSize,
          coverSize,
          imagePrompt,
          coverPrompt,
          imageAppendEnabled: imageAppendConfig.enabled,
          imageAppendSelectedKeys: imageAppendConfig.selectedKeys,
          coverAppendEnabled: coverAppendConfig.enabled,
          coverAppendSelectedKeys: coverAppendConfig.selectedKeys,
        },
      });
    }, 320);
    return () => {
      if (saveTemplateTimerRef.current) clearTimeout(saveTemplateTimerRef.current);
    };
  }, [
    hydrated,
    templateId,
    imageModelValue,
    coverModelValue,
    imageSize,
    coverSize,
    imagePrompt,
    coverPrompt,
    imageAppendConfig,
    coverAppendConfig,
  ]);

  const modelOptions = useMemo(
    () => getEnabledImageModelOptions(settings),
    [settings]
  );

  const imageModelOption = useMemo(
    () => getImageModelOption(imageModelValue),
    [imageModelValue]
  );
  const coverModelOption = useMemo(
    () => getImageModelOption(coverModelValue),
    [coverModelValue]
  );

  useEffect(() => {
    if (!hydrated || modelOptions.length === 0) return;
    if (!modelOptions.some((o) => o.value === imageModelValue)) {
      setImageModelValue(modelOptions[0].value);
    }
  }, [hydrated, modelOptions, imageModelValue]);

  useEffect(() => {
    if (!hydrated || modelOptions.length === 0) return;
    if (!modelOptions.some((o) => o.value === coverModelValue)) {
      setCoverModelValue(modelOptions[0].value);
    }
  }, [hydrated, modelOptions, coverModelValue]);

  useEffect(() => {
    if (!imageModelOption) return;
    if (!imageSize || !imageModelOption.sizes.includes(imageSize)) {
      setImageSize(imageModelOption.defaultSize);
    }
  }, [imageModelOption, imageSize]);

  useEffect(() => {
    if (!coverModelOption) return;
    if (!coverSize || !coverModelOption.sizes.includes(coverSize)) {
      setCoverSize(coverModelOption.defaultSize);
    }
  }, [coverModelOption, coverSize]);

  const updateImageAppendConfig = useCallback((patch: Partial<PromptAppendConfig>) => {
    setImageAppendConfig((prev) => ({ ...prev, ...patch }));
  }, []);
  const updateCoverAppendConfig = useCallback((patch: Partial<PromptAppendConfig>) => {
    setCoverAppendConfig((prev) => ({ ...prev, ...patch }));
  }, []);
  const buildFinalPrompt = useCallback(
    (rawPrompt: string, appendConfig: PromptAppendConfig) => {
      return buildImagePromptWithAppend(rawPrompt, appendConfig, jsonData);
    },
    [jsonData]
  );

  const canGenerateImage = useMemo(() => {
    if (imageLoading || modelOptions.length === 0 || !templateId || !selectedZone) {
      return false;
    }
    if (imageAppendConfig.enabled) {
      if (!jsonData || imageAppendConfig.selectedKeys.length === 0) return false;
    }
    const built = buildFinalPrompt(imagePrompt, imageAppendConfig);
    return !!built.prompt.trim();
  }, [
    imageLoading,
    modelOptions.length,
    templateId,
    selectedZone,
    imagePrompt,
    imageAppendConfig,
    jsonData,
    buildFinalPrompt,
  ]);

  const canGenerateCover = useMemo(() => {
    if (coverLoading || modelOptions.length === 0 || !templateId || !template) {
      return false;
    }
    if (coverAppendConfig.enabled) {
      if (!jsonData || coverAppendConfig.selectedKeys.length === 0) return false;
    }
    const built = buildFinalPrompt(coverPrompt, coverAppendConfig);
    return !!built.prompt.trim();
  }, [
    coverLoading,
    modelOptions.length,
    templateId,
    template,
    coverPrompt,
    coverAppendConfig,
    jsonData,
    buildFinalPrompt,
  ]);

  const handleGenerate = useCallback(async () => {
    setImageError(null);

    if (!templateId) {
      setImageError("请选择模板");
      return;
    }
    if (!selectedZone) {
      setImageError("请选择图片选区");
      return;
    }

    const built = buildFinalPrompt(imagePrompt, imageAppendConfig);
    if (built.error && !built.prompt.trim()) {
      setImageError(built.error);
      return;
    }
    if (!built.prompt.trim()) {
      setImageError("请输入提示词或启用追加文案 JSON");
      return;
    }
    if (imageAppendConfig.enabled && imageAppendConfig.selectedKeys.length === 0) {
      setImageError("请至少选择一个文本块字段");
      return;
    }
    if (imageAppendConfig.enabled && !jsonData) {
      setImageError("请先在「文案 JSON」中生成内容");
      return;
    }

    const parsed = parseImageModelValue(imageModelValue);
    if (!parsed) {
      setImageError("请选择模型");
      return;
    }

    const chosenSize = imageSize || imageModelOption?.defaultSize || "1024x1024";

    const config = settings[parsed.providerId];
    if (!config.apiKey.trim()) {
      setImageError("请先在 AI 设置中配置并保存 API Key");
      return;
    }

    setImageLoading(true);
    try {
      const res = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: built.prompt,
          size: chosenSize,
          providerId: parsed.providerId,
          model: parsed.modelId,
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          imageGeneration: getImageGenerationConfig(config, parsed.modelId),
        }),
      });

      const data = (await res.json()) as {
        url?: string | null;
        b64Json?: string | null;
        error?: string;
      };

      if (!res.ok) {
        setImageError(data.error ?? "生成失败");
        return;
      }

      const src = data.url ?? (data.b64Json ? `data:image/png;base64,${data.b64Json}` : "");
      if (!src) {
        setImageError("未返回可预览的图片");
        return;
      }
      setGeneratedImageSrc(src);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "网络错误，请重试");
    } finally {
      setImageLoading(false);
    }
  }, [
    templateId,
    selectedZone,
    imagePrompt,
    imageAppendConfig,
    jsonData,
    imageModelValue,
    imageSize,
    imageModelOption,
    settings,
    buildFinalPrompt,
  ]);

  const handleGenerateCover = useCallback(async () => {
    setCoverError(null);
    if (!templateId) {
      setCoverError("请选择模板");
      return;
    }
    if (!template) {
      setCoverError("模板不存在，请重新选择");
      return;
    }
    const built = buildFinalPrompt(coverPrompt, coverAppendConfig);
    if (built.error && !built.prompt.trim()) {
      setCoverError(built.error);
      return;
    }
    if (!built.prompt.trim()) {
      setCoverError("请输入提示词或启用追加文案 JSON");
      return;
    }
    if (coverAppendConfig.enabled && coverAppendConfig.selectedKeys.length === 0) {
      setCoverError("请至少选择一个文本块字段");
      return;
    }
    if (coverAppendConfig.enabled && !jsonData) {
      setCoverError("请先在「文案 JSON」中生成内容");
      return;
    }

    const parsed = parseImageModelValue(coverModelValue);
    if (!parsed) {
      setCoverError("请选择模型");
      return;
    }
    const chosenSize = coverSize || coverModelOption?.defaultSize || "1024x1024";
    const config = settings[parsed.providerId];
    if (!config.apiKey.trim()) {
      setCoverError("请先在 AI 设置中配置并保存 API Key");
      return;
    }
    setCoverLoading(true);
    try {
      const res = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: built.prompt,
          size: chosenSize,
          providerId: parsed.providerId,
          model: parsed.modelId,
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          imageGeneration: getImageGenerationConfig(config, parsed.modelId),
        }),
      });
      const data = (await res.json()) as {
        url?: string | null;
        b64Json?: string | null;
        error?: string;
      };
      if (!res.ok) {
        setCoverError(data.error ?? "生成封面失败");
        return;
      }
      const src = data.url ?? (data.b64Json ? `data:image/png;base64,${data.b64Json}` : "");
      if (!src) {
        setCoverError("未返回可预览的封面图");
        return;
      }
      setGeneratedCoverSrc(src);
    } catch (err) {
      setCoverError(err instanceof Error ? err.message : "网络错误，请重试");
    } finally {
      setCoverLoading(false);
    }
  }, [
    templateId,
    template,
    buildFinalPrompt,
    coverPrompt,
    coverAppendConfig,
    jsonData,
    coverModelValue,
    coverSize,
    coverModelOption,
    settings,
  ]);

  const handleDownload = useCallback((src: string, prefix: string) => {
    if (!src) return;
    const link = document.createElement("a");
    link.download = `${prefix}-${Date.now()}.png`;
    link.href = src;
    link.click();
  }, []);

  if (!mounted) {
    return (
      <div className="h-[420px] animate-pulse rounded-lg border bg-muted/40" />
    );
  }

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">图片生成</CardTitle>
          <CardDescription className="text-xs">
            选择模型、模板与图片选区，填写提示词后生成（预览与微调已移至「合成预览」板块）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {modelOptions.length === 0 && (
            <p className="text-xs text-muted-foreground">
              请先在{" "}
              <Link href="/ai-settings" className="text-primary hover:underline">
                AI 设置
              </Link>{" "}
              启用 Nano banana 或 OpenAI 并保存 API Key
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="img-template" className="text-xs">
              选择模板
            </Label>
            {templates.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                暂无模板。请先在{" "}
                <Link href="/image-edit" className="text-primary hover:underline">
                  图像编辑
                </Link>{" "}
                保存作品，并在画布中添加「图片选区」或图片图层。
              </p>
            ) : (
              <select
                id="img-template"
                value={templateId ?? ""}
                onChange={(e) => {
                  const id = e.target.value;
                  setTemplateId(id || null);
                  setZoneElementIndex(null);
                }}
                className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">请选择模板…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {template && zones.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="img-zone" className="text-xs">
                图片选区
              </Label>
              <select
                id="img-zone"
                value={zoneElementIndex ?? ""}
                onChange={(e) =>
                  setZoneElementIndex(
                    e.target.value === "" ? null : Number(e.target.value)
                  )
                }
                className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {zones.map((zone) => (
                  <option key={zone.elementIndex} value={zone.elementIndex}>
                    {zone.label}（{zone.width} × {zone.height}px）
                  </option>
                ))}
              </select>
            </div>
          )}

          {template && zones.length === 0 && (
            <p className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              该模板没有图片选区或图片图层。请在图像编辑中添加「图片选区」矩形或图片元素后重新保存模板。
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="img-prompt" className="text-xs">
              图片生成提示词
            </Label>
            <Textarea
              id="img-prompt"
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              rows={4}
              className="min-h-[96px] resize-y text-sm"
              placeholder="描述画面；启用追加文案后可用 {{JSON键名}} 插入字段，未使用的字段将追加到末尾"
            />
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="img-model" className="text-xs">
                图片模型
              </Label>
              <select
                id="img-model"
                value={imageModelValue}
                onChange={(e) => setImageModelValue(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {modelOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.providerName} · {opt.modelLabel}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="img-size" className="text-xs">
                图片分辨率
              </Label>
              <select
                id="img-size"
                value={imageSize}
                onChange={(e) => setImageSize(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {(imageModelOption?.sizes ?? []).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <PromptAppendSettings
            templateId={templateId}
            basePrompt={imagePrompt}
            config={imageAppendConfig}
            onChange={updateImageAppendConfig}
          />
          <div className="flex justify-end pt-1">
            <Button
              type="button"
              size="sm"
              onClick={handleGenerate}
              disabled={!canGenerateImage}
            >
              {imageLoading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              )}
              {imageLoading ? "图片生成中…" : "生成图片"}
            </Button>
          </div>
          {imageError && (
            <p className="text-xs text-destructive" role="alert">
              {imageError}
            </p>
          )}
          {!imageError && imageAppendConfig.enabled && imagePromptPreview.error && (
            <p className="text-xs text-destructive" role="status">
              图片提示词：{imagePromptPreview.error}
            </p>
          )}
          {!imageError &&
            imageAppendConfig.enabled &&
            imagePromptPreview.warnings?.map((w) => (
              <p
                key={w}
                className="text-xs text-amber-600 dark:text-amber-500"
                role="status"
              >
                图片提示词：{w}
              </p>
            ))}

          <div className="space-y-1.5 rounded-md border border-dashed bg-muted/10 p-3">
            <Label htmlFor="cover-prompt" className="text-xs">
              封面生成提示词
            </Label>
            <Textarea
              id="cover-prompt"
              value={coverPrompt}
              onChange={(e) => setCoverPrompt(e.target.value)}
              rows={4}
              className="min-h-[96px] resize-y text-sm"
              placeholder="封面单独提示词；可与图片生成提示词不同。"
            />
            <PromptAppendSettings
              templateId={templateId}
              basePrompt={coverPrompt}
              config={coverAppendConfig}
              onChange={updateCoverAppendConfig}
            />
            <div className="grid gap-2 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cover-model" className="text-xs">
                  封面模型
                </Label>
                <select
                  id="cover-model"
                  value={coverModelValue}
                  onChange={(e) => setCoverModelValue(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {modelOptions.map((opt) => (
                    <option key={`cover-${opt.value}`} value={opt.value}>
                      {opt.providerName} · {opt.modelLabel}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cover-size" className="text-xs">
                  封面分辨率
                </Label>
                <select
                  id="cover-size"
                  value={coverSize}
                  onChange={(e) => setCoverSize(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {(coverModelOption?.sizes ?? []).map((s) => (
                    <option key={`cover-size-${s}`} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGenerateCover}
                disabled={!canGenerateCover}
              >
                {coverLoading ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                )}
                {coverLoading ? "封面生成中…" : "生成封面"}
              </Button>
            </div>
            {coverError && (
              <p className="text-xs text-destructive" role="alert">
                {coverError}
              </p>
            )}
            {!coverError && coverAppendConfig.enabled && coverPromptPreview.error && (
              <p className="text-xs text-destructive" role="status">
                封面提示词：{coverPromptPreview.error}
              </p>
            )}
            {!coverError &&
              coverAppendConfig.enabled &&
              coverPromptPreview.warnings?.map((w) => (
                <p
                  key={`cover-${w}`}
                  className="text-xs text-amber-600 dark:text-amber-500"
                  role="status"
                >
                  封面提示词：{w}
                </p>
              ))}
          </div>

          {selectedZone && (
            <p className="text-[11px] text-muted-foreground">
              目标选区：{selectedZone.label}（{selectedZone.width} ×{" "}
              {selectedZone.height}px）
            </p>
          )}

        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">生成结果</CardTitle>
          <CardDescription className="text-xs">
            展示图片选区生成图与封面生成图（不再提供裁剪）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!generatedImageSrc && !generatedCoverSrc ? (
            <p className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              生成图片或封面后，这里会显示结果预览。
            </p>
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium">图片选区生成结果</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() => handleDownload(generatedImageSrc, "ai-zone")}
                      disabled={!generatedImageSrc}
                    >
                      <Download className="mr-1 h-3 w-3" />
                      下载
                    </Button>
                  </div>
                  <div className="overflow-hidden rounded-md border bg-muted/10">
                    {generatedImageSrc ? (
                      <img
                        src={generatedImageSrc}
                        alt="AI 选区生成预览"
                        className="max-h-[320px] w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-[220px] items-center justify-center text-xs text-muted-foreground">
                        暂无图片选区生成结果
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium">封面生成结果</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() => handleDownload(generatedCoverSrc, "ai-cover")}
                      disabled={!generatedCoverSrc}
                    >
                      <Download className="mr-1 h-3 w-3" />
                      下载
                    </Button>
                  </div>
                  <div className="overflow-hidden rounded-md border bg-muted/10">
                    {generatedCoverSrc ? (
                      <img
                        src={generatedCoverSrc}
                        alt="AI 封面预览"
                        className="max-h-[320px] w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-[220px] items-center justify-center text-xs text-muted-foreground">
                        暂无封面生成结果
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
