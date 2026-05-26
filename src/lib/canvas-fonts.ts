import type { Canvas, Textbox } from "fabric";
import { isTextLikeObject } from "@/components/image-editor/text-position";
import { fitTextboxWidthToContent } from "@/components/image-editor/text-auto-wrap";
import { loadFontFace, type FontOption } from "@/lib/custom-fonts";

/** 收集画布上文本对象使用的 fontFamily */
export function collectFontFamiliesFromCanvas(canvas: Canvas): string[] {
  const families = new Set<string>();
  for (const obj of canvas.getObjects()) {
    if (!isTextLikeObject(obj)) continue;
    const family = (obj as Textbox).fontFamily;
    if (typeof family === "string" && family.trim()) {
      families.add(family.trim());
    }
  }
  return [...families];
}

/** 按画布实际用到的字体加载自定义 @font-face */
export async function loadFontsForCanvas(
  families: string[],
  catalog: FontOption[]
): Promise<void> {
  const customUrls = new Map(
    catalog
      .filter((f) => f.source === "custom" && f.url)
      .map((f) => [f.family, f.url!])
  );

  await Promise.allSettled(
    families.map((family) => {
      const url = customUrls.get(family);
      return url ? loadFontFace(family, url) : Promise.resolve();
    })
  );

  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready;
  }
}

/**
 * 字体就绪后刷新文本度量与缓存（解决首屏用 fallback 字体排版、编辑时才纠正的问题）
 */
export function refreshCanvasTextRendering(canvas: Canvas): void {
  canvas.getObjects().forEach((obj) => {
    if (!isTextLikeObject(obj)) return;
    const text = obj as Textbox;
    const family = text.fontFamily;
    if (typeof family === "string" && family) {
      text.set({ fontFamily: family });
    }
    text.dirty = true;
    text._clearCache?.();
    fitTextboxWidthToContent(text);
    text.setCoords();
  });
  canvas.requestRenderAll();
}

/** 加载画布所需字体并刷新文本渲染 */
export async function ensureCanvasFontsReady(
  canvas: Canvas,
  catalog: FontOption[]
): Promise<void> {
  const families = collectFontFamiliesFromCanvas(canvas);
  await loadFontsForCanvas(families, catalog);
  refreshCanvasTextRendering(canvas);
}
