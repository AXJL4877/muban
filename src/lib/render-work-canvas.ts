import { Canvas } from "fabric";
import { applyArtboardAlignAll } from "@/components/image-editor/artboard-align";
import { applyAutoWrapAllEnabled } from "@/components/image-editor/text-auto-wrap";
import {
  installNativeBackgroundRenderer,
  syncCanvasBackgroundColor,
} from "@/components/image-editor/background-layer";
import { loadPersistedCanvasJson } from "@/lib/canvas-persist";
import { ensureCanvasFontsReady } from "@/lib/canvas-fonts";
import { prepareFontCatalog } from "@/lib/custom-fonts";
import type { SavedImageTemplate } from "@/types/image-template";

/** 将作品画布渲染为 PNG data URL（客户端调用） */
export async function renderWorkComposedImage(
  work: SavedImageTemplate,
  multiplier = 1
): Promise<string> {
  const canvasEl = document.createElement("canvas");
  const canvas = new Canvas(canvasEl, {
    width: work.canvasSize.width,
    height: work.canvasSize.height,
    backgroundColor: "#ffffff",
    selection: false,
    preserveObjectStacking: true,
    backgroundVpt: false,
  });

  try {
    installNativeBackgroundRenderer(canvas);
    syncCanvasBackgroundColor(canvas);

    await loadPersistedCanvasJson(canvas, work.json, {
      canvasSize: work.canvasSize,
    });

    const fontCatalog = await prepareFontCatalog();
    await ensureCanvasFontsReady(canvas, fontCatalog);
    applyAutoWrapAllEnabled(canvas);
    applyArtboardAlignAll(canvas);

    canvas.requestRenderAll();
    await new Promise((resolve) => window.setTimeout(resolve, 120));

    const dataUrl = canvas.toDataURL({ format: "png", multiplier });
    if (!dataUrl || dataUrl === "data:,") {
      throw new Error("画布导出失败");
    }
    return dataUrl;
  } finally {
    canvas.dispose();
  }
}
