"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ChevronDown } from "lucide-react";
import {
  loadAiPlusState,
  subscribeAiPlusJsonOutput,
} from "@/lib/ai-plus-storage";
import { Label } from "@/components/ui/label";
import {
  buildImagePromptWithAppend,
  buildJsonPlaceholder,
  resolveJsonKeyValue,
  type PromptAppendConfig,
} from "@/lib/ai-prompt-append";
import { parseAiJsonOutput } from "@/lib/apply-ai-json-to-canvas";
import { getTemplateById } from "@/lib/image-templates";
import { getTemplateTextBlocks } from "@/lib/template-text-blocks";
import { ToggleSwitch } from "@/components/ai-plus/toggle-switch";
import { cn } from "@/lib/utils";

interface PromptAppendSettingsProps {
  templateId: string | null;
  basePrompt: string;
  config: PromptAppendConfig;
  onChange: (patch: Partial<PromptAppendConfig>) => void;
}

function getJsonOutputSnapshot() {
  return loadAiPlusState().lastOutput;
}

export function PromptAppendSettings({
  templateId,
  basePrompt,
  config,
  onChange,
}: PromptAppendSettingsProps) {
  const lastOutput = useSyncExternalStore(
    subscribeAiPlusJsonOutput,
    getJsonOutputSnapshot,
    () => ""
  );

  const jsonData = useMemo(
    () => parseAiJsonOutput(lastOutput),
    [lastOutput]
  );

  const textBlocks = useMemo(() => {
    if (!templateId) return [];
    const template = getTemplateById(templateId);
    if (!template) return [];
    return getTemplateTextBlocks(template);
  }, [templateId]);

  const toggleKey = useCallback(
    (key: string, checked: boolean) => {
      const set = new Set(config.selectedKeys);
      if (checked) set.add(key);
      else set.delete(key);
      onChange({ selectedKeys: Array.from(set) });
    },
    [config.selectedKeys, onChange]
  );

  const preview = useMemo(
    () => buildImagePromptWithAppend(basePrompt, config, jsonData),
    [basePrompt, config, jsonData]
  );

  const [blocksExpanded, setBlocksExpanded] = useState(false);

  useEffect(() => {
    if (config.selectedKeys.length > 0) setBlocksExpanded(true);
  }, [config.selectedKeys.length]);

  useEffect(() => {
    if (!config.enabled) setBlocksExpanded(false);
  }, [config.enabled]);

  useEffect(() => {
    setBlocksExpanded(false);
  }, [templateId]);

  return (
    <div className="space-y-3 rounded-lg border bg-muted/15 p-3">
      <ToggleSwitch
        checked={config.enabled}
        onChange={(enabled) => onChange({ enabled })}
        label="追加文案 JSON"
        description="勾选模板文本块，用 {{JSON键名}} 插入或自动追加到提示词末尾"
      />

      {config.enabled && (
        <div className="space-y-3 border-t pt-3">
          {!templateId ? (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              请先选择模板，以加载其中的文本块列表。
            </p>
          ) : textBlocks.length === 0 ? (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              该模板没有文本块。请在图像编辑中添加文本元素后重新保存模板。
            </p>
          ) : (
            <div className="overflow-hidden rounded-md border bg-background/60">
              <button
                type="button"
                onClick={() => setBlocksExpanded((v) => !v)}
                aria-expanded={blocksExpanded}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
              >
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                    blocksExpanded && "rotate-180"
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="text-xs font-medium">模板文本块</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {config.selectedKeys.length > 0
                      ? `已选 ${config.selectedKeys.length} 项：${config.selectedKeys
                          .slice(0, 2)
                          .map((k) => buildJsonPlaceholder(k))
                          .join("、")}${config.selectedKeys.length > 2 ? "…" : ""}`
                      : `共 ${textBlocks.length} 项，点击展开勾选`}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  {config.selectedKeys.length}/{textBlocks.length}
                </span>
              </button>

              <div
                className={cn(
                  "grid transition-[grid-template-rows] duration-200 ease-out",
                  blocksExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                )}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className="space-y-2 border-t px-3 pb-3 pt-2">
                    <p className="text-[11px] text-muted-foreground">
                      占位符为 JSON 键名，如{" "}
                      <code className="rounded bg-muted px-1 font-mono">
                        {buildJsonPlaceholder(textBlocks[0]?.key ?? "title")}
                      </code>
                      ；未写入提示词的字段将追加到末尾。
                    </p>

                    <ul className="max-h-[220px] space-y-1.5 overflow-y-auto pr-0.5">
                      {textBlocks.map((block) => {
                        const checked = config.selectedKeys.includes(block.key);
                        const jsonPreview = jsonData
                          ? resolveJsonKeyValue(jsonData, block.key)
                          : "";

                        return (
                          <li key={block.elementIndex}>
                            <label
                              className={cn(
                                "flex cursor-pointer gap-2 rounded-md border px-3 py-2 transition-colors",
                                checked
                                  ? "border-primary/35 bg-primary/5"
                                  : "border-transparent bg-muted/30 hover:bg-muted/50"
                              )}
                            >
                              <input
                                type="checkbox"
                                className="mt-0.5 h-4 w-4 shrink-0 rounded border-input"
                                checked={checked}
                                onChange={(e) =>
                                  toggleKey(block.key, e.target.checked)
                                }
                              />
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                  <span className="text-xs font-medium">
                                    {block.label}
                                  </span>
                                  <code className="text-[10px] text-muted-foreground">
                                    {block.placeholder}
                                  </code>
                                </span>
                                {block.sampleText && (
                                  <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                                    模板示例：{block.sampleText}
                                  </span>
                                )}
                                {jsonPreview && (
                                  <span className="mt-0.5 block text-[10px] text-primary/80">
                                    JSON：
                                    {jsonPreview.length > 48
                                      ? `${jsonPreview.slice(0, 48)}…`
                                      : jsonPreview}
                                  </span>
                                )}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!jsonData && textBlocks.length > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              暂无文案 JSON。请先在「文案 JSON」标签页生成后再生图。
            </p>
          )}

          {preview.prompt && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                合并后提示词预览
              </Label>
              <pre className="max-h-[140px] overflow-auto rounded-md border bg-background/80 p-2 text-[11px] leading-relaxed whitespace-pre-wrap break-words">
                {preview.prompt}
              </pre>
              {preview.error && (
                <p className="text-[11px] text-destructive">{preview.error}</p>
              )}
              {preview.warnings?.map((w) => (
                <p
                  key={w}
                  className="text-[11px] text-amber-600 dark:text-amber-500"
                >
                  {w}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
