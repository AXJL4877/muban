"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Download, ImageIcon, Loader2, Pencil, PencilOff, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  AI_SETTINGS_STORAGE_KEY,
  buildDefaultSettings,
  mergeWithDefaults,
} from "@/lib/ai-providers";
import {
  getEnabledImageModelOptions,
  getImageModelOption,
  parseImageModelValue,
  pickAspectRatioForZone,
  pickSizeForZone,
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
import {
  loadStoredKeyConfigs,
  mergeKeyConfigsWithElements,
} from "@/lib/ai-template-keys";
import { getTemplateById, loadTemplates } from "@/lib/image-templates";
import { getImageZonesForTemplate } from "@/lib/template-image-zones";
import { PromptAppendSettings } from "@/components/ai-plus/prompt-append-settings";
import {
  TemplateImagePreview,
  type TemplateImagePreviewHandle,
} from "@/components/ai-plus/template-image-preview";
import type { AiSettingsStore } from "@/types/ai";
import type { SavedImageTemplate } from "@/types/image-template";

export function ImageGeneratorPanel() {
  const [settings, setSettings] = useState<AiSettingsStore>(buildDefaultSettings);
  const [mounted, setMounted] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const [templates, setTemplates] = useState<SavedImageTemplate[]>([]);
  const [modelValue, setModelValue] = useState("");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [zoneElementIndex, setZoneElementIndex] = useState<number | null>(null);
  const [prompt, setPrompt] = useState("");
  const [appendConfig, setAppendConfig] = useState<PromptAppendConfig>(
    DEFAULT_PROMPT_APPEND_CONFIG
  );
  const [generatedImageSrc, setGeneratedImageSrc] = useState("");
  const [previewEditable, setPreviewEditable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewRef = useRef<TemplateImagePreviewHandle>(null);

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
    setModelValue(saved.modelValue);
    setTemplateId(saved.templateId);
    setZoneElementIndex(saved.zoneElementIndex);
    setPrompt(saved.prompt);
    setGeneratedImageSrc(saved.lastPreviewUrl);
    setAppendConfig(
      migrateAppendConfig({
        appendEnabled: saved.appendEnabled,
        appendJsonKey: saved.appendJsonKey,
        appendSelectedKeys: saved.appendSelectedKeys,
      })
    );

    setTemplates(loadTemplates());
    setMounted(true);
    setHydrated(true);
  }, []);

  const template = useMemo(
    () => (templateId ? getTemplateById(templateId) : undefined),
    [templateId, templates]
  );

  const zones = useMemo(
    () => (template ? getImageZonesForTemplate(template) : []),
    [template]
  );

  const selectedZone = useMemo(
    () => zones.find((z) => z.elementIndex === zoneElementIndex) ?? null,
    [zones, zoneElementIndex]
  );

  useEffect(() => {
    setPreviewEditable(false);
  }, [templateId]);

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
    setAppendConfig((prev) => {
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

  const keyConfigs = useMemo(() => {
    if (!template) return [];
    return mergeKeyConfigsWithElements(
      template.elements,
      templateId ? loadStoredKeyConfigs(templateId) : undefined
    );
  }, [template, templateId]);

  const finalPromptPreview = useMemo(
    () => buildImagePromptWithAppend(prompt, appendConfig, jsonData),
    [prompt, appendConfig, jsonData]
  );

  const persistState = useCallback(() => {
    if (!hydrated) return;
    const state: AiPlusImagePersistedState = {
      modelValue,
      templateId,
      zoneElementIndex,
      prompt,
      lastPreviewUrl: generatedImageSrc,
      appendEnabled: appendConfig.enabled,
      appendSelectedKeys: appendConfig.selectedKeys,
    };
    saveAiPlusImageState(state);
  }, [
    hydrated,
    modelValue,
    templateId,
    zoneElementIndex,
    prompt,
    generatedImageSrc,
    appendConfig,
  ]);

  useEffect(() => {
    if (!hydrated) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(persistState, 280);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [hydrated, persistState]);

  const modelOptions = useMemo(
    () => getEnabledImageModelOptions(settings),
    [settings]
  );

  useEffect(() => {
    if (!hydrated || modelOptions.length === 0) return;
    if (!modelOptions.some((o) => o.value === modelValue)) {
      setModelValue(modelOptions[0].value);
    }
  }, [hydrated, modelOptions, modelValue]);

  const updateAppendConfig = useCallback((patch: Partial<PromptAppendConfig>) => {
    setAppendConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const canGenerate = useMemo(() => {
    if (loading || modelOptions.length === 0 || !templateId || !selectedZone) {
      return false;
    }
    if (appendConfig.enabled) {
      if (!jsonData || appendConfig.selectedKeys.length === 0) return false;
    }
    const built = buildImagePromptWithAppend(prompt, appendConfig, jsonData);
    return !!built.prompt.trim();
  }, [
    loading,
    modelOptions.length,
    templateId,
    selectedZone,
    prompt,
    appendConfig,
    jsonData,
  ]);

  const handleGenerate = useCallback(async () => {
    setError(null);

    if (!templateId) {
      setError("请选择模板");
      return;
    }
    if (!selectedZone) {
      setError("请选择图片选区");
      return;
    }

    const built = buildImagePromptWithAppend(prompt, appendConfig, jsonData);
    if (built.error && !built.prompt.trim()) {
      setError(built.error);
      return;
    }
    if (!built.prompt.trim()) {
      setError("请输入提示词或启用追加文案 JSON");
      return;
    }
    if (appendConfig.enabled && appendConfig.selectedKeys.length === 0) {
      setError("请至少选择一个文本块字段");
      return;
    }
    if (appendConfig.enabled && !jsonData) {
      setError("请先在「文案 JSON」中生成内容");
      return;
    }

    const parsed = parseImageModelValue(modelValue);
    if (!parsed) {
      setError("请选择模型");
      return;
    }

    const modelOpt = getImageModelOption(modelValue);
    const useAspectRatio = modelOpt?.sizeMode === "aspectRatio";
    const size = modelOpt
      ? useAspectRatio
        ? pickAspectRatioForZone(
            modelOpt.sizes,
            selectedZone.width,
            selectedZone.height,
            modelOpt.defaultSize
          )
        : pickSizeForZone(
            modelOpt.sizes,
            selectedZone.width,
            selectedZone.height,
            modelOpt.defaultSize
          )
      : "1024x1024";

    const config = settings[parsed.providerId];
    if (!config.apiKey.trim()) {
      setError("请先在 AI 设置中配置并保存 API Key");
      return;
    }

    setLoading(true);
    setPreviewEditable(false);

    try {
      const res = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: built.prompt,
          size,
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
        setError(data.error ?? "生成失败");
        return;
      }

      const src = data.url ?? (data.b64Json ? `data:image/png;base64,${data.b64Json}` : "");
      if (!src) {
        setError("未返回可预览的图片");
        return;
      }
      setGeneratedImageSrc(src);
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }, [
    templateId,
    selectedZone,
    prompt,
    appendConfig,
    jsonData,
    modelValue,
    settings,
  ]);

  const handleDownload = useCallback(() => {
    const dataUrl = previewRef.current?.toDataURL() ?? generatedImageSrc;
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${template?.name ?? "template"}-${Date.now()}.png`;
    a.rel = "noopener";
    a.click();
  }, [generatedImageSrc, template?.name]);

  if (!mounted) {
    return (
      <div className="h-[420px] animate-pulse rounded-lg border bg-muted/40" />
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">图片生成</CardTitle>
          <CardDescription className="text-xs">
            选择模型、模板与图片选区，填写提示词后生成
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="img-model" className="text-xs">
              生图模型
            </Label>
            {modelOptions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                请先在{" "}
                <Link href="/ai-settings" className="text-primary hover:underline">
                  AI 设置
                </Link>{" "}
                启用 Nano banana 或 OpenAI 并保存 API Key
              </p>
            ) : (
              <select
                id="img-model"
                value={modelValue}
                onChange={(e) => setModelValue(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {modelOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.providerName} · {opt.modelLabel}
                  </option>
                ))}
              </select>
            )}
          </div>

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
              提示词
            </Label>
            <Textarea
              id="img-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="min-h-[96px] resize-y text-sm"
              placeholder="描述画面；启用追加文案后可用 {{JSON键名}} 插入字段，未使用的字段将追加到末尾"
            />
          </div>

          <PromptAppendSettings
            templateId={templateId}
            basePrompt={prompt}
            config={appendConfig}
            onChange={updateAppendConfig}
          />

          {selectedZone && (
            <p className="text-[11px] text-muted-foreground">
              目标选区：{selectedZone.label}（{selectedZone.width} ×{" "}
              {selectedZone.height}px）
            </p>
          )}

          <div className="flex justify-end pt-1">
            <Button
              type="button"
              size="sm"
              onClick={handleGenerate}
              disabled={!canGenerate}
            >
              {loading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              )}
              {loading ? "生成中…" : "生成图片"}
            </Button>
          </div>

          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
          {!error && appendConfig.enabled && finalPromptPreview.error && (
            <p className="text-xs text-destructive" role="status">
              {finalPromptPreview.error}
            </p>
          )}
          {!error &&
            appendConfig.enabled &&
            finalPromptPreview.warnings?.map((w) => (
              <p
                key={w}
                className="text-xs text-amber-600 dark:text-amber-500"
                role="status"
              >
                {w}
              </p>
            ))}
        </CardContent>
      </Card>

      <Card className="flex flex-col">
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base">输出预览</CardTitle>
              <CardDescription className="mt-0.5 text-xs">
                {loading
                  ? "正在生成并合成到模板…"
                  : previewEditable
                    ? "编辑模式：可拖动调整元素"
                    : generatedImageSrc
                      ? "只读预览，点击铅笔图标进入编辑"
                      : template
                        ? "完整模板预览，生成后将填入所选图片选区"
                        : "选择模板后在此预览"}
              </CardDescription>
            </div>
            {template && !loading && (
              <Button
                type="button"
                variant={previewEditable ? "default" : "outline"}
                size="icon"
                className="h-8 w-8 shrink-0"
                title={previewEditable ? "退出编辑" : "编辑预览"}
                aria-label={previewEditable ? "退出编辑" : "编辑预览"}
                aria-pressed={previewEditable}
                onClick={() => setPreviewEditable((v) => !v)}
              >
                {previewEditable ? (
                  <PencilOff className="h-3.5 w-3.5" />
                ) : (
                  <Pencil className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
          </div>
          {template && generatedImageSrc && !loading && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 text-xs"
              onClick={handleDownload}
            >
              <Download className="mr-1 h-3 w-3" />
              下载
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col pb-4">
          <div
            className={cn(
              "relative flex min-h-[360px] flex-1 items-center justify-center overflow-auto rounded-md border bg-muted/20 p-2",
              generatedImageSrc && "border-primary/20"
            )}
          >
            {template ? (
              <>
                <TemplateImagePreview
                  ref={previewRef}
                  template={template}
                  zone={selectedZone}
                  generatedImageSrc={generatedImageSrc || null}
                  aiJson={jsonData}
                  keyConfigs={keyConfigs}
                  editable={previewEditable}
                  className={cn(loading && "opacity-60")}
                />
                {loading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/50 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="text-xs">生成中，请稍候…</span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 px-4 text-center text-muted-foreground">
                <ImageIcon className="h-10 w-10 opacity-40" />
                <span className="text-xs">
                  选择模板与选区，填写提示词后点击「生成图片」
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
