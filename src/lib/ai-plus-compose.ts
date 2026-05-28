import { getBoundsFromFabricJson } from "@/lib/fabric-bounds";
import { applyAiJsonToCanvas } from "@/lib/apply-ai-json-to-canvas";
import type { TemplateImageZone } from "@/types/ai-image";
import type { TemplateJsonKeyConfig } from "@/types/ai-template-keys";
import type { FabricCanvasJson, SavedImageTemplate } from "@/types/image-template";

async function loadImageNaturalSize(
  src: string
): Promise<{ width: number; height: number }> {
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      resolve({
        width: Math.max(1, img.naturalWidth || img.width || 1),
        height: Math.max(1, img.naturalHeight || img.height || 1),
      });
    };
    img.onerror = () => reject(new Error("Failed to load image size"));
    img.src = src;
  });
}

function createImageObjectForBounds(
  src: string,
  bounds: { left: number; top: number; width: number; height: number },
  naturalSize: { width: number; height: number }
): Record<string, unknown> {
  return {
    type: "image",
    version: "6.7.1",
    originX: "center",
    originY: "center",
    left: bounds.left + bounds.width / 2,
    top: bounds.top + bounds.height / 2,
    width: naturalSize.width,
    height: naturalSize.height,
    scaleX: bounds.width / naturalSize.width,
    scaleY: bounds.height / naturalSize.height,
    angle: 0,
    flipX: false,
    flipY: false,
    opacity: 1,
    visible: true,
    selectable: true,
    evented: true,
    src,
    crossOrigin: "anonymous",
  };
}

async function applyGeneratedImageToCanvasJson(
  json: FabricCanvasJson,
  zone: TemplateImageZone,
  generatedImageSrc: string
): Promise<FabricCanvasJson> {
  const next = structuredClone(json) as FabricCanvasJson;
  const objects = next.objects;
  if (!Array.isArray(objects)) return next;
  const target = objects[zone.elementIndex];
  if (!target || typeof target !== "object") return next;

  const naturalSize = await loadImageNaturalSize(generatedImageSrc);
  if (zone.kind === "image") {
    const targetObj = target as Record<string, unknown>;
    const bounds = getBoundsFromFabricJson(targetObj);
    targetObj.src = generatedImageSrc;
    targetObj.cropX = 0;
    targetObj.cropY = 0;
    targetObj.originX = "center";
    targetObj.originY = "center";
    targetObj.left = bounds.left + bounds.width / 2;
    targetObj.top = bounds.top + bounds.height / 2;
    targetObj.width = naturalSize.width;
    targetObj.height = naturalSize.height;
    targetObj.scaleX = bounds.width / naturalSize.width;
    targetObj.scaleY = bounds.height / naturalSize.height;
    return next;
  }

  const bounds = getBoundsFromFabricJson(target as Record<string, unknown>);
  objects[zone.elementIndex] = createImageObjectForBounds(
    generatedImageSrc,
    bounds,
    naturalSize
  );
  return next;
}

export interface ComposeAiPlusCanvasOptions {
  template: SavedImageTemplate;
  keyConfigs: TemplateJsonKeyConfig[];
  aiJson: Record<string, unknown> | null;
  zone: TemplateImageZone | null;
  generatedImageSrc: string | null;
}

export async function composeAiPlusCanvasJson(
  options: ComposeAiPlusCanvasOptions
): Promise<FabricCanvasJson> {
  const { template, keyConfigs, aiJson, zone, generatedImageSrc } = options;
  let json = structuredClone(template.json) as FabricCanvasJson;

  if (aiJson && keyConfigs.length > 0) {
    json = applyAiJsonToCanvas(json, aiJson, keyConfigs);
  }

  if (zone && generatedImageSrc) {
    json = await applyGeneratedImageToCanvasJson(json, zone, generatedImageSrc);
  }

  return json;
}
