import type { TemplateElementInfo } from "@/types/image-template";
import type {
  TemplateJsonKeyConfig,
  TemplateJsonKeyPayload,
} from "@/types/ai-template-keys";

export const AI_TEMPLATE_KEY_CONFIGS_KEY = "ai-template-key-configs";

export function defaultKeyForElement(el: TemplateElementInfo): string {
  const typePart = el.type.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "field";
  return `${typePart}_${el.index}`;
}

export function createKeyConfigFromElement(
  el: TemplateElementInfo,
  overrides?: Partial<TemplateJsonKeyConfig>
): TemplateJsonKeyConfig {
  return {
    key: defaultKeyForElement(el),
    elementIndex: el.index,
    label: el.label,
    enabled: true,
    instruction: "",
    ...overrides,
  };
}

export function mergeKeyConfigsWithElements(
  elements: TemplateElementInfo[],
  stored?: TemplateJsonKeyConfig[]
): TemplateJsonKeyConfig[] {
  const byIndex = new Map(
    (stored ?? []).map((c) => [c.elementIndex, c])
  );

  return elements.map((el) => {
    const existing = byIndex.get(el.index);
    if (existing) {
      return {
        ...existing,
        label: el.label,
        key: existing.key.trim() || defaultKeyForElement(el),
      };
    }
    return createKeyConfigFromElement(el);
  });
}

export function loadStoredKeyConfigs(
  templateId: string
): TemplateJsonKeyConfig[] | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(AI_TEMPLATE_KEY_CONFIGS_KEY);
    if (!raw) return undefined;
    const all = JSON.parse(raw) as Record<string, TemplateJsonKeyConfig[]>;
    return all[templateId];
  } catch {
    return undefined;
  }
}

export function saveStoredKeyConfigs(
  templateId: string,
  configs: TemplateJsonKeyConfig[]
): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(AI_TEMPLATE_KEY_CONFIGS_KEY);
    const all = raw
      ? (JSON.parse(raw) as Record<string, TemplateJsonKeyConfig[]>)
      : {};
    all[templateId] = configs;
    localStorage.setItem(AI_TEMPLATE_KEY_CONFIGS_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export function toKeyPayload(
  configs: TemplateJsonKeyConfig[]
): TemplateJsonKeyPayload[] {
  return configs.map((c) => ({
    key: c.key.trim(),
    enabled: c.enabled,
    label: c.label,
    instruction: c.instruction.trim() || undefined,
    maxChars: c.maxChars,
    minChars: c.minChars,
  }));
}

export function getEnabledKeys(
  configs: TemplateJsonKeyConfig[]
): TemplateJsonKeyConfig[] {
  return configs.filter((c) => c.enabled && c.key.trim());
}

export function validateKeyConfigs(
  configs: TemplateJsonKeyConfig[]
): string | null {
  const enabled = getEnabledKeys(configs);
  if (enabled.length === 0) {
    return "请至少启用一个 JSON 键";
  }
  const keys = enabled.map((c) => c.key.trim());
  const dup = keys.find((k, i) => keys.indexOf(k) !== i);
  if (dup) return `JSON 键名重复：${dup}`;
  return null;
}

/** 根据启用的键生成 json 结构样例 */
export function buildJsonSchemaExample(
  keys: TemplateJsonKeyConfig[]
): string {
  const enabled = getEnabledKeys(keys);
  const lines = enabled.map((k) => {
    const hint =
      k.maxChars != null
        ? `"（约${k.maxChars}字内）"`
        : '""';
    return `  "${k.key.trim()}": ${hint}`;
  });
  return `{\n${lines.join(",\n")}\n}`;
}

/** 各键的生成要求段落 */
export function buildFieldInstructions(
  keys: TemplateJsonKeyConfig[]
): string {
  const enabled = getEnabledKeys(keys);
  return enabled
    .map((k) => {
      const lines = [`- **${k.key.trim()}**（${k.label}）`];
      if (k.instruction.trim()) {
        lines.push(`  生成要求：${k.instruction.trim()}`);
      }
      const min = k.minChars != null && k.minChars > 0 ? k.minChars : null;
      const max = k.maxChars != null && k.maxChars > 0 ? k.maxChars : null;
      if (min != null && max != null) {
        lines.push(`  字数：约 ${min}–${max} 字`);
      } else if (min != null) {
        lines.push(`  字数：不少于约 ${min} 字`);
      } else if (max != null) {
        lines.push(`  字数：不超过约 ${max} 字`);
      }
      return lines.join("\n");
    })
    .join("\n");
}
