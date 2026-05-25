export type AiProviderId = "deepseek" | "openai";

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
}

export interface AiProviderConfig {
  providerId: AiProviderId;
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
}

export type AiSettingsStore = Record<AiProviderId, AiProviderConfig>;
