import type { ReasoningEffort } from "@/lib/ai-chat";

export const AI_PLUS_STORAGE_KEY = "ai-plus-session";

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
  } catch {
    /* ignore quota */
  }
}
