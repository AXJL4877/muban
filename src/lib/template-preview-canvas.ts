import { FabricImage, type Canvas, type FabricObject } from "fabric";
import { SELECTION_REGION_ROLE, SELECTION_REGION_ROLE_KEY } from "@/components/image-editor/selection-region";
import { applyAutoWrapAllEnabled } from "@/components/image-editor/text-auto-wrap";
import {
  installNativeBackgroundRenderer,
  syncCanvasBackgroundColor,
} from "@/components/image-editor/background-layer";
import { buildTemplatePreviewJson } from "@/lib/compose-template-preview";
import { loadPersistedCanvasJson } from "@/lib/canvas-persist";
import {
  getBoundsFromFabricObject,
  type BoundsRect,
} from "@/lib/fabric-bounds";
import type { TemplateImageZone } from "@/types/ai-image";
import type { FabricCanvasJson, SavedImageTemplate } from "@/types/image-template";
import type { TemplateJsonKeyConfig } from "@/types/ai-template-keys";

function getEditorRole(obj: Record<string, unknown>): string | null {
  const direct = obj[SELECTION_REGION_ROLE_KEY];
  if (typeof direct === "string") return direct;
  const extra = obj.extra;
  if (extra && typeof extra === "object") {
    const role = (extra as Record<string, unknown>)[SELECTION_REGION_ROLE_KEY];
    if (typeof role === "string") return role;
  }
  return null;
}

function findCanvasObjectForZone(
  canvas: Canvas,
  zone: TemplateImageZone,
  targetJson?: Record<string, unknown>
): FabricObject | undefined {
  const role = targetJson ? getEditorRole(targetJson) : null;

  if (role) {
    const byRole = canvas
      .getObjects()
      .find(
        (o) =>
          (o as FabricObject & { editorRole?: string }).editorRole === role
      );
    if (byRole) return byRole;
  }

  return canvas.getObjects().find((o) => {
    const rect = getBoundsFromFabricObject(o);
    return (
      Math.abs(rect.left - zone.left) <= 4 &&
      Math.abs(rect.top - zone.top) <= 4 &&
      Math.abs(rect.width - zone.width) <= 4 &&
      Math.abs(rect.height - zone.height) <= 4
    );
  });
}

function resolvePlacementBounds(
  zone: TemplateImageZone,
  targetObj?: FabricObject
): BoundsRect {
  if (targetObj) {
    return getBoundsFromFabricObject(targetObj);
  }
  return {
    left: zone.left,
    top: zone.top,
    width: zone.width,
    height: zone.height,
  };
}

function fitImageToBounds(img: FabricObject, bounds: BoundsRect): void {
  const w = img.width ?? 1;
  const h = img.height ?? 1;
  img.set({
    left: bounds.left + bounds.width / 2,
    top: bounds.top + bounds.height / 2,
    originX: "center",
    originY: "center",
    scaleX: bounds.width / w,
    scaleY: bounds.height / h,
    angle: 0,
  });
  img.setCoords();
}

export async function placeGeneratedImageInPreview(
  canvas: Canvas,
  originalJson: FabricCanvasJson,
  zone: TemplateImageZone,
  imageSrc: string
): Promise<void> {
  const objects = originalJson.objects;
  const targetJson = Array.isArray(objects)
    ? (objects[zone.elementIndex] as Record<string, unknown> | undefined)
    : undefined;

  const targetObj = findCanvasObjectForZone(canvas, zone, targetJson);
  const bounds = resolvePlacementBounds(zone, targetObj);
  const img = await FabricImage.fromURL(imageSrc, { crossOrigin: "anonymous" });

  if (zone.kind === "selectionRegion") {
    if (targetObj) {
      targetObj.set({ visible: false, evented: false, selectable: false });
    }
    fitImageToBounds(img, bounds);
    canvas.add(img);
  } else if (targetObj instanceof FabricImage) {
    await targetObj.setSrc(imageSrc, { crossOrigin: "anonymous" });
    fitImageToBounds(targetObj, bounds);
  } else {
    fitImageToBounds(img, bounds);
    canvas.add(img);
  }
}

export function setCanvasPreviewInteraction(
  canvas: Canvas,
  editable: boolean
): void {
  canvas.selection = editable;
  canvas.skipTargetFind = !editable;
  canvas.defaultCursor = editable ? "default" : "default";
  canvas.hoverCursor = editable ? "move" : "default";

  for (const obj of canvas.getObjects()) {
    const role = (obj as FabricObject & { editorRole?: string }).editorRole;
    const isHiddenRegion =
      role === SELECTION_REGION_ROLE && obj.visible === false;

    if (isHiddenRegion) {
      obj.set({ selectable: false, evented: false });
      continue;
    }

    obj.set({
      selectable: editable,
      evented: editable,
    });
  }
}

export interface LoadTemplatePreviewOptions {
  zone?: TemplateImageZone | null;
  generatedImageSrc?: string | null;
  aiJson?: Record<string, unknown> | null;
  keyConfigs?: TemplateJsonKeyConfig[];
  editable?: boolean;
}

export async function loadTemplatePreviewCanvas(
  canvas: Canvas,
  template: SavedImageTemplate,
  options?: LoadTemplatePreviewOptions
): Promise<void> {
  installNativeBackgroundRenderer(canvas);
  canvas.set({
    preserveObjectStacking: true,
    backgroundVpt: false,
  });
  syncCanvasBackgroundColor(canvas);

  const previewJson = buildTemplatePreviewJson(template, {
    aiJson: options?.aiJson,
    keyConfigs: options?.keyConfigs,
  });

  await loadPersistedCanvasJson(canvas, previewJson, {
    canvasSize: template.canvasSize,
  });

  applyAutoWrapAllEnabled(canvas);

  if (options?.zone && options?.generatedImageSrc) {
    await placeGeneratedImageInPreview(
      canvas,
      previewJson,
      options.zone,
      options.generatedImageSrc
    );
  }

  setCanvasPreviewInteraction(canvas, options?.editable ?? false);
  canvas.requestRenderAll();
}
