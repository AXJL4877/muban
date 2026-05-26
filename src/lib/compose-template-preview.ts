import { applyAiJsonToCanvas } from "@/lib/apply-ai-json-to-canvas";
import type { FabricCanvasJson, SavedImageTemplate } from "@/types/image-template";
import type { TemplateJsonKeyConfig } from "@/types/ai-template-keys";

export interface ComposeTemplatePreviewOptions {
  aiJson?: Record<string, unknown> | null;
  keyConfigs?: TemplateJsonKeyConfig[];
}

/** 构建预览用画布 JSON（仅合并 AI 文案，生图在加载后写入画布） */
export function buildTemplatePreviewJson(
  template: SavedImageTemplate,
  options?: ComposeTemplatePreviewOptions
): FabricCanvasJson {
  let json = structuredClone(template.json) as FabricCanvasJson;

  if (options?.aiJson && options.keyConfigs?.length) {
    json = applyAiJsonToCanvas(json, options.aiJson, options.keyConfigs);
  }

  return json;
}
