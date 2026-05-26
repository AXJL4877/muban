"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  loadTemplates,
  updateTemplateElementId,
} from "@/lib/image-templates";
import {
  loadStoredKeyConfigs,
  mergeKeyConfigsWithElements,
  saveStoredKeyConfigs,
} from "@/lib/ai-template-keys";
import type { SavedImageTemplate } from "@/types/image-template";
import type { TemplateJsonKeyConfig } from "@/types/ai-template-keys";

interface TemplateKeysEditorProps {
  templateId: string | null;
  onTemplateIdChange: (id: string | null) => void;
  keyConfigs: TemplateJsonKeyConfig[];
  onKeyConfigsChange: (configs: TemplateJsonKeyConfig[]) => void;
  systemPrompt: string;
  onSystemPromptChange: (value: string) => void;
}

function KeyConfigRow({
  config,
  onChange,
}: {
  config: TemplateJsonKeyConfig;
  onChange: (patch: Partial<TemplateJsonKeyConfig>) => void;
}) {
  const [expanded, setExpanded] = useState(config.enabled);

  useEffect(() => {
    if (config.enabled) setExpanded(true);
  }, [config.enabled]);

  return (
    <div
      className={cn(
        "rounded-lg border transition-colors",
        config.enabled ? "border-primary/25 bg-background" : "border-transparent bg-muted/30"
      )}
    >
      <div className="flex items-start gap-2 p-2.5">
        <button
          type="button"
          role="switch"
          aria-checked={config.enabled}
          onClick={() => onChange({ enabled: !config.enabled })}
          className={cn(
            "relative mt-1 inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors",
            config.enabled ? "bg-primary" : "bg-muted"
          )}
        >
          <span
            className={cn(
              "pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-sm transition-transform",
              config.enabled ? "translate-x-4" : "translate-x-0"
            )}
          />
        </button>
        <div className="min-w-0 flex-1 space-y-0.5">
          <Input
            value={config.key}
            onChange={(e) => onChange({ key: e.target.value })}
            disabled={!config.enabled}
            className="h-8 font-mono text-xs"
            placeholder="键名"
            aria-label="JSON 键名"
          />
          <p
            className="truncate text-[10px] text-muted-foreground"
            title={config.label}
          >
            {config.label}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          disabled={!config.enabled}
          className="mt-1 shrink-0 rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-40"
          aria-label={expanded ? "收起" : "展开"}
        >
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")}
          />
        </button>
      </div>

      {expanded && config.enabled && (
        <div className="space-y-2 border-t px-2.5 pb-2.5 pt-2">
          <div className="space-y-1">
            <Label className="text-xs">字段提示词</Label>
            <Textarea
              value={config.instruction}
              onChange={(e) => onChange({ instruction: e.target.value })}
              rows={2}
              className="min-h-[48px] resize-y text-sm"
              placeholder="例如：吸引人的标题，突出春季新品"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="shrink-0 text-xs text-muted-foreground">字数</Label>
            <Input
              type="number"
              min={0}
              value={config.minChars ?? ""}
              onChange={(e) =>
                onChange({
                  minChars: e.target.value
                    ? parseInt(e.target.value, 10)
                    : undefined,
                })
              }
              className="h-7 w-16 text-xs"
              placeholder="最少"
              aria-label="最少字数"
            />
            <span className="text-xs text-muted-foreground">~</span>
            <Input
              type="number"
              min={0}
              value={config.maxChars ?? ""}
              onChange={(e) =>
                onChange({
                  maxChars: e.target.value
                    ? parseInt(e.target.value, 10)
                    : undefined,
                })
              }
              className="h-7 w-16 text-xs"
              placeholder="最多"
              aria-label="最多字数"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function TemplateKeysEditor({
  templateId,
  onTemplateIdChange,
  keyConfigs,
  onKeyConfigsChange,
  systemPrompt,
  onSystemPromptChange,
}: TemplateKeysEditorProps) {
  const [templates, setTemplates] = useState<SavedImageTemplate[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTemplates(loadTemplates());
    setMounted(true);
  }, []);

  /** 从图像编辑返回时，用模板中最新的 elementId 同步 JSON 键 */
  useEffect(() => {
    if (!templateId) return;
    const syncFromTemplate = () => {
      const template = loadTemplates().find((t) => t.id === templateId);
      if (!template) return;
      const stored = loadStoredKeyConfigs(templateId);
      onKeyConfigsChange(mergeKeyConfigsWithElements(template.elements, stored));
      setTemplates(loadTemplates());
    };
    window.addEventListener("focus", syncFromTemplate);
    return () => window.removeEventListener("focus", syncFromTemplate);
  }, [templateId, onKeyConfigsChange]);

  const applyTemplate = useCallback(
    (id: string) => {
      const template = templates.find((t) => t.id === id);
      if (!template) return;
      const stored = loadStoredKeyConfigs(id);
      const merged = mergeKeyConfigsWithElements(template.elements, stored);
      onKeyConfigsChange(merged);
      onTemplateIdChange(id);
    },
    [templates, onKeyConfigsChange, onTemplateIdChange]
  );

  const updateConfig = useCallback(
    (index: number, patch: Partial<TemplateJsonKeyConfig>) => {
      const next = keyConfigs.map((c, i) =>
        i === index ? { ...c, ...patch } : c
      );
      onKeyConfigsChange(next);
      if (templateId) saveStoredKeyConfigs(templateId, next);

      if (patch.key !== undefined && templateId) {
        const normalized = patch.key.trim();
        if (normalized) {
          updateTemplateElementId(templateId, keyConfigs[index].elementIndex, normalized);
          setTemplates(loadTemplates());
        }
      }
    },
    [keyConfigs, onKeyConfigsChange, templateId]
  );

  if (!mounted) {
    return <div className="h-24 animate-pulse rounded-lg border bg-muted/40" />;
  }

  if (templates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        暂无模板。请先在{" "}
        <Link href="/image-edit" className="text-primary underline-offset-4 hover:underline">
          图像编辑
        </Link>{" "}
        中保存作品到「我的模板」。
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="ai-template">选择模板</Label>
        <select
          id="ai-template"
          value={templateId ?? ""}
          onChange={(e) => {
            const id = e.target.value;
            if (id) applyTemplate(id);
            else {
              onTemplateIdChange(null);
              onKeyConfigsChange([]);
            }
          }}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">请选择模板…</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}（{t.elementCount} 个元素）
            </option>
          ))}
        </select>
      </div>

      {templateId && keyConfigs.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>系统提示词 · JSON 键</Label>
            <span className="text-xs text-muted-foreground">
              已启用 {keyConfigs.filter((c) => c.enabled).length} / {keyConfigs.length}
            </span>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ai-system-prompt" className="text-xs text-muted-foreground">
              系统提示词
            </Label>
            <Textarea
              id="ai-system-prompt"
              value={systemPrompt}
              onChange={(e) => onSystemPromptChange(e.target.value)}
              rows={2}
              className="min-h-[52px] resize-y text-sm"
              placeholder="全局角色与风格说明，将与各 JSON 键的字段要求一并发送给模型"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            键名与图像编辑中元素「键名」一致，修改任一侧会同步；下方可配置各键字段提示词与字数。
          </p>
          <div className="max-h-[360px] space-y-1.5 overflow-y-auto pr-1">
            {keyConfigs.map((config, index) => (
              <KeyConfigRow
                key={config.elementIndex}
                config={config}
                onChange={(patch) => updateConfig(index, patch)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
