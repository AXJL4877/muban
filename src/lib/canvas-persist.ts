import { FabricImage, type Canvas, type FabricObject } from "fabric";
import {
  BACKGROUND_ROLE_KEY,
  buildBackgroundPersistDef,
  clearNativeCanvasBackground,
  getNativeBackgroundState,
  hasNativeBackground,
  isBackgroundLayer,
  isBackgroundLayerJson,
  setNativeCanvasBackground,
  stripFabricBackgroundArtifacts,
  syncCanvasBackgroundColor,
} from "@/components/image-editor/background-layer";
import { FABRIC_CUSTOM_PROPS } from "@/components/image-editor/element-id";
import { sanitizeTextObjectsInCanvasJson } from "@/components/image-editor/text-auto-wrap";
import type { FabricCanvasJson } from "@/types/image-template";

const PERSIST_PROPS = [...FABRIC_CUSTOM_PROPS];

function isImageDef(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

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
  const native = getNativeBackgroundState(canvas);
  if (native) {
    json.backgroundImage = buildBackgroundPersistDef(
      canvas,
      await normalizeImageSrc(native.src)
    );
    return;
  }

  const bg = canvas.backgroundImage;
  if (!bg || !(bg instanceof FabricImage)) return;

  const bgJson = bg.toObject(PERSIST_PROPS as never) as unknown as Record<
    string,
    unknown
  >;
  const el = bg.getElement() as HTMLImageElement | undefined;
  const rawSrc = (el?.currentSrc || el?.src || bgJson.src) as string | undefined;
  if (typeof rawSrc === "string" && rawSrc.length > 0) {
    bgJson.src = await normalizeImageSrc(rawSrc);
    bgJson[BACKGROUND_ROLE_KEY] = "background";
  }
  json.backgroundImage = bgJson;
}

/** 从 JSON / Fabric 遗留层恢复为原生底图 */
async function restoreNativeBackground(
  canvas: Canvas,
  json: FabricCanvasJson
): Promise<void> {
  stripFabricBackgroundArtifacts(canvas);

  if (isImageDef(json.backgroundImage)) {
    const src = json.backgroundImage.src;
    if (typeof src === "string" && src.length > 0) {
      await setNativeCanvasBackground(
        canvas,
        await normalizeImageSrc(src),
        { resizeMode: "keep" }
      );
      return;
    }
  }

  const legacyObj = canvas
    .getObjects()
    .find((o) => isLikelyBackgroundLayer(o, canvas));

  if (legacyObj) {
    const src =
      legacyObj instanceof FabricImage
        ? legacyObj.getSrc()
        : (legacyObj as FabricObject & { src?: string }).src;
    if (typeof src === "string" && src.length > 0) {
      canvas.remove(legacyObj);
      legacyObj.dispose();
      await setNativeCanvasBackground(canvas, await normalizeImageSrc(src), {
        resizeMode: "keep",
      });
    }
  }
}

/** 仅移除底图，保留画板尺寸与其它元素 */
export function removeCanvasBackground(canvas: Canvas): void {
  clearNativeCanvasBackground(canvas);
  canvas.calcOffset();
  canvas.requestRenderAll();
}

/** 判断是否为误放在对象层、铺满画布的底图（旧数据） */
function isLikelyBackgroundLayer(obj: FabricObject, canvas: Canvas): boolean {
  if (isBackgroundLayer(obj)) return true;
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

/** 清理重复 Fabric 底图对象，统一为原生底图 */
export async function normalizeCanvasLayering(canvas: Canvas): Promise<void> {
  if (hasNativeBackground(canvas)) {
    const toRemove = canvas
      .getObjects()
      .filter((o) => isLikelyBackgroundLayer(o, canvas));
    for (const obj of toRemove) {
      canvas.remove(obj);
      obj.dispose();
    }
    stripFabricBackgroundArtifacts(canvas);
    syncCanvasBackgroundColor(canvas);
    return;
  }

  const candidates = canvas
    .getObjects()
    .filter((o) => isLikelyBackgroundLayer(o, canvas));

  if (candidates.length > 0) {
    const source = candidates[0];
    const src =
      source instanceof FabricImage
        ? source.getSrc()
        : (source as FabricObject & { src?: string }).src;
    if (typeof src === "string" && src.length > 0) {
      for (const obj of candidates) {
        canvas.remove(obj);
        obj.dispose();
      }
      await setNativeCanvasBackground(canvas, await normalizeImageSrc(src));
    }
  }

  stripFabricBackgroundArtifacts(canvas);
  syncCanvasBackgroundColor(canvas);
}

/** 用 data URL 设置画布底图（画板尺寸与图片一致） */
export async function setCanvasBackgroundFromDataUrl(
  canvas: Canvas,
  dataUrl: string
): Promise<{ width: number; height: number }> {
  const normalized = await normalizeImageSrc(dataUrl);
  return setNativeCanvasBackground(canvas, normalized, {
    resizeMode: "to-image",
  });
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
  const bgSnapshot = isImageDef(embedded.backgroundImage)
    ? (embedded.backgroundImage as Record<string, unknown>)
    : null;

  const loadPayload = structuredClone(embedded) as FabricCanvasJson;
  delete loadPayload.backgroundImage;

  if (Array.isArray(loadPayload.objects)) {
    loadPayload.objects = loadPayload.objects.filter(
      (o) => !isBackgroundLayerJson(o)
    );
  }

  await canvas.loadFromJSON(loadPayload);

  if (options?.canvasSize) {
    canvas.setDimensions({
      width: options.canvasSize.width,
      height: options.canvasSize.height,
    });
  }

  canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

  if (bgSnapshot) {
    const withBg = { ...embedded, backgroundImage: bgSnapshot };
    await restoreNativeBackground(canvas, withBg);
  } else {
    await restoreNativeBackground(canvas, embedded);
  }

  await normalizeCanvasLayering(canvas);
  canvas.requestRenderAll();
}

export async function canvasToPersistJson(canvas: Canvas): Promise<FabricCanvasJson> {
  const json = canvas.toObject(PERSIST_PROPS as never) as FabricCanvasJson;

  if (Array.isArray(json.objects)) {
    json.objects = json.objects.filter((o) => !isBackgroundLayerJson(o));
  }

  sanitizeTextObjectsInCanvasJson(json);
  await attachBackgroundToJson(canvas, json);
  return embedBlobUrlsInCanvasJson(json);
}
