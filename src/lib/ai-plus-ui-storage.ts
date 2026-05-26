export const AI_PLUS_UI_STORAGE_KEY = "ai-plus-ui";

export type AiPlusTab = "json" | "image";

export interface AiPlusUiState {
  activeTab: AiPlusTab;
}

export const DEFAULT_AI_PLUS_UI: AiPlusUiState = {
  activeTab: "json",
};

export function loadAiPlusUiState(): AiPlusUiState {
  if (typeof window === "undefined") return { ...DEFAULT_AI_PLUS_UI };
  try {
    const raw = localStorage.getItem(AI_PLUS_UI_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AI_PLUS_UI };
    const parsed = JSON.parse(raw) as Partial<AiPlusUiState>;
    const tab = parsed.activeTab;
    if (tab === "json" || tab === "image") {
      return { activeTab: tab };
    }
    return { ...DEFAULT_AI_PLUS_UI };
  } catch {
    return { ...DEFAULT_AI_PLUS_UI };
  }
}

export function saveAiPlusUiState(state: AiPlusUiState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(AI_PLUS_UI_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}
