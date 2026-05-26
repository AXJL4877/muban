import {
  DEFAULT_PROMPT_APPEND_CONFIG,
  migrateAppendConfig,
} from "@/lib/ai-prompt-append";

export const AI_PLUS_IMAGE_STORAGE_KEY = "ai-plus-image-session";

export interface AiPlusImagePersistedState {
  modelValue: string;
  templateId: string | null;
  zoneElementIndex: number | null;
  prompt: string;
  lastPreviewUrl: string;
  appendEnabled: boolean;
  appendSelectedKeys: string[];
  /** @deprecated 旧版单字段，读取时自动迁移 */
  appendJsonKey?: string;
  appendPosition?: string;
  appendMarker?: string;
}

export const DEFAULT_AI_PLUS_IMAGE_STATE: AiPlusImagePersistedState = {
  modelValue: "",
  templateId: null,
  zoneElementIndex: null,
  prompt: "",
  lastPreviewUrl: "",
  appendEnabled: DEFAULT_PROMPT_APPEND_CONFIG.enabled,
  appendSelectedKeys: DEFAULT_PROMPT_APPEND_CONFIG.selectedKeys,
};

export function loadAiPlusImageState(): AiPlusImagePersistedState {
  if (typeof window === "undefined") return { ...DEFAULT_AI_PLUS_IMAGE_STATE };
  try {
    const raw = localStorage.getItem(AI_PLUS_IMAGE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AI_PLUS_IMAGE_STATE };
    const parsed = JSON.parse(raw) as Partial<AiPlusImagePersistedState>;
    const merged = { ...DEFAULT_AI_PLUS_IMAGE_STATE, ...parsed };
    const append = migrateAppendConfig({
      appendEnabled: merged.appendEnabled,
      appendJsonKey: merged.appendJsonKey,
      appendSelectedKeys: merged.appendSelectedKeys,
    });
    return {
      ...merged,
      appendEnabled: append.enabled,
      appendSelectedKeys: append.selectedKeys,
    };
  } catch {
    return { ...DEFAULT_AI_PLUS_IMAGE_STATE };
  }
}

export function saveAiPlusImageState(state: AiPlusImagePersistedState): void {
  if (typeof window === "undefined") return;
  try {
    const { appendJsonKey: _a, appendPosition: _b, appendMarker: _c, ...rest } =
      state;
    localStorage.setItem(AI_PLUS_IMAGE_STORAGE_KEY, JSON.stringify(rest));
  } catch {
    /* ignore */
  }
}
