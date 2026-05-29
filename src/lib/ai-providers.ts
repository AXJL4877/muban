import {
  GEMINI_PRO_ASPECT_RATIOS,
  getDefaultImageGenerationForModel,
  normalizeImageGenerationForModel,
} from "@/lib/gemini-image-models";
import {
  loadEncryptedJson,
  saveEncryptedJson,
} from "@/lib/browser-secure-storage";
import type {
  AiProviderConfig,
  AiProviderDefinition,
  AiProviderId,
  AiSettingsStore,
} from "@/types/ai";

export { GEMINI_PRO_ASPECT_RATIOS as GEMINI_ASPECT_RATIOS };

export type AiSettingsExpandedState = Partial<Record<AiProviderId, boolean>>;

export const AI_SETTINGS_STORAGE_KEY = "ai-provider-settings";

/** 各服务商配置卡片展开/收起状态 */
export const AI_SETTINGS_UI_STORAGE_KEY = "ai-settings-panel-expanded";

export function loadExpandedState(): AiSettingsExpandedState {
  try {
    const raw = localStorage.getItem(AI_SETTINGS_UI_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AiSettingsExpandedState;
  } catch {
    /* ignore */
  }
  return {};
}

export function saveExpandedState(state: AiSettingsExpandedState): void {
  localStorage.setItem(AI_SETTINGS_UI_STORAGE_KEY, JSON.stringify(state));
}

export const AI_PROVIDERS: AiProviderDefinition[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    logo: "/deepseek.png",
    baseUrl: "https://api.deepseek.com",
    models: [
      { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash" },
      { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro" },
    ],
    available: true,
  },
  {
    id: "openai",
    name: "OpenAI",
    logo: "/openai.png",
    baseUrl: "https://api.openai.com/v1",
    models: [
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4o-mini", label: "GPT-4o Mini" },
    ],
    available: false,
  },
  {
    id: "apiyi",
    name: "Nano banana",
    logo: "/nanobanana-color.png",
    baseUrl: "https://api.apiyi.com",
    models: [
      { id: "gemini-3-pro-image-preview", label: "nano-banana pro" },
      { id: "gemini-3.1-flash-image-preview", label: "nano-banana 2" },
    ],
    available: true,
    imageOnly: true,
  },
];

export function getDefaultProviderConfig(
  provider: AiProviderDefinition
): AiProviderConfig {
  const config: AiProviderConfig = {
    providerId: provider.id,
    enabled: provider.id === "deepseek",
    apiKey: "",
    baseUrl: provider.baseUrl,
    model: provider.models[0]?.id ?? "",
    temperature: 0.7,
  };
  if (provider.imageOnly) {
    config.imageGenerationByModel = Object.fromEntries(
      provider.models.map((m) => [
        m.id,
        getDefaultImageGenerationForModel(m.id),
      ])
    );
  }
  return config;
}

function mergeImageGenerationByModel(
  provider: AiProviderDefinition,
  saved: AiProviderConfig,
  defaults: AiProviderConfig
): AiProviderConfig["imageGenerationByModel"] {
  const result: NonNullable<AiProviderConfig["imageGenerationByModel"]> = {};

  for (const model of provider.models) {
    const fromSaved = saved.imageGenerationByModel?.[model.id];
    const fromLegacy =
      saved.imageGeneration && saved.model === model.id
        ? saved.imageGeneration
        : undefined;
    result[model.id] = normalizeImageGenerationForModel(model.id, {
      ...defaults.imageGenerationByModel?.[model.id],
      ...fromLegacy,
      ...fromSaved,
    });
  }

  return result;
}

export function buildDefaultSettings(): AiSettingsStore {
  return AI_PROVIDERS.reduce((acc, provider) => {
    acc[provider.id] = getDefaultProviderConfig(provider);
    return acc;
  }, {} as AiSettingsStore);
}

export function mergeWithDefaults(stored: Partial<AiSettingsStore>): AiSettingsStore {
  const defaults = buildDefaultSettings();
  for (const provider of AI_PROVIDERS) {
    const saved = stored[provider.id];
    if (saved) {
      defaults[provider.id] = {
        ...defaults[provider.id],
        ...saved,
        baseUrl: saved.baseUrl || provider.baseUrl,
        model: provider.models.some((m) => m.id === saved.model)
          ? saved.model
          : defaults[provider.id].model,
        imageGenerationByModel: provider.imageOnly
          ? mergeImageGenerationByModel(provider, saved, defaults[provider.id])
          : defaults[provider.id].imageGenerationByModel,
      };
    }
  }
  return defaults;
}

export async function loadAiSettingsFromStorage(): Promise<AiSettingsStore> {
  if (typeof window === "undefined") return buildDefaultSettings();
  try {
    const stored = await loadEncryptedJson<Partial<AiSettingsStore>>(
      AI_SETTINGS_STORAGE_KEY
    );
    return stored ? mergeWithDefaults(stored) : buildDefaultSettings();
  } catch {
    return buildDefaultSettings();
  }
}

export async function saveAiSettingsToStorage(
  settings: AiSettingsStore
): Promise<void> {
  if (typeof window === "undefined") return;
  await saveEncryptedJson(AI_SETTINGS_STORAGE_KEY, settings);
}
