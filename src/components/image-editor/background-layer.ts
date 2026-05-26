import type { Canvas, FabricObject } from "fabric";

export const BACKGROUND_ROLE = "background";
export const BACKGROUND_ROLE_KEY = "editorRole";

/** 旧版 Fabric 底图对象标记，仅用于迁移/清理 */
export const BACKGROUND_LAYER_PROPS = [BACKGROUND_ROLE_KEY] as const;

export interface NativeBackgroundState {
  src: string;
  image: HTMLImageElement;
}

const installedRenderers = new WeakSet<Canvas>();
const nativeBackgroundByCanvas = new WeakMap<Canvas, NativeBackgroundState>();

export function isBackgroundLayer(obj: FabricObject | undefined): boolean {
  if (!obj) return false;
  return (
    (obj as FabricObject & { editorRole?: string }).editorRole ===
    BACKGROUND_ROLE
  );
}

export function isBackgroundLayerJson(obj: unknown): boolean {
  if (!obj || typeof obj !== "object") return false;
  return (obj as Record<string, unknown>).editorRole === BACKGROUND_ROLE;
}

export function getNativeBackgroundState(
  canvas: Canvas
): NativeBackgroundState | undefined {
  return nativeBackgroundByCanvas.get(canvas);
}

export function hasNativeBackground(canvas: Canvas): boolean {
  return nativeBackgroundByCanvas.has(canvas);
}

export function getImagePixelSize(image: HTMLImageElement): {
  width: number;
  height: number;
} {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  return { width, height };
}

export function loadBackgroundImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = document.createElement("img");
    img.crossOrigin = "anonymous";
    img.onload = () => {
      void img
        .decode()
        .catch(() => undefined)
        .then(() => resolve(img));
    };
    img.onerror = () => reject(new Error("底图加载失败"));
    img.src = src;
  });
}

/**
 * 在 Fabric 渲染管线之前用原生 drawImage 绘制底图，
 * 避免 FabricImage 的 resizeFilter / 缓存导致 JPG 发淡。
 */
export function installNativeBackgroundRenderer(canvas: Canvas): void {
  if (installedRenderers.has(canvas)) return;
  installedRenderers.add(canvas);

  canvas.on("before:render", ({ ctx }) => {
    const state = nativeBackgroundByCanvas.get(canvas);
    if (!state?.image.complete) return;

    const context = ctx as CanvasRenderingContext2D;
    const w = canvas.getWidth();
    const h = canvas.getHeight();
    if (w <= 0 || h <= 0) return;

    const retina = canvas.getRetinaScaling();

    context.save();
    // 不可重置为 identity：Fabric 在 Retina 下已对 ctx 做了 scale(dpr)，
    // 重置后 drawImage 只铺满逻辑尺寸的 1/dpr 区域，其余为透明（看起来像画板比底图大）
    if (retina !== 1) {
      context.setTransform(retina, 0, 0, retina, 0, 0);
    }
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(state.image, 0, 0, w, h);
    context.restore();
  });
}

export function stripFabricBackgroundArtifacts(canvas: Canvas): void {
  if (canvas.backgroundImage) {
    canvas.backgroundImage.dispose();
    void canvas.set("backgroundImage", undefined);
  }
  canvas
    .getObjects()
    .filter((o) => isBackgroundLayer(o))
    .forEach((o) => {
      canvas.remove(o);
      o.dispose();
    });
}

export function syncCanvasBackgroundColor(canvas: Canvas): void {
  canvas.backgroundColor = hasNativeBackground(canvas)
    ? "transparent"
    : "#ffffff";
}

export interface SetNativeBackgroundOptions {
  /**
   * to-image：画板尺寸与图片像素一致（导入底图时用）
   * keep：保持当前画板尺寸（从模板恢复时用）
   */
  resizeMode?: "to-image" | "keep";
}

export async function setNativeCanvasBackground(
  canvas: Canvas,
  src: string,
  options?: SetNativeBackgroundOptions
): Promise<{ width: number; height: number }> {
  const image = await loadBackgroundImageElement(src);
  const { width: naturalW, height: naturalH } = getImagePixelSize(image);

  let w = canvas.getWidth();
  let h = canvas.getHeight();

  if (
    options?.resizeMode !== "keep" &&
    naturalW > 0 &&
    naturalH > 0
  ) {
    w = naturalW;
    h = naturalH;
    canvas.setDimensions({ width: w, height: h });
  }

  stripFabricBackgroundArtifacts(canvas);
  nativeBackgroundByCanvas.set(canvas, { src, image });
  syncCanvasBackgroundColor(canvas);
  canvas.calcOffset();
  canvas.requestRenderAll();

  return { width: canvas.getWidth(), height: canvas.getHeight() };
}

export function clearNativeCanvasBackground(canvas: Canvas): void {
  nativeBackgroundByCanvas.delete(canvas);
  stripFabricBackgroundArtifacts(canvas);
  syncCanvasBackgroundColor(canvas);
}

export function buildBackgroundPersistDef(
  canvas: Canvas,
  src: string
): Record<string, unknown> {
  return {
    type: "image",
    version: "6.0.0",
    originX: "left",
    originY: "top",
    left: 0,
    top: 0,
    width: canvas.getWidth(),
    height: canvas.getHeight(),
    scaleX: 1,
    scaleY: 1,
    angle: 0,
    opacity: 1,
    selectable: false,
    evented: false,
    src,
    crossOrigin: "anonymous",
    [BACKGROUND_ROLE_KEY]: BACKGROUND_ROLE,
  };
}
