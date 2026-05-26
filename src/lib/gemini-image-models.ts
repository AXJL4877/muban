import type { AiImageGenerationConfig, AiProviderConfig } from "@/types/ai";

/** gemini-3-pro-image-preview：10 种宽高比 */
export const GEMINI_PRO_ASPECT_RATIOS = [
  "1:1",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "3:2",
  "2:3",
  "5:4",
  "4:5",
  "21:9",
] as const;

/** gemini-3.1-flash-image-preview：14 种宽高比 */
export const GEMINI_FLASH_ASPECT_RATIOS = [
  "1:1",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "3:2",
  "2:3",
  "5:4",
  "4:5",
  "21:9",
  "1:4",
  "4:1",
  "1:8",
  "8:1",
] as const;

export const GEMINI_PRO_IMAGE_SIZES = ["1K", "2K", "4K"] as const;
export const GEMINI_FLASH_IMAGE_SIZES = ["512", "1K", "2K", "4K"] as const;

export type GeminiImageModelId =
  | "gemini-3-pro-image-preview"
  | "gemini-3.1-flash-image-preview";

export interface GeminiImageModelSpec {
  id: GeminiImageModelId;
  label: string;
  aspectRatios: readonly string[];
  imageSizes: readonly string[];
  supportsThinking: boolean;
}

export const GEMINI_IMAGE_MODEL_SPECS: Record<
  GeminiImageModelId,
  GeminiImageModelSpec
> = {
  "gemini-3-pro-image-preview": {
    id: "gemini-3-pro-image-preview",
    label: "nano-banana pro",
    aspectRatios: GEMINI_PRO_ASPECT_RATIOS,
    imageSizes: GEMINI_PRO_IMAGE_SIZES,
    supportsThinking: false,
  },
  "gemini-3.1-flash-image-preview": {
    id: "gemini-3.1-flash-image-preview",
    label: "nano-banana 2",
    aspectRatios: GEMINI_FLASH_ASPECT_RATIOS,
    imageSizes: GEMINI_FLASH_IMAGE_SIZES,
    supportsThinking: true,
  },
};

export function getGeminiModelSpec(
  modelId: string
): GeminiImageModelSpec | undefined {
  return GEMINI_IMAGE_MODEL_SPECS[modelId as GeminiImageModelId];
}

export function isGeminiImageModelId(modelId: string): modelId is GeminiImageModelId {
  return modelId in GEMINI_IMAGE_MODEL_SPECS;
}

export function getDefaultImageGenerationForModel(
  modelId: string
): AiImageGenerationConfig {
  const base: AiImageGenerationConfig = {
    aspectRatio: "1:1",
    imageSize: "1K",
    responseModalities: ["IMAGE"],
  };
  if (modelId === "gemini-3.1-flash-image-preview") {
    return {
      ...base,
      thinkingLevel: "minimal",
      includeThoughts: false,
    };
  }
  return base;
}

export function getImageGenerationConfig(
  providerConfig: AiProviderConfig,
  modelId: string
): AiImageGenerationConfig {
  const defaults = getDefaultImageGenerationForModel(modelId);
  const byModel = providerConfig.imageGenerationByModel?.[modelId];
  const legacy = providerConfig.imageGeneration;
  return normalizeImageGenerationForModel(modelId, {
    ...defaults,
    ...legacy,
    ...byModel,
  });
}

export function normalizeImageGenerationForModel(
  modelId: string,
  cfg: Partial<AiImageGenerationConfig>
): AiImageGenerationConfig {
  const spec = getGeminiModelSpec(modelId);
  const defaults = getDefaultImageGenerationForModel(modelId);
  const merged = { ...defaults, ...cfg };

  if (spec) {
    if (!spec.aspectRatios.includes(merged.aspectRatio)) {
      merged.aspectRatio = defaults.aspectRatio;
    }
    if (!spec.imageSizes.includes(merged.imageSize)) {
      merged.imageSize = defaults.imageSize;
    }
  }

  if (!spec?.supportsThinking) {
    delete merged.thinkingLevel;
    delete merged.includeThoughts;
  }

  return merged;
}
