export type AiProviderId = "deepseek" | "openai" | "apiyi";

export type AiImageSize = "512" | "1K" | "2K" | "4K";

export type AiResponseModality = "IMAGE" | "TEXT";

export type AiThinkingLevel = "minimal" | "High";

/** API易 Gemini 生图参数 */
export interface AiImageGenerationConfig {
  aspectRatio: string;
  imageSize: AiImageSize;
  responseModalities: AiResponseModality[];
  /** gemini-3.1-flash-image-preview：minimal / High */
  thinkingLevel?: AiThinkingLevel;
  /** gemini-3.1-flash-image-preview：是否返回思维过程 */
  includeThoughts?: boolean;
}

export interface AiModelPreset {
  id: string;
  label: string;
}

export interface AiProviderDefinition {
  id: AiProviderId;
  name: string;
  logo: string;
  baseUrl: string;
  models: AiModelPreset[];
  available: boolean;
  /** 仅生图，隐藏温度等对话参数 */
  imageOnly?: boolean;
}

export interface AiProviderConfig {
  providerId: AiProviderId;
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  /** @deprecated 使用 imageGenerationByModel */
  imageGeneration?: AiImageGenerationConfig;
  imageGenerationByModel?: Partial<Record<string, AiImageGenerationConfig>>;
}

export type AiSettingsStore = Record<AiProviderId, AiProviderConfig>;

export interface AiModelOption {
  providerId: AiProviderId;
  providerName: string;
  modelId: string;
  modelLabel: string;
  value: string;
}
