import { AI_PROVIDERS } from "@/lib/ai-providers";
import type { AiModelOption } from "@/types/ai";
import type { AiSettingsStore } from "@/types/ai";

export function getEnabledModelOptions(
  settings: AiSettingsStore
): AiModelOption[] {
  return AI_PROVIDERS.flatMap((provider) => {
    const config = settings[provider.id];
    if (!provider.available || !config.enabled) return [];
    return provider.models.map((model) => ({
      providerId: provider.id,
      providerName: provider.name,
      modelId: model.id,
      modelLabel: model.label,
      value: `${provider.id}:${model.id}`,
    }));
  });
}

export function parseModelValue(
  value: string
): { providerId: AiModelOption["providerId"]; modelId: string } | null {
  const idx = value.indexOf(":");
  if (idx <= 0) return null;
  return {
    providerId: value.slice(0, idx) as AiModelOption["providerId"],
    modelId: value.slice(idx + 1),
  };
}
