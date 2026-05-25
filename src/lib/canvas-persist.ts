import { FabricImage, type Canvas, type FabricObject, type TCrossOrigin } from "fabric";
import { FABRIC_CUSTOM_PROPS } from "@/components/image-editor/element-id";
import type { FabricCanvasJson } from "@/types/image-template";

const PERSIST_PROPS = [...FABRIC_CUSTOM_PROPS];

const BG_LAYOUT_KEYS = [
  "left",
  "top",
  "scaleX",
  "scaleY",
  "originX",
  "originY",
  "width",
  "height",
  "angle",
  "opacity",
  "flipX",
  "flipY",
  "skewX",
  "skewY",
] as const;

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function blobUrlToDataUrl(url: string): Promise<string | null> {
  if (!url.startsWith("blob:")) return null;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function normalizeImageSrc(src: string): Promise<string> {
  if (src.startsWith("blob:")) {
    return (await blobUrlToDataUrl(src)) ?? src;
  }
  return src;
}

async function embedSrcField(obj: Record<string, unknown>): Promise<void> {
  const src = obj.src;
  if (typeof src !== "string" || src.length === 0) return;
  obj.src = await normalizeImageSrc(src);
}

function isImageDef(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/** 将画布 JSON 中的 blob: 图片地址转为 data URL，避免保存/跳转后底图失效 */
export async function embedBlobUrlsInCanvasJson(
  json: FabricCanvasJson
): Promise<FabricCanvasJson> {
  const clone = structuredClone(json) as FabricCanvasJson;

  if (isImageDef(clone.backgroundImage)) {
    await embedSrcField(clone.backgroundImage);
  }
  if (isImageDef(clone.overlayImage)) {
    await embedSrcField(clone.overlayImage);
  }

  const objects = clone.objects;
  if (Array.isArray(objects)) {
    await Promise.all(
      objects.map(async (obj) => {
        if (isImageDef(obj)) await embedSrcField(obj);
      })
    );
  }

  return clone;
}

async function attachBackgroundToJson(
  canvas: Canvas,
  json: FabricCanvasJson
): Promise<void> {
  const bg = canvas.backgroundImage;
  if (!bg || !(bg instanceof FabricImage)) return;

  const bgJson = bg.toObject() as Record<string, unknown>;
  const el = bg.getElement() as HTMLImageElement | undefined;
  const rawSrc = (el?.currentSrc || el?.src || bgJson.src) as string | undefined;
  if (typeof rawSrc === "string" && rawSrc.length > 0) {
    bgJson.src = await normalizeImageSrc(rawSrc);
  }
  json.backgroundImage = bgJson;
}

/** 从 JSON 定义恢复 canvas.backgroundImage（loadFromJSON 失败时的兜底） */
export async function restoreBackgroundFromJson(
  canvas: Canvas,
  json: FabricCanvasJson
): Promise<boolean> {
  if (canvas.backgroundImage) return true;

  const bgDef = json.backgroundImage;
  if (!isImageDef(bgDef)) return false;

  const src = bgDef.src;
  if (typeof src !== "string" || src.length === 0) return false;

  try {
    const crossOrigin = (bgDef.crossOrigin as TCrossOrigin | undefined) ?? "anonymous";
    const img = await FabricImage.fromURL(await normalizeImageSrc(src), {
      crossOrigin,
    });

    const layout: Record<string, unknown> = {
      selectable: false,
      evented: false,
    };
    for (const key of BG_LAYOUT_KEYS) {
      if (bgDef[key] !== undefined) layout[key] = bgDef[key];
    }
    img.set(layout);
    await canvas.set("backgroundImage", img);
    return true;
  } catch {
    return false;
  }
}

/** 判断是否为误放在对象层、铺满画布的底图 */
function isLikelyBackgroundLayer(obj: FabricObject, canvas: Canvas): boolean {
  if (obj.type !== "image") return false;

  const cw = canvas.getWidth();
  const ch = canvas.getHeight();
  if (cw <= 0 || ch <= 0) return false;

  const rect = obj.getBoundingRect();
  const coverW = rect.width / cw;
  const coverH = rect.height / ch;
  if (coverW < 0.85 || coverH < 0.85) return false;

  if (obj.selectable === false && obj.evented === false) return true;

  return canvas.getObjects().indexOf(obj) === 0;
}

/** 确保文字/图片在对象层最前，底图仅存在于 canvas.backgroundImage */
export async function normalizeCanvasLayering(canvas: Canvas): Promise<void> {
  const candidates = canvas
    .getObjects()
    .filter((o) => isLikelyBackgroundLayer(o, canvas));

  if (!canvas.backgroundImage && candidates.length > 0) {
    const source = candidates[0];
    const src =
      source instanceof FabricImage
        ? source.getSrc()
        : (source as FabricObject & { src?: string }).src;
    if (typeof src === "string" && src.length > 0) {
      const layout: Record<string, unknown> = {
        selectable: false,
        evented: false,
      };
      for (const key of BG_LAYOUT_KEYS) {
        const value = source.get(key as "left");
        if (value !== undefined) layout[key] = value;
      }

      const crossOrigin =
        (source.get("crossOrigin") as TCrossOrigin | undefined) ?? "anonymous";
      const img = await FabricImage.fromURL(await normalizeImageSrc(src), {
        crossOrigin,
      });
      img.set(layout);
      await canvas.set("backgroundImage", img);
    }
  }

  const toRemove = canvas
    .getObjects()
    .filter((o) => isLikelyBackgroundLayer(o, canvas));

  for (const obj of toRemove) {
    canvas.remove(obj);
    obj.dispose();
  }

  for (const obj of canvas.getObjects()) {
    canvas.bringObjectToFront(obj);
  }
}

/** 用 data URL 设置画布底图（不清空已有文字/元素） */
export async function setCanvasBackgroundFromDataUrl(
  canvas: Canvas,
  dataUrl: string
): Promise<{ width: number; height: number }> {
  const img = await FabricImage.fromURL(dataUrl, { crossOrigin: "anonymous" });
  const hasObjects = canvas.getObjects().length > 0;

  let targetW = canvas.getWidth();
  let targetH = canvas.getHeight();

  if (!hasObjects) {
    targetW = Math.round(img.width || 900);
    targetH = Math.round(img.height || 600);
    canvas.setDimensions({ width: targetW, height: targetH });
  }

  if (canvas.backgroundImage) {
    canvas.backgroundImage.dispose();
  }

  img.set({
    left: 0,
    top: 0,
    originX: "left",
    originY: "top",
    scaleX: targetW / (img.width || 1),
    scaleY: targetH / (img.height || 1),
    selectable: false,
    evented: false,
    src: dataUrl,
  });

  await canvas.set("backgroundImage", img);
  await normalizeCanvasLayering(canvas);

  return { width: targetW, height: targetH };
}

export interface LoadPersistedCanvasOptions {
  canvasSize?: { width: number; height: number };
}

/** 从持久化 JSON 加载画布（含底图恢复） */
export async function loadPersistedCanvasJson(
  canvas: Canvas,
  json: FabricCanvasJson,
  options?: LoadPersistedCanvasOptions
): Promise<void> {
  const embedded = await embedBlobUrlsInCanvasJson(json);
  await canvas.loadFromJSON(embedded);

  if (options?.canvasSize) {
    canvas.setDimensions({
      width: options.canvasSize.width,
      height: options.canvasSize.height,
    });
  }

  canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
  await restoreBackgroundFromJson(canvas, embedded);
  await normalizeCanvasLayering(canvas);
  canvas.requestRenderAll();
}

export async function canvasToPersistJson(canvas: Canvas): Promise<FabricCanvasJson> {
  const json = canvas.toObject([...PERSIST_PROPS]) as FabricCanvasJson;
  await attachBackgroundToJson(canvas, json);
  return embedBlobUrlsInCanvasJson(json);
}
