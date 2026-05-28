"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Play, RotateCcw, SkipForward, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AI_SETTINGS_STORAGE_KEY,
  buildDefaultSettings,
  mergeWithDefaults,
} from "@/lib/ai-providers";
import { getEnabledModelOptions, parseModelValue } from "@/lib/ai-models";
import { getEnabledImageModelOptions, parseImageModelValue } from "@/lib/ai-image-models";
import { getImageGenerationConfig } from "@/lib/gemini-image-models";
import { parseAiJsonOutput } from "@/lib/apply-ai-json-to-canvas";
import { composeAiPlusCanvasJson } from "@/lib/ai-plus-compose";
import { embedBlobUrlsInCanvasJson } from "@/lib/canvas-persist";
import { loadStoredKeyConfigs, mergeKeyConfigsWithElements, toKeyPayload } from "@/lib/ai-template-keys";
import { loadTemplateLibrary, saveTemplate } from "@/lib/image-templates";
import { getImageZonesForTemplate } from "@/lib/template-image-zones";
import {
  buildImagePromptWithAppend,
  migrateAppendConfig,
  type PromptAppendConfig,
} from "@/lib/ai-prompt-append";
import {
  loadAutomationRun,
  persistAutomationRun,
  resetAutomationRun,
} from "@/lib/automation-run-client";
import {
  buildDefaultAutomationSteps,
  createAutomationRun,
  type AutomationRunState,
  type AutomationStepId,
  type AutomationStepRecord,
  type AutomationStepStatus,
} from "@/types/automation-run";
import type { AiSettingsStore } from "@/types/ai";
import type { SavedImageTemplate } from "@/types/image-template";

interface GenerateImageResponse {
  url?: string | null;
  b64Json?: string | null;
  error?: string;
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function isStepDone(status: AutomationStepStatus): boolean {
  return status === "success";
}

function firstIncompleteStep(steps: AutomationStepRecord[]): AutomationStepId | null {
  const step = steps.find((item) => !isStepDone(item.status));
  return step?.id ?? null;
}

function canContinueRun(run: AutomationRunState | null): boolean {
  if (!run) return false;
  if (run.status === "completed") return false;
  return firstIncompleteStep(run.steps) !== null;
}

export function AutomationGeneratorPanel() {
  const [settings, setSettings] = useState<AiSettingsStore>(buildDefaultSettings);
  const [templates, setTemplates] = useState<SavedImageTemplate[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [topic, setTopic] = useState("");
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<AutomationStepRecord[]>(buildDefaultAutomationSteps);
  const [resultWorkId, setResultWorkId] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [totalDurationMs, setTotalDurationMs] = useState<number | null>(null);
  const [savedRun, setSavedRun] = useState<AutomationRunState | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const runStateRef = useRef<AutomationRunState | null>(null);

  const applyRunToUi = useCallback((run: AutomationRunState | null) => {
    setSavedRun(run);
    runStateRef.current = run;
    if (!run) {
      setSteps(buildDefaultAutomationSteps());
      setResultWorkId(null);
      setGlobalError(null);
      setTotalDurationMs(null);
      return;
    }
    setTemplateId(run.templateId);
    setTopic(run.topic);
    setSteps(run.steps);
    setResultWorkId(run.resultWorkId ?? null);
    setGlobalError(run.globalError ?? null);
    setTotalDurationMs(run.totalDurationMs ?? null);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
      if (raw) {
        setSettings(mergeWithDefaults(JSON.parse(raw) as Partial<AiSettingsStore>));
      }
    } catch {
      /* ignore */
    }

    void (async () => {
      const [list, run] = await Promise.all([loadTemplateLibrary(), loadAutomationRun()]);
      setTemplates(list);
      if (run) {
        applyRunToUi(run);
      } else if (list.length > 0) {
        setTemplateId((prev) => prev || list[0].id);
      }
      setHydrated(true);
    })();
  }, [applyRunToUi]);

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.id === templateId) ?? null,
    [templates, templateId]
  );

  const syncRunState = useCallback(async (patch: Partial<AutomationRunState>) => {
    const current = runStateRef.current;
    if (!current) return null;
    const next: AutomationRunState = {
      ...current,
      ...patch,
      updatedAt: Date.now(),
    };
    runStateRef.current = next;
    setSavedRun(next);
    setSteps(next.steps);
    if (patch.resultWorkId !== undefined) setResultWorkId(patch.resultWorkId ?? null);
    if (patch.globalError !== undefined) setGlobalError(patch.globalError ?? null);
    if (patch.totalDurationMs !== undefined) setTotalDurationMs(patch.totalDurationMs ?? null);
    try {
      const persisted = await persistAutomationRun(next);
      runStateRef.current = persisted;
      setSavedRun(persisted);
      return persisted;
    } catch {
      return next;
    }
  }, []);

  const updateStep = useCallback(
    async (
      stepId: AutomationStepId,
      patch: Partial<AutomationStepRecord>
    ): Promise<AutomationRunState | null> => {
      const current = runStateRef.current;
      if (!current) return null;
      const stepsNext = current.steps.map((step) =>
        step.id === stepId ? { ...step, ...patch } : step
      );
      return syncRunState({ steps: stepsNext });
    },
    [syncRunState]
  );

  const runStep = useCallback(
    async <T,>(stepId: AutomationStepId, task: () => Promise<T>): Promise<T> => {
      const start = performance.now();
      await updateStep(stepId, { status: "running", error: null, durationMs: null });
      try {
        const result = await task();
        const duration = Math.round(performance.now() - start);
        await updateStep(stepId, { status: "success", durationMs: duration, error: null });
        return result;
      } catch (error) {
        const duration = Math.round(performance.now() - start);
        const message = error instanceof Error ? error.message : "步骤执行失败";
        await updateStep(stepId, { status: "error", durationMs: duration, error: message });
        throw error;
      }
    },
    [updateStep]
  );

  const executeAutomation = useCallback(
    async (mode: "fresh" | "continue") => {
      const template =
        mode === "continue" && savedRun
          ? templates.find((item) => item.id === savedRun.templateId) ?? selectedTemplate
          : selectedTemplate;

      const runTopic =
        mode === "continue" && savedRun ? savedRun.topic : topic.trim();

      if (!template) {
        setGlobalError("请选择模板");
        return;
      }
      if (!runTopic) {
        setGlobalError("请输入主题");
        return;
      }

      const jsonModelOptions = getEnabledModelOptions(settings);
      const imageModelOptions = getEnabledImageModelOptions(settings);
      const chosenJsonModelValue =
        jsonModelOptions.length > 0 ? jsonModelOptions[0].value : "";
      const chosenImageModelValue =
        template.imagePromptConfig?.imageModelValue &&
        imageModelOptions.some((opt) => opt.value === template.imagePromptConfig?.imageModelValue)
          ? template.imagePromptConfig.imageModelValue
          : imageModelOptions.length > 0
            ? imageModelOptions[0].value
            : "";
      const chosenCoverModelValue =
        template.imagePromptConfig?.coverModelValue &&
        imageModelOptions.some((opt) => opt.value === template.imagePromptConfig?.coverModelValue)
          ? template.imagePromptConfig.coverModelValue
          : chosenImageModelValue;

      if (!chosenJsonModelValue) {
        setGlobalError("未找到可用文本模型，请先在 AI 设置中启用并配置");
        return;
      }
      if (!chosenImageModelValue || !chosenCoverModelValue) {
        setGlobalError("未找到可用图片模型，请先在 AI 设置中启用并配置");
        return;
      }

      const parsedJsonModel = parseModelValue(chosenJsonModelValue);
      const parsedImageModel = parseImageModelValue(chosenImageModelValue);
      const parsedCoverModel = parseImageModelValue(chosenCoverModelValue);

      if (!parsedJsonModel || !parsedImageModel || !parsedCoverModel) {
        setGlobalError("模型解析失败，请检查 AI 设置");
        return;
      }

      const jsonProviderConfig = settings[parsedJsonModel.providerId];
      const imageProviderConfig = settings[parsedImageModel.providerId];
      const coverProviderConfig = settings[parsedCoverModel.providerId];
      if (!jsonProviderConfig.apiKey.trim() || !jsonProviderConfig.baseUrl.trim()) {
        setGlobalError("文本模型未配置 API Key 或 API 地址");
        return;
      }
      if (!imageProviderConfig.apiKey.trim() || !imageProviderConfig.baseUrl.trim()) {
        setGlobalError("图片模型未配置 API Key 或 API 地址");
        return;
      }
      if (!coverProviderConfig.apiKey.trim() || !coverProviderConfig.baseUrl.trim()) {
        setGlobalError("封面模型未配置 API Key 或 API 地址");
        return;
      }

      let runState: AutomationRunState;
      if (mode === "continue" && savedRun) {
        runState = {
          ...savedRun,
          status: "running",
          globalError: null,
          updatedAt: Date.now(),
        };
      } else {
        runState = createAutomationRun(template.id, runTopic);
      }

      runStateRef.current = runState;
      setSavedRun(runState);
      setSteps(runState.steps);
      setGlobalError(null);
      setResultWorkId(runState.resultWorkId ?? null);
      setTotalDurationMs(runState.totalDurationMs ?? null);

      const allStart = performance.now();
      setRunning(true);

      try {
        await persistAutomationRun(runState);

        const getStepStatus = (stepId: AutomationStepId): AutomationStepStatus =>
          runStateRef.current?.steps.find((step) => step.id === stepId)?.status ?? "pending";

        const getRunArtifacts = () => runStateRef.current ?? runState;

        const keyConfigs = mergeKeyConfigsWithElements(
          template.elements,
          template.jsonPromptConfig?.keyConfigs ?? loadStoredKeyConfigs(template.id)
        );
        const zones = getImageZonesForTemplate(template);
        const zone = zones[0] ?? null;
        if (!zone) {
          throw new Error("模板缺少图片选区，无法自动生成主图");
        }

        let jsonText = getRunArtifacts().jsonText;
        if (!isStepDone(getStepStatus("json"))) {
          jsonText = await runStep("json", async () => {
            const res = await fetch("/api/ai/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                topic: runTopic,
                systemPrompt: template.jsonPromptConfig?.systemPrompt ?? "",
                templateKeys: toKeyPayload(keyConfigs),
                structuredJson: true,
                stream: false,
                providerId: parsedJsonModel.providerId,
                model: parsedJsonModel.modelId,
                apiKey: jsonProviderConfig.apiKey,
                baseUrl: jsonProviderConfig.baseUrl,
                temperature: jsonProviderConfig.temperature,
              }),
            });
            const data = (await res.json()) as { content?: string; error?: string };
            if (!res.ok || !data.content) {
              throw new Error(data.error ?? "文案 JSON 生成失败");
            }
            return data.content;
          });
          await syncRunState({ jsonText });
        }

        const aiJson = parseAiJsonOutput(jsonText ?? "");
        if (!aiJson) {
          throw new Error("文案 JSON 解析失败，请调整模板键配置");
        }

        const imagePromptConfig = template.imagePromptConfig;
        const imageAppendConfig: PromptAppendConfig = migrateAppendConfig({
          appendEnabled: imagePromptConfig?.imageAppendEnabled,
          appendSelectedKeys: imagePromptConfig?.imageAppendSelectedKeys,
        });
        const coverAppendConfig: PromptAppendConfig = migrateAppendConfig({
          appendEnabled: imagePromptConfig?.coverAppendEnabled,
          appendSelectedKeys: imagePromptConfig?.coverAppendSelectedKeys,
        });

        const finalImagePrompt = buildImagePromptWithAppend(
          imagePromptConfig?.imagePrompt ?? "",
          imageAppendConfig,
          aiJson
        );
        if (!finalImagePrompt.prompt.trim()) {
          throw new Error(finalImagePrompt.error ?? "模板未配置主图提示词");
        }

        const finalCoverPrompt = buildImagePromptWithAppend(
          imagePromptConfig?.coverPrompt ?? "",
          coverAppendConfig,
          aiJson
        );
        if (!finalCoverPrompt.prompt.trim()) {
          throw new Error(finalCoverPrompt.error ?? "模板未配置封面提示词");
        }

        let generatedImageSrc = getRunArtifacts().generatedImageSrc;
        if (!isStepDone(getStepStatus("image"))) {
          generatedImageSrc = await runStep("image", async () => {
            const res = await fetch("/api/ai/generate-image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt: finalImagePrompt.prompt,
                size: imagePromptConfig?.imageSize ?? "1024x1024",
                providerId: parsedImageModel.providerId,
                model: parsedImageModel.modelId,
                apiKey: imageProviderConfig.apiKey,
                baseUrl: imageProviderConfig.baseUrl,
                imageGeneration: getImageGenerationConfig(
                  imageProviderConfig,
                  parsedImageModel.modelId
                ),
              }),
            });
            const data = (await res.json()) as GenerateImageResponse;
            if (!res.ok) {
              throw new Error(data.error ?? "主图生成失败");
            }
            const src =
              data.url ?? (data.b64Json ? `data:image/png;base64,${data.b64Json}` : "");
            if (!src) throw new Error("主图未返回可用图片");
            return src;
          });
          await syncRunState({ generatedImageSrc });
        }

        let generatedCoverSrc = getRunArtifacts().generatedCoverSrc;
        if (!isStepDone(getStepStatus("cover"))) {
          generatedCoverSrc = await runStep("cover", async () => {
            const res = await fetch("/api/ai/generate-image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt: finalCoverPrompt.prompt,
                size: imagePromptConfig?.coverSize ?? "1024x1024",
                providerId: parsedCoverModel.providerId,
                model: parsedCoverModel.modelId,
                apiKey: coverProviderConfig.apiKey,
                baseUrl: coverProviderConfig.baseUrl,
                imageGeneration: getImageGenerationConfig(
                  coverProviderConfig,
                  parsedCoverModel.modelId
                ),
              }),
            });
            const data = (await res.json()) as GenerateImageResponse;
            if (!res.ok) {
              throw new Error(data.error ?? "封面生成失败");
            }
            const src =
              data.url ?? (data.b64Json ? `data:image/png;base64,${data.b64Json}` : "");
            if (!src) throw new Error("封面未返回可用图片");
            return src;
          });
          await syncRunState({ generatedCoverSrc });
        }

        if (!generatedImageSrc) {
          throw new Error("缺少主图结果，无法继续导入");
        }

        let importedId = getRunArtifacts().resultWorkId;
        if (!isStepDone(getStepStatus("import"))) {
          const imported = await runStep("import", async () => {
            const composed = await composeAiPlusCanvasJson({
              template,
              keyConfigs,
              aiJson,
              zone,
              generatedImageSrc,
            });
            const embedded = await embedBlobUrlsInCanvasJson(composed);
            return saveTemplate({
              canvasSize: template.canvasSize,
              json: embedded,
              name: `${template.name} - ${runTopic}（自动化）`,
              thumbnail: generatedCoverSrc,
              recordType: "work",
            });
          });
          importedId = imported.id;
          await syncRunState({ resultWorkId: importedId });
        }

        const duration = Math.round(performance.now() - allStart);
        setResultWorkId(importedId ?? null);
        setTotalDurationMs(duration);
        await syncRunState({
          status: "completed",
          resultWorkId: importedId,
          totalDurationMs: duration,
          globalError: null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "自动化执行失败";
        setGlobalError(message);
        await syncRunState({
          status: "failed",
          globalError: message,
        });
      } finally {
        setRunning(false);
      }
    },
    [runStep, savedRun, selectedTemplate, settings, syncRunState, templates, topic]
  );

  const handleRun = useCallback(() => {
    void executeAutomation("fresh");
  }, [executeAutomation]);

  const handleContinue = useCallback(() => {
    void executeAutomation("continue");
  }, [executeAutomation]);

  const handleReset = useCallback(() => {
    void (async () => {
      if (running) return;
      if (!confirm("确定重置自动化进度？已保存的中间结果将被清除。")) return;
      try {
        await resetAutomationRun();
      } catch {
        /* ignore */
      }
      applyRunToUi(null);
      setTemplateId((prev) => prev || templates[0]?.id || "");
      setTopic("");
    })();
  }, [applyRunToUi, running, templates]);

  const resumeStepLabel = useMemo(() => {
    if (!savedRun) return null;
    const stepId = firstIncompleteStep(savedRun.steps);
    if (!stepId) return null;
    return savedRun.steps.find((step) => step.id === stepId)?.label ?? null;
  }, [savedRun]);

  const showContinue = !running && canContinueRun(savedRun);

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">自动化模块</CardTitle>
          <CardDescription className="text-xs">
            选择模板并输入主题后，自动按顺序完成文案、主图、封面与作品导入；失败后可继续执行
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="automation-template" className="text-xs">
              选择模板
            </Label>
            <select
              id="automation-template"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              disabled={running}
              className="flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            >
              {templates.length === 0 ? (
                <option value="">暂无模板</option>
              ) : (
                templates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="automation-topic" className="text-xs">
              主题
            </Label>
            <Input
              id="automation-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={running}
              placeholder="例如：初夏轻医美科普海报"
            />
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            {showContinue && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleContinue}
                disabled={running || !hydrated}
              >
                <SkipForward className="mr-1.5 h-3.5 w-3.5" />
                {resumeStepLabel ? `继续：${resumeStepLabel}` : "继续执行"}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleReset}
              disabled={running || !hydrated}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              重置进度
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleRun}
              disabled={running || !templateId || !topic.trim() || !hydrated}
            >
              {running ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="mr-1.5 h-3.5 w-3.5" />
              )}
              {running ? "自动化执行中…" : "开始自动化"}
            </Button>
          </div>

          {savedRun && savedRun.status !== "completed" && (
            <p className="text-xs text-muted-foreground">
              后端已保存执行进度（{savedRun.status === "failed" ? "上次失败" : "进行中"}），刷新页面后仍可继续。
            </p>
          )}

          {globalError && (
            <p className="text-xs text-destructive" role="alert">
              {globalError}
            </p>
          )}
          {resultWorkId && (
            <p className="text-xs text-emerald-600 dark:text-emerald-500">
              自动导入完成，作品已进入作品管理。
              <Link href={`/image-edit?templateId=${resultWorkId}`} className="ml-1 underline">
                打开作品
              </Link>
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">执行进度</CardTitle>
          <CardDescription className="text-xs">
            串行执行，前一步成功后才会进入下一步；每步状态会自动保存到后端
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {steps.map((step) => (
            <div
              key={step.id}
              className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                {step.status === "running" && (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                )}
                {step.status === "success" && (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-500" />
                )}
                {step.status === "error" && (
                  <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                )}
                {step.status === "pending" && (
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-muted-foreground/50" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm">{step.label}</p>
                  {step.error && (
                    <p className="truncate text-xs text-destructive">{step.error}</p>
                  )}
                </div>
              </div>
              <p className="shrink-0 text-xs text-muted-foreground">
                {step.status === "pending"
                  ? "待执行"
                  : step.status === "running"
                    ? "执行中"
                    : formatDuration(step.durationMs)}
              </p>
            </div>
          ))}
          <div className="pt-1 text-right text-xs text-muted-foreground">
            总耗时：{formatDuration(totalDurationMs)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
