import {
  DEFAULT_PROMPT_APPEND_CONFIG,
  migrateAppendConfig,
} from "@/lib/ai-prompt-append";

export const AI_PLUS_IMAGE_STORAGE_KEY = "ai-plus-image-session";
export const AI_PLUS_IMAGE_UPDATED_EVENT = "ai-plus-image-updated";

export interface AiPlusImagePersistedState {
  imageModelValue: string;
  coverModelValue: string;
  imageSize: string;
  coverSize: string;
  templateId: string | null;
  zoneElementIndex: number | null;
  imagePrompt: string;
  coverPrompt: string;
  lastPreviewUrl: string;
  lastCoverUrl: string;
  imageAppendEnabled: boolean;
  imageAppendSelectedKeys: string[];
  coverAppendEnabled: boolean;
  coverAppendSelectedKeys: string[];
  /** @deprecated 旧版单字段，读取时自动迁移 */
  appendJsonKey?: string;
  appendPosition?: string;
  appendMarker?: string;
}

export const DEFAULT_AI_PLUS_IMAGE_STATE: AiPlusImagePersistedState = {
  imageModelValue: "",
  coverModelValue: "",
  imageSize: "",
  coverSize: "",
  templateId: null,
  zoneElementIndex: null,
  imagePrompt: "",
  coverPrompt: "",
  lastPreviewUrl: "",
  lastCoverUrl: "",
  imageAppendEnabled: DEFAULT_PROMPT_APPEND_CONFIG.enabled,
  imageAppendSelectedKeys: DEFAULT_PROMPT_APPEND_CONFIG.selectedKeys,
  coverAppendEnabled: DEFAULT_PROMPT_APPEND_CONFIG.enabled,
  coverAppendSelectedKeys: DEFAULT_PROMPT_APPEND_CONFIG.selectedKeys,
};

export function loadAiPlusImageState(): AiPlusImagePersistedState {
  if (typeof window === "undefined") return { ...DEFAULT_AI_PLUS_IMAGE_STATE };
  try {
    const raw = localStorage.getItem(AI_PLUS_IMAGE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AI_PLUS_IMAGE_STATE };
    const parsed = JSON.parse(raw) as Partial<AiPlusImagePersistedState>;
    const legacy = parsed as Partial<{
      modelValue: string;
      prompt: string;
      appendEnabled: boolean;
      appendJsonKey: string;
      appendSelectedKeys: string[];
    }>;
    const merged = { ...DEFAULT_AI_PLUS_IMAGE_STATE, ...parsed };
    const append = migrateAppendConfig({
      appendEnabled: legacy.appendEnabled,
      appendJsonKey: legacy.appendJsonKey,
      appendSelectedKeys: legacy.appendSelectedKeys,
    });
    const imageAppend = migrateAppendConfig({
      appendEnabled: merged.imageAppendEnabled,
      appendSelectedKeys: merged.imageAppendSelectedKeys,
    });
    const coverAppend = migrateAppendConfig({
      appendEnabled: merged.coverAppendEnabled,
      appendSelectedKeys: merged.coverAppendSelectedKeys,
    });
    return {
      ...merged,
      imageModelValue: merged.imageModelValue || legacy.modelValue || "",
      coverModelValue: merged.coverModelValue || legacy.modelValue || "",
      imagePrompt: merged.imagePrompt || legacy.prompt || "",
      imageAppendEnabled: imageAppend.enabled || append.enabled,
      imageAppendSelectedKeys:
        imageAppend.selectedKeys.length > 0
          ? imageAppend.selectedKeys
          : append.selectedKeys,
      coverAppendEnabled: coverAppend.enabled,
      coverAppendSelectedKeys: coverAppend.selectedKeys,
    };
  } catch {
    return { ...DEFAULT_AI_PLUS_IMAGE_STATE };
  }
}

export function saveAiPlusImageState(state: AiPlusImagePersistedState): void {
  if (typeof window === "undefined") return;
  try {
    const rest = { ...state };
    delete rest.appendJsonKey;
    delete rest.appendPosition;
    delete rest.appendMarker;
    localStorage.setItem(AI_PLUS_IMAGE_STORAGE_KEY, JSON.stringify(rest));
    window.dispatchEvent(new Event(AI_PLUS_IMAGE_UPDATED_EVENT));
  } catch {
    /* ignore */
  }
}

export function subscribeAiPlusImageState(onStoreChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === AI_PLUS_IMAGE_STORAGE_KEY) onStoreChange();
  };
  const onUpdated = () => onStoreChange();
  window.addEventListener("storage", onStorage);
  window.addEventListener(AI_PLUS_IMAGE_UPDATED_EVENT, onUpdated);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(AI_PLUS_IMAGE_UPDATED_EVENT, onUpdated);
  };
}
