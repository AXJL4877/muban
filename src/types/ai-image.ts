import type { AiProviderId } from "@/types/ai";

export type TemplateImageZoneKind = "selectionRegion" | "image";

/** 模板中可用于 AI 生图的选区 */
export interface TemplateImageZone {
  elementIndex: number;
  kind: TemplateImageZoneKind;
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

export type AiImageSizeMode = "pixels" | "aspectRatio";

export interface AiImageModelPreset {
  id: string;
  label: string;
  /** OpenAI 为像素尺寸；Gemini 为宽高比 */
  sizes: string[];
  defaultSize: string;
  sizeMode?: AiImageSizeMode;
}

export interface AiImageProviderDefinition {
  id: AiProviderId;
  name: string;
  available: boolean;
  models: AiImageModelPreset[];
}

export interface AiImageModelOption {
  providerId: AiProviderId;
  providerName: string;
  modelId: string;
  modelLabel: string;
  value: string;
  defaultSize: string;
  sizes: string[];
  sizeMode?: AiImageSizeMode;
}
