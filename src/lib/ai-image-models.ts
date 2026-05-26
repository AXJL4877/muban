import type { AiImageModelOption, AiImageProviderDefinition } from "@/types/ai-image";
import type { AiSettingsStore } from "@/types/ai";
import type { AiProviderId } from "@/types/ai";
import {
  GEMINI_FLASH_ASPECT_RATIOS,
  GEMINI_PRO_ASPECT_RATIOS,
} from "@/lib/gemini-image-models";

export const AI_IMAGE_PROVIDERS: AiImageProviderDefinition[] = [
  {
    id: "openai",
    name: "OpenAI",
    available: true,
    models: [
      {
        id: "dall-e-3",
        label: "DALL·E 3",
        sizes: ["1024x1024", "1792x1024", "1024x1792"],
        defaultSize: "1024x1024",
        sizeMode: "pixels",
      },
      {
        id: "dall-e-2",
        label: "DALL·E 2",
        sizes: ["256x256", "512x512", "1024x1024"],
        defaultSize: "1024x1024",
        sizeMode: "pixels",
      },
    ],
  },
  {
    id: "apiyi",
    name: "Nano banana",
    available: true,
    models: [
      {
        id: "gemini-3-pro-image-preview",
        label: "nano-banana pro",
        sizes: [...GEMINI_PRO_ASPECT_RATIOS],
        defaultSize: "1:1",
        sizeMode: "aspectRatio",
      },
      {
        id: "gemini-3.1-flash-image-preview",
        label: "nano-banana 2",
        sizes: [...GEMINI_FLASH_ASPECT_RATIOS],
        defaultSize: "1:1",
        sizeMode: "aspectRatio",
      },
    ],
  },
];

export function getEnabledImageModelOptions(
  settings: AiSettingsStore
): AiImageModelOption[] {
  return AI_IMAGE_PROVIDERS.flatMap((provider) => {
    const config = settings[provider.id];
    if (!provider.available || !config.enabled) return [];
    return provider.models.map((model) => ({
      providerId: provider.id,
      providerName: provider.name,
      modelId: model.id,
      modelLabel: model.label,
      value: `${provider.id}:${model.id}`,
      defaultSize: model.defaultSize,
      sizes: model.sizes,
      sizeMode: model.sizeMode,
    }));
  });
}

export function parseImageModelValue(
  value: string
): { providerId: AiProviderId; modelId: string } | null {
  const idx = value.indexOf(":");
  if (idx <= 0) return null;
  return {
    providerId: value.slice(0, idx) as AiProviderId,
    modelId: value.slice(idx + 1),
  };
}

export function getImageModelOption(
  value: string
): AiImageModelOption | undefined {
  const parsed = parseImageModelValue(value);
  if (!parsed) return undefined;
  return AI_IMAGE_PROVIDERS.flatMap((p) =>
    p.models.map((m) => ({
      providerId: p.id,
      providerName: p.name,
      modelId: m.id,
      modelLabel: m.label,
      value: `${p.id}:${m.id}`,
      defaultSize: m.defaultSize,
      sizes: m.sizes,
      sizeMode: m.sizeMode,
    }))
  ).find((o) => o.value === value);
}

function parseAspectRatio(value: string): number | null {
  const [w, h] = value.split(":").map(Number);
  if (!w || !h) return null;
  return w / h;
}

/** 根据选区宽高选择最接近的 Gemini 宽高比 */
export function pickAspectRatioForZone(
  ratios: string[],
  zoneWidth: number,
  zoneHeight: number,
  fallback: string
): string {
  if (ratios.length === 0) return fallback;
  const ratio = zoneWidth / Math.max(zoneHeight, 1);

  let best = ratios[0];
  let bestScore = Infinity;

  for (const ar of ratios) {
    const arNum = parseAspectRatio(ar);
    if (arNum == null) continue;
    const score = Math.abs(Math.log(ratio / arNum));
    if (score < bestScore) {
      bestScore = score;
      best = ar;
    }
  }
  return best;
}

/** 根据选区宽高选择最接近的 API size */
export function pickSizeForZone(
  sizes: string[],
  zoneWidth: number,
  zoneHeight: number,
  fallback: string
): string {
  if (sizes.length === 0) return fallback;
  const ratio = zoneWidth / Math.max(zoneHeight, 1);

  let best = sizes[0];
  let bestScore = Infinity;

  for (const size of sizes) {
    const [w, h] = size.split("x").map(Number);
    if (!w || !h) continue;
    const sizeRatio = w / h;
    const score = Math.abs(Math.log(ratio / sizeRatio));
    if (score < bestScore) {
      bestScore = score;
      best = size;
    }
  }
  return best;
}
