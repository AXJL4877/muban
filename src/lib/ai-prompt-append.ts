export interface PromptAppendConfig {
  enabled: boolean;
  /** 选中的 JSON 字段 ID（可多选） */
  selectedKeys: string[];
}

export const DEFAULT_PROMPT_APPEND_CONFIG: PromptAppendConfig = {
  enabled: false,
  selectedKeys: [],
};

/** 占位符格式：由 JSON 键名命名，如 {{title}} */
export function buildJsonPlaceholder(jsonKey: string): string {
  const id = jsonKey.trim();
  return id ? `{{${id}}}` : "";
}

export function stringifyJsonFieldValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

export function resolveJsonKeyValue(
  data: Record<string, unknown>,
  key: string
): string {
  const trimmed = key.trim();
  if (!trimmed) return "";
  if (Object.prototype.hasOwnProperty.call(data, trimmed)) {
    return stringifyJsonFieldValue(data[trimmed]);
  }
  const lower = trimmed.toLowerCase();
  for (const [k, v] of Object.entries(data)) {
    if (k.trim().toLowerCase() === lower) {
      return stringifyJsonFieldValue(v);
    }
  }
  return "";
}

export interface BuildImagePromptResult {
  prompt: string;
  error?: string;
  warnings?: string[];
}

/**
 * 合并提示词与文案 JSON：
 * 1. 将提示词中的 {{jsonKey}} 替换为对应字段值
 * 2. 已选但未出现在提示词中的字段，统一追加到末尾
 */
export function buildImagePromptWithAppend(
  basePrompt: string,
  config: PromptAppendConfig,
  jsonData: Record<string, unknown> | null
): BuildImagePromptResult {
  const base = basePrompt.trim();

  if (!config.enabled) {
    if (!base) return { prompt: "", error: "请输入提示词" };
    return { prompt: base };
  }

  if (!jsonData) {
    return {
      prompt: base,
      error: "请先在「文案 JSON」中生成内容，或关闭追加文本",
    };
  }

  const keys = config.selectedKeys.map((k) => k.trim()).filter(Boolean);
  if (keys.length === 0) {
    return { prompt: base, error: "请至少选择一个文本块字段" };
  }

  const warnings: string[] = [];
  let result = base;
  const appendParts: string[] = [];

  for (const key of keys) {
    const value = resolveJsonKeyValue(jsonData, key);
    if (!value) {
      warnings.push(`文案 JSON 中未找到字段「${key}」`);
      continue;
    }

    const placeholder = buildJsonPlaceholder(key);
    if (placeholder && result.includes(placeholder)) {
      result = result.split(placeholder).join(value);
    } else {
      appendParts.push(value);
    }
  }

  if (appendParts.length > 0) {
    const suffix = appendParts.join("\n\n");
    result = result ? `${result}\n\n${suffix}` : suffix;
  }

  if (!result.trim()) {
    return {
      prompt: "",
      error: "合并后提示词为空，请检查所选字段与文案 JSON",
      warnings,
    };
  }

  return {
    prompt: result.trim(),
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/** 从旧版单字段配置迁移 */
export function migrateAppendConfig(
  legacy?: Partial<{
    appendEnabled?: boolean;
    appendJsonKey?: string;
    appendSelectedKeys?: string[];
    selectedKeys?: string[];
  }>
): PromptAppendConfig {
  const selectedKeys =
    legacy?.selectedKeys ??
    legacy?.appendSelectedKeys ??
    (legacy?.appendJsonKey?.trim() ? [legacy.appendJsonKey.trim()] : []);

  return {
    enabled: legacy?.appendEnabled ?? false,
    selectedKeys,
  };
}
