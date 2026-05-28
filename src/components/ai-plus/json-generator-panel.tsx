"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Braces,
  Brain,
  Copy,
  ExternalLink,
  Loader2,
  Radio,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  applyAiJsonToCanvas,
  parseAiJsonOutput,
  stashAiCanvasImport,
} from "@/lib/apply-ai-json-to-canvas";
import { embedBlobUrlsInCanvasJson } from "@/lib/canvas-persist";
import {
  AI_SETTINGS_STORAGE_KEY,
  buildDefaultSettings,
  mergeWithDefaults,
} from "@/lib/ai-providers";
import { formatJsonPreview } from "@/lib/ai-chat";
import type { ReasoningEffort } from "@/lib/ai-chat";
import { consumeChatSSE } from "@/lib/ai-stream-client";
import { getEnabledModelOptions, parseModelValue } from "@/lib/ai-models";
import {
  loadAiPlusState,
  saveAiPlusState,
  type AiPlusPersistedState,
} from "@/lib/ai-plus-storage";
import { getTemplateById, updateTemplatePromptConfig } from "@/lib/image-templates";
import {
  loadStoredKeyConfigs,
  mergeKeyConfigsWithElements,
  saveStoredKeyConfigs,
  toKeyPayload,
  validateKeyConfigs,
} from "@/lib/ai-template-keys";
import { IconToggle } from "@/components/ai-plus/icon-toggle";
import { TemplateKeysEditor } from "@/components/ai-plus/template-keys-editor";
import type { AiSettingsStore } from "@/types/ai";
import type { TemplateJsonKeyConfig } from "@/types/ai-template-keys";

const DEFAULT_YIMEI_SYSTEM_PROMPT =
  "你是资深医美内容策划，请基于模板键名输出准确、可落地、合规的营销文案。语气专业但亲和，避免夸大承诺。";

function applyYimeiDefaultInstructions(
  configs: TemplateJsonKeyConfig[]
): TemplateJsonKeyConfig[] {
  return configs.map((item) => {
    if (item.key === "title") {
      return {
        ...item,
        instruction:
          item.instruction.trim() ||
          "生成吸引人的医美主题标题，突出项目亮点与用户收益，避免夸张表述。",
        minChars: item.minChars ?? 8,
        maxChars: item.maxChars ?? 18,
      };
    }
    if (item.key === "answer") {
      return {
        ...item,
        instruction:
          item.instruction.trim() ||
          "生成主体说明文案，包含适用人群、核心效果、注意事项，表达清晰可信。",
        minChars: item.minChars ?? 60,
        maxChars: item.maxChars ?? 180,
      };
    }
    return item;
  });
}

export function JsonGeneratorPanel() {
  const router = useRouter();
  const [settings, setSettings] = useState<AiSettingsStore>(buildDefaultSettings);
  const [mounted, setMounted] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const [modelValue, setModelValue] = useState("");
  const [topic, setTopic] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [keyConfigs, setKeyConfigs] = useState<TemplateJsonKeyConfig[]>([]);
  const [structuredJson, setStructuredJson] = useState(true);
  const [streamEnabled, setStreamEnabled] = useState(true);
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [reasoningEffort, setReasoningEffort] =
    useState<ReasoningEffort>("high");
  const [output, setOutput] = useState("");
  const [reasoningOutput, setReasoningOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

    const saved = loadAiPlusState();
    setTopic(saved.topic);
    setSystemPrompt(saved.systemPrompt);
    setTemplateId(saved.templateId);
    setModelValue(saved.modelValue);
    setStructuredJson(saved.structuredJson);
    setStreamEnabled(saved.streamEnabled);
    setThinkingEnabled(saved.thinkingEnabled);
    setReasoningEffort(saved.reasoningEffort);
    setOutput(saved.lastOutput);
    setReasoningOutput(saved.lastReasoning);

    void (async () => {
      if (saved.templateId) {
        const template = await getTemplateById(saved.templateId);
        if (template) {
          const stored =
            template.jsonPromptConfig?.keyConfigs ??
            loadStoredKeyConfigs(saved.templateId);
          const merged = mergeKeyConfigsWithElements(template.elements, stored);
          if (template.jsonPromptConfig?.topic?.trim()) {
            setTopic(template.jsonPromptConfig.topic);
          }
          if (template.jsonPromptConfig?.systemPrompt?.trim()) {
            setSystemPrompt(template.jsonPromptConfig.systemPrompt);
          }
          if (template.name.includes("医美")) {
            const next = applyYimeiDefaultInstructions(merged);
            setKeyConfigs(next);
            saveStoredKeyConfigs(saved.templateId, next);
            if (!saved.systemPrompt.trim()) {
              setSystemPrompt(DEFAULT_YIMEI_SYSTEM_PROMPT);
            }
          } else {
            setKeyConfigs(merged);
          }
        }
      }
      setMounted(true);
      setHydrated(true);
    })();
  }, []);

  const persistState = useCallback(() => {
    if (!hydrated) return;
    const state: AiPlusPersistedState = {
      topic,
      systemPrompt,
      templateId,
      modelValue,
      structuredJson,
      streamEnabled,
      thinkingEnabled,
      reasoningEffort,
      lastOutput: output,
      lastReasoning: reasoningOutput,
    };
    saveAiPlusState(state);
  }, [
    hydrated,
    topic,
    systemPrompt,
    templateId,
    modelValue,
    structuredJson,
    streamEnabled,
    thinkingEnabled,
    reasoningEffort,
    output,
    reasoningOutput,
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
    void (async () => {
      const template = await getTemplateById(templateId);
      if (!template) return;
      const stored =
        template.jsonPromptConfig?.keyConfigs ?? loadStoredKeyConfigs(templateId);
      setKeyConfigs(mergeKeyConfigsWithElements(template.elements, stored));
      if (template.jsonPromptConfig?.topic != null) {
        setTopic(template.jsonPromptConfig.topic);
      }
      if (template.jsonPromptConfig?.systemPrompt != null) {
        setSystemPrompt(template.jsonPromptConfig.systemPrompt);
      }
    })();
  }, [hydrated, templateId]);

  useEffect(() => {
    if (!hydrated || !templateId) return;
    if (saveTemplateTimerRef.current) clearTimeout(saveTemplateTimerRef.current);
    saveTemplateTimerRef.current = setTimeout(() => {
      void updateTemplatePromptConfig(templateId, {
        jsonPromptConfig: {
          topic,
          systemPrompt,
          keyConfigs,
        },
      });
    }, 320);
    return () => {
      if (saveTemplateTimerRef.current) clearTimeout(saveTemplateTimerRef.current);
    };
  }, [hydrated, templateId, topic, systemPrompt, keyConfigs]);

  const modelOptions = useMemo(
    () => getEnabledModelOptions(settings),
    [settings]
  );

  const parsedModel = useMemo(
    () => (modelValue ? parseModelValue(modelValue) : null),
    [modelValue]
  );

  const supportsThinking = useMemo(
    () =>
      parsedModel?.providerId === "deepseek" &&
      parsedModel.modelId.includes("pro"),
    [parsedModel]
  );

  useEffect(() => {
    if (!hydrated || modelOptions.length === 0) return;
    if (!modelOptions.some((o) => o.value === modelValue)) {
      setModelValue(modelOptions[0].value);
    }
  }, [hydrated, modelOptions, modelValue]);

  useEffect(() => {
    if (!supportsThinking && thinkingEnabled) {
      setThinkingEnabled(false);
    }
  }, [supportsThinking, thinkingEnabled]);

  const preview = useMemo(() => {
    if (!output) return { formatted: "", valid: true };
    if (loading && streamEnabled) {
      return { formatted: output, valid: true };
    }
    if (structuredJson) {
      return formatJsonPreview(output);
    }
    return { formatted: output, valid: true };
  }, [output, loading, streamEnabled, structuredJson]);

  const parsedAiJson = useMemo(
    () => (output && !loading ? parseAiJsonOutput(output) : null),
    [output, loading]
  );

  const canOpenInEditor = !!(
    templateId &&
    parsedAiJson &&
    !loading &&
    preview.valid
  );

  const buildRequestBody = useCallback(
    (parsed: NonNullable<ReturnType<typeof parseModelValue>>) => {
      const config = settings[parsed.providerId];
      return {
        topic,
        systemPrompt,
        templateKeys: toKeyPayload(keyConfigs),
        structuredJson,
        stream: streamEnabled,
        thinkingEnabled: supportsThinking && thinkingEnabled,
        reasoningEffort,
        providerId: parsed.providerId,
        model: parsed.modelId,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        temperature: config.temperature,
      };
    },
    [
      topic,
      systemPrompt,
      keyConfigs,
      structuredJson,
      streamEnabled,
      thinkingEnabled,
      reasoningEffort,
      supportsThinking,
      settings,
    ]
  );

  const handleGenerate = useCallback(async () => {
    setError(null);
    setCopied(false);

    if (!templateId) {
      setError("请选择模板");
      return;
    }

    const keyError = validateKeyConfigs(keyConfigs);
    if (keyError) {
      setError(keyError);
      return;
    }

    const parsed = parseModelValue(modelValue);
    if (!parsed) {
      setError("请选择模型");
      return;
    }

    if (!settings[parsed.providerId].apiKey.trim()) {
      setError("请先在 AI 设置中配置并保存 API Key");
      return;
    }

    setLoading(true);
    setOutput("");
    setReasoningOutput("");

    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRequestBody(parsed)),
      });

      if (streamEnabled) {
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          setError(data.error ?? "生成失败");
          return;
        }
        await consumeChatSSE(res, ({ content, reasoning }) => {
          if (content) setOutput((prev) => prev + content);
          if (reasoning) setReasoningOutput((prev) => prev + reasoning);
        });
        return;
      }

      const data = (await res.json()) as { content?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "生成失败");
        return;
      }
      setOutput(data.content ?? "");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "网络错误，请检查连接后重试"
      );
    } finally {
      setLoading(false);
    }
  }, [
    templateId,
    keyConfigs,
    modelValue,
    settings,
    streamEnabled,
    buildRequestBody,
  ]);

  const handleCopy = useCallback(async () => {
    if (!preview.formatted) return;
    try {
      await navigator.clipboard.writeText(preview.formatted);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("复制失败");
    }
  }, [preview.formatted]);

  const handleOpenInEditor = useCallback(async () => {
    if (!templateId || !parsedAiJson) {
      setError("请先生成有效的 JSON 后再打开");
      return;
    }
    const template = await getTemplateById(templateId);
    if (!template) {
      setError("模板不存在，请重新选择");
      return;
    }

    try {
      const merged = applyAiJsonToCanvas(template.json, parsedAiJson, keyConfigs);
      const json = await embedBlobUrlsInCanvasJson(merged);
      stashAiCanvasImport({
        templateId,
        canvasSize: template.canvasSize,
        json,
      });
      router.push(`/image-edit?templateId=${templateId}&fromAi=1`);
    } catch {
      setError("导入图像编辑失败，请重试");
    }
  }, [templateId, parsedAiJson, keyConfigs, router]);

  if (!mounted) {
    return (
      <div className="h-[420px] animate-pulse rounded-lg border bg-muted/40" />
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">生成</CardTitle>
          <CardDescription className="text-xs">
            配置自动保存，刷新不丢失
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="ai-model" className="text-xs">
                模型
              </Label>
              <div className="flex items-center gap-0.5 rounded-md border bg-muted/30 p-0.5">
                <IconToggle
                  icon={Braces}
                  active={structuredJson}
                  onClick={() => setStructuredJson((v) => !v)}
                  title="规范输出 JSON"
                />
                <IconToggle
                  icon={Radio}
                  active={streamEnabled}
                  onClick={() => setStreamEnabled((v) => !v)}
                  title="流式输出"
                />
                <IconToggle
                  icon={Brain}
                  active={thinkingEnabled}
                  onClick={() => setThinkingEnabled((v) => !v)}
                  title={
                    supportsThinking
                      ? "思考模式（DeepSeek Pro）"
                      : "思考模式仅 DeepSeek Pro 可用"
                  }
                  disabled={!supportsThinking}
                />
              </div>
            </div>
            {modelOptions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                请先在{" "}
                <Link href="/ai-settings" className="text-primary hover:underline">
                  AI 设置
                </Link>{" "}
                启用模型
              </p>
            ) : (
              <select
                id="ai-model"
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

          <div className="space-y-1.5">
            <Label htmlFor="ai-topic" className="text-xs">
              主题 / 提示词
            </Label>
            <Input
              id="ai-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="例如：春季新品公众号推文"
              className="h-9"
            />
          </div>

          <TemplateKeysEditor
            templateId={templateId}
            onTemplateIdChange={setTemplateId}
            keyConfigs={keyConfigs}
            onKeyConfigsChange={setKeyConfigs}
            systemPrompt={systemPrompt}
            onSystemPromptChange={setSystemPrompt}
          />

          <div className="flex justify-end pt-1">
            <Button
              type="button"
              size="sm"
              onClick={handleGenerate}
              disabled={loading || modelOptions.length === 0 || !templateId}
            >
              {loading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              )}
              {loading ? "生成中…" : "生成 JSON"}
            </Button>
          </div>

          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="flex flex-col">
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
          <div className="min-w-0">
            <CardTitle className="text-base">输出</CardTitle>
            <CardDescription className="mt-0.5 text-xs">
              {loading && streamEnabled
                ? "流式生成中…"
                : structuredJson && output && !loading
                  ? preview.valid
                    ? "JSON 已校验"
                    : "JSON 格式待修正"
                  : "生成后预览或导入图像编辑"}
            </CardDescription>
          </div>
          <div className="flex shrink-0 gap-1">
            {canOpenInEditor && (
              <Button
                type="button"
                variant="default"
                size="sm"
                className="h-8 text-xs"
                onClick={handleOpenInEditor}
              >
                <ExternalLink className="mr-1 h-3 w-3" />
                图像编辑
              </Button>
            )}
            {preview.formatted && !loading && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={handleCopy}
              >
                <Copy className="mr-1 h-3 w-3" />
                {copied ? "已复制" : "复制"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-2 pb-4">
          {reasoningOutput && thinkingEnabled && (
            <details className="rounded-md border border-dashed bg-muted/15 px-2 py-1">
              <summary className="cursor-pointer text-[10px] text-muted-foreground">
                思考过程
              </summary>
              <pre className="mt-1 max-h-[100px] overflow-auto text-[10px] leading-relaxed font-mono whitespace-pre-wrap break-words text-muted-foreground">
                {reasoningOutput}
              </pre>
            </details>
          )}
          <pre
            className={cn(
              "min-h-[320px] flex-1 overflow-auto rounded-md border bg-muted/20 p-3 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap",
              !preview.valid &&
                output &&
                structuredJson &&
                !loading &&
                "border-amber-500/40"
            )}
          >
            {loading && !output && !reasoningOutput ? (
              <span className="text-muted-foreground">正在生成…</span>
            ) : preview.formatted ? (
              <>
                {preview.formatted}
                {loading && streamEnabled && (
                  <span className="inline-block w-1 animate-pulse bg-primary/60">
                    ▌
                  </span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">
                选择模板并填写主题后生成
              </span>
            )}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
