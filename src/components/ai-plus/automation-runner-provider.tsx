"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { buildDefaultSettings, loadAiSettingsFromStorage } from "@/lib/ai-providers";
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
  canContinueAutomationRun,
  firstResumableQueueIndex,
  isAutomationStepDone,
} from "@/lib/automation-run-utils";
import {
  AUTOMATION_MAX_RETRIES,
  buildDefaultAutomationSteps,
  buildQueueItems,
  createAutomationRun,
  parseTopicLines,
  type AutomationQueueItem,
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

interface AutomationRunnerContextValue {
  settings: AiSettingsStore;
  templates: SavedImageTemplate[];
  templateId: string;
  setTemplateId: (id: string) => void;
  topic: string;
  setTopic: (topic: string) => void;
  topicBatch: string;
  setTopicBatch: (text: string) => void;
  queueItems: AutomationQueueItem[];
  running: boolean;
  steps: AutomationStepRecord[];
  resultWorkId: string | null;
  globalError: string | null;
  totalDurationMs: number | null;
  savedRun: AutomationRunState | null;
  hydrated: boolean;
  selectedTemplate: SavedImageTemplate | null;
  showContinue: boolean;
  resumeStepLabel: string | null;
  runFresh: () => void;
  runContinue: () => void;
  resetRun: () => void;
  refreshTemplates: () => Promise<void>;
}

const AutomationRunnerContext = createContext<AutomationRunnerContextValue | null>(null);

export function useAutomationRunner(): AutomationRunnerContextValue {
  const ctx = useContext(AutomationRunnerContext);
  if (!ctx) {
    throw new Error("useAutomationRunner must be used within AutomationRunnerProvider");
  }
  return ctx;
}

export function AutomationRunnerProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AiSettingsStore>(buildDefaultSettings);
  const [templates, setTemplates] = useState<SavedImageTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [topic, setTopic] = useState("");
  const [topicBatch, setTopicBatch] = useState("");
  const [queueItems, setQueueItems] = useState<AutomationQueueItem[]>([]);
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
      setQueueItems([]);
      return;
    }
    setTemplateId(run.templateId);
    setTopic(run.topic);
    setQueueItems(run.queue ?? []);
    if (run.queue && run.queue.length > 0) {
      setTopicBatch(run.queue.map((item) => item.topic).join("\n"));
    }
    setSteps(run.steps);
    setResultWorkId(run.resultWorkId ?? null);
    setGlobalError(run.globalError ?? null);
    setTotalDurationMs(run.totalDurationMs ?? null);
  }, []);

  const refreshTemplates = useCallback(async () => {
    const list = await loadTemplateLibrary();
    setTemplates(list);
    return;
  }, []);

  useEffect(() => {
    void (async () => {
      const loaded = await loadAiSettingsFromStorage();
      setSettings(loaded);
    })();

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
    if (patch.queue !== undefined) setQueueItems(patch.queue ?? []);
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
      let lastError: unknown;
      for (let attempt = 0; attempt <= AUTOMATION_MAX_RETRIES; attempt++) {
        const start = performance.now();
        const isRetry = attempt > 0;
        await updateStep(stepId, {
          status: "running",
          error: isRetry ? `第 ${attempt} 次重试中…` : null,
          durationMs: null,
          retryCount: isRetry ? attempt : 0,
        });
        try {
          const result = await task();
          const duration = Math.round(performance.now() - start);
          await updateStep(stepId, {
            status: "success",
            durationMs: duration,
            error: null,
            retryCount: attempt,
          });
          return result;
        } catch (error) {
          lastError = error;
          const duration = Math.round(performance.now() - start);
          const message = error instanceof Error ? error.message : "步骤执行失败";
          if (attempt < AUTOMATION_MAX_RETRIES) {
            await updateStep(stepId, {
              status: "running",
              durationMs: duration,
              error: `${message}，即将重试 (${attempt + 1}/${AUTOMATION_MAX_RETRIES})`,
              retryCount: attempt + 1,
            });
            await new Promise((resolve) => setTimeout(resolve, 1500));
            continue;
          }
          await updateStep(stepId, {
            status: "error",
            durationMs: duration,
            error: `${message}（已重试 ${AUTOMATION_MAX_RETRIES} 次）`,
            retryCount: attempt,
          });
          throw error;
        }
      }
      throw lastError instanceof Error ? lastError : new Error("步骤执行失败");
    },
    [updateStep]
  );

  const executeAutomation = useCallback(
    async (mode: "fresh" | "continue") => {
      const currentSavedRun = runStateRef.current;
      const template =
        mode === "continue" && currentSavedRun
          ? templates.find((item) => item.id === currentSavedRun.templateId) ?? selectedTemplate
          : selectedTemplate;

      const batchTopics = parseTopicLines(topicBatch);
      const singleTopic = topic.trim();

      if (!template) {
        setGlobalError("请选择模板");
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

      let queue: AutomationQueueItem[] | undefined;
      let startIndex = 0;

      if (mode === "continue" && currentSavedRun?.queue && currentSavedRun.queue.length > 0) {
        queue = [...currentSavedRun.queue];
        startIndex = firstResumableQueueIndex(queue);
      } else {
        const topics = batchTopics.length > 0 ? batchTopics : singleTopic ? [singleTopic] : [];
        if (topics.length === 0) {
          setGlobalError("请输入主题或在队列中批量添加主题");
          return;
        }
        if (topics.length > 1) {
          queue = buildQueueItems(topics);
        }
        startIndex = 0;
      }

      const isQueueMode = (queue?.length ?? 0) > 1;
      const topicsToRun: Array<{ topic: string; queueIndex: number }> = isQueueMode
        ? queue!
            .map((item, index) => ({ topic: item.topic, queueIndex: index }))
            .slice(startIndex)
            .filter((_, offset) => {
              const item = queue![startIndex + offset];
              return item.status !== "completed";
            })
        : [
            {
              topic:
                mode === "continue" && currentSavedRun
                  ? currentSavedRun.topic
                  : batchTopics[0] ?? singleTopic,
              queueIndex: 0,
            },
          ];

      if (topicsToRun.length === 0) {
        setGlobalError("没有待执行的主题");
        return;
      }

      setRunning(true);
      const allStart = performance.now();

      const runSingleTopic = async (
        runTopic: string,
        topicMode: "fresh" | "continue",
        queueSnapshot?: AutomationQueueItem[]
      ) => {
        let runState: AutomationRunState;
        if (topicMode === "continue" && runStateRef.current?.topic === runTopic) {
          runState = {
            ...runStateRef.current,
            status: "running",
            globalError: null,
            updatedAt: Date.now(),
            queue: queueSnapshot,
          };
        } else {
          runState = createAutomationRun(template.id, runTopic, queueSnapshot);
        }

        runStateRef.current = runState;
        setSavedRun(runState);
        setSteps(runState.steps);
        setTopic(runTopic);
        setGlobalError(null);
        setResultWorkId(runState.resultWorkId ?? null);
        setTotalDurationMs(runState.totalDurationMs ?? null);
        if (queueSnapshot) setQueueItems(queueSnapshot);

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
        if (!isAutomationStepDone(getStepStatus("json"))) {
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
        if (!isAutomationStepDone(getStepStatus("image"))) {
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
        if (!isAutomationStepDone(getStepStatus("cover"))) {
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
        if (!isAutomationStepDone(getStepStatus("import"))) {
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
              jsonPromptConfig: template.jsonPromptConfig
                ? { ...template.jsonPromptConfig, topic: runTopic }
                : undefined,
              imagePromptConfig: template.imagePromptConfig,
            });
          });
          importedId = imported.id;
          await syncRunState({ resultWorkId: importedId });
        }

        setResultWorkId(importedId ?? null);
        return importedId ?? null;
      };

      try {
        let currentQueue = queue ? [...queue] : undefined;

        for (let i = 0; i < topicsToRun.length; i++) {
          const { topic: runTopic, queueIndex } = topicsToRun[i];
          const topicMode: "fresh" | "continue" =
            mode === "continue" && i === 0 && runStateRef.current?.topic === runTopic
              ? "continue"
              : "fresh";

          if (currentQueue) {
            currentQueue = currentQueue.map((item, idx) =>
              idx === queueIndex ? { ...item, status: "running", error: undefined } : item
            );
            setQueueItems(currentQueue);
            await syncRunState({ queue: currentQueue, topic: runTopic });
          }

          try {
            const workId = await runSingleTopic(runTopic, topicMode, currentQueue);
            if (currentQueue) {
              currentQueue = currentQueue.map((item, idx) =>
                idx === queueIndex
                  ? { ...item, status: "completed", resultWorkId: workId ?? undefined, error: undefined }
                  : item
              );
              setQueueItems(currentQueue);
              await syncRunState({ queue: currentQueue, status: "running" });
            } else {
              const duration = Math.round(performance.now() - allStart);
              setTotalDurationMs(duration);
              await syncRunState({
                status: "completed",
                totalDurationMs: duration,
                globalError: null,
              });
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : "自动化执行失败";
            if (currentQueue) {
              currentQueue = currentQueue.map((item, idx) =>
                idx === queueIndex ? { ...item, status: "failed", error: message } : item
              );
              setQueueItems(currentQueue);
              await syncRunState({
                queue: currentQueue,
                status: "running",
                globalError: message,
              });
              continue;
            }
            setGlobalError(message);
            await syncRunState({ status: "failed", globalError: message });
            return;
          }
        }

        if (currentQueue) {
          const duration = Math.round(performance.now() - allStart);
          const allCompleted = currentQueue.every((item) => item.status === "completed");
          const failedCount = currentQueue.filter((item) => item.status === "failed").length;
          setTotalDurationMs(duration);
          if (allCompleted) {
            await syncRunState({
              status: "completed",
              totalDurationMs: duration,
              globalError: null,
              queue: currentQueue,
            });
          } else if (failedCount > 0) {
            const lastSuccess = [...currentQueue].reverse().find((item) => item.resultWorkId);
            if (lastSuccess?.resultWorkId) setResultWorkId(lastSuccess.resultWorkId);
            await syncRunState({
              status: "failed",
              totalDurationMs: duration,
              globalError: `${failedCount} 个主题执行失败，已完成 ${currentQueue.length - failedCount} 个`,
              queue: currentQueue,
            });
          }
        }
      } finally {
        setRunning(false);
      }
    },
    [runStep, selectedTemplate, settings, syncRunState, templates, topic, topicBatch]
  );

  const runFresh = useCallback(() => {
    void executeAutomation("fresh");
  }, [executeAutomation]);

  const runContinue = useCallback(() => {
    void executeAutomation("continue");
  }, [executeAutomation]);

  const resetRun = useCallback(() => {
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
      setTopicBatch("");
      setQueueItems([]);
    })();
  }, [applyRunToUi, running, templates]);

  const resumeStepLabel = useMemo(() => {
    if (!savedRun) return null;
    const stepId = savedRun.steps.find((item) => !isAutomationStepDone(item.status))?.id;
    if (!stepId) return null;
    return savedRun.steps.find((step) => step.id === stepId)?.label ?? null;
  }, [savedRun]);

  const showContinue = !running && canContinueAutomationRun(savedRun);

  const value = useMemo<AutomationRunnerContextValue>(
    () => ({
      settings,
      templates,
      templateId,
      setTemplateId,
      topic,
      setTopic,
      topicBatch,
      setTopicBatch,
      queueItems,
      running,
      steps,
      resultWorkId,
      globalError,
      totalDurationMs,
      savedRun,
      hydrated,
      selectedTemplate,
      showContinue,
      resumeStepLabel,
      runFresh,
      runContinue,
      resetRun,
      refreshTemplates,
    }),
    [
      settings,
      templates,
      templateId,
      topic,
      topicBatch,
      queueItems,
      running,
      steps,
      resultWorkId,
      globalError,
      totalDurationMs,
      savedRun,
      hydrated,
      selectedTemplate,
      showContinue,
      resumeStepLabel,
      runFresh,
      runContinue,
      resetRun,
      refreshTemplates,
    ]
  );

  return (
    <AutomationRunnerContext.Provider value={value}>
      {children}
    </AutomationRunnerContext.Provider>
  );
}
