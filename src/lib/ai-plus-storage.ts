import type { ReasoningEffort } from "@/lib/ai-chat";

export const AI_PLUS_STORAGE_KEY = "ai-plus-session";
export const AI_PLUS_JSON_UPDATED_EVENT = "ai-plus-json-updated";

export interface AiPlusPersistedState {
  topic: string;
  templateId: string | null;
  modelValue: string;
  structuredJson: boolean;
  streamEnabled: boolean;
  thinkingEnabled: boolean;
  reasoningEffort: ReasoningEffort;
  lastOutput: string;
  lastReasoning: string;
}

export const DEFAULT_AI_PLUS_STATE: AiPlusPersistedState = {
  topic: "",
  templateId: null,
  modelValue: "",
  structuredJson: true,
  streamEnabled: true,
  thinkingEnabled: false,
  reasoningEffort: "high",
  lastOutput: "",
  lastReasoning: "",
};

export function loadAiPlusState(): AiPlusPersistedState {
  if (typeof window === "undefined") return { ...DEFAULT_AI_PLUS_STATE };
  try {
    const raw = localStorage.getItem(AI_PLUS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AI_PLUS_STATE };
    const parsed = JSON.parse(raw) as Partial<AiPlusPersistedState>;
    return { ...DEFAULT_AI_PLUS_STATE, ...parsed };
  } catch {
    return { ...DEFAULT_AI_PLUS_STATE };
  }
}

export function saveAiPlusState(state: AiPlusPersistedState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(AI_PLUS_STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new Event(AI_PLUS_JSON_UPDATED_EVENT));
  } catch {
    /* ignore quota */
  }
}

export function subscribeAiPlusJsonOutput(onStoreChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === AI_PLUS_STORAGE_KEY) onStoreChange();
  };
  const onUpdated = () => onStoreChange();
  window.addEventListener("storage", onStorage);
  window.addEventListener(AI_PLUS_JSON_UPDATED_EVENT, onUpdated);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(AI_PLUS_JSON_UPDATED_EVENT, onUpdated);
  };
}
