import {
  loadStoredKeyConfigs,
  mergeKeyConfigsWithElements,
} from "@/lib/ai-template-keys";
import type { SavedImageTemplate, TemplateElementInfo } from "@/types/image-template";
import type { TemplateJsonKeyConfig } from "@/types/ai-template-keys";
import { buildJsonPlaceholder } from "@/lib/ai-prompt-append";

export interface TemplateTextBlockOption {
  key: string;
  label: string;
  elementIndex: number;
  placeholder: string;
  /** 模板中的示例文本（若有） */
  sampleText: string | null;
}

export function isTextElement(el: TemplateElementInfo): boolean {
  const t = el.type.toLowerCase();
  return t === "textbox" || t === "i-text" || t === "text";
}

/** 模板中所有文本块及其 JSON 键（与文案 JSON 配置一致） */
export function getTemplateTextBlocks(
  template: SavedImageTemplate
): TemplateTextBlockOption[] {
  const textElements = template.elements.filter(isTextElement);
  if (textElements.length === 0) return [];

  const stored = loadStoredKeyConfigs(template.id);
  const storedForText = stored?.filter((c) =>
    textElements.some((el) => el.index === c.elementIndex)
  );

  const configs = mergeKeyConfigsWithElements(textElements, storedForText);

  return configs.map((c) => toTextBlockOption(c, textElements));
}

function toTextBlockOption(
  config: TemplateJsonKeyConfig,
  textElements: TemplateElementInfo[]
): TemplateTextBlockOption {
  const key = config.key.trim();
  const el = textElements.find((e) => e.index === config.elementIndex);
  return {
    key,
    label: config.label,
    elementIndex: config.elementIndex,
    placeholder: buildJsonPlaceholder(key),
    sampleText: el?.text ?? null,
  };
}

export function getTemplateTextBlockKeys(template: SavedImageTemplate): string[] {
  return getTemplateTextBlocks(template).map((b) => b.key);
}
