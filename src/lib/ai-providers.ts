import type { AiProviderConfig, AiProviderDefinition, AiSettingsStore } from "@/types/ai";

export const AI_SETTINGS_STORAGE_KEY = "ai-provider-settings";

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
];

export function getDefaultProviderConfig(
  provider: AiProviderDefinition
): AiProviderConfig {
  return {
    providerId: provider.id,
    enabled: provider.id === "deepseek",
    apiKey: "",
    baseUrl: provider.baseUrl,
    model: provider.models[0]?.id ?? "",
    temperature: 0.7,
  };
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
      };
    }
  }
  return defaults;
}
