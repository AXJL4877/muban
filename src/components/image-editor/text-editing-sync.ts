import type { Canvas, Textbox } from "fabric";
import { applyArtboardAlignToObject } from "./artboard-align";
import { applyAutoWrapLive } from "./text-auto-wrap";

type TextboxWithCompose = Textbox & { inCompositionMode?: boolean };

const unbindByText = new WeakMap<Textbox, () => void>();
let syncRaf = 0;
let pendingCanvas: Canvas | null = null;
let pendingText: Textbox | null = null;

/** 在 Fabric updateFromTextArea 之后执行：实时换行 + 画板对齐 */
export function runTextEditingSync(canvas: Canvas, text: Textbox): void {
  if (!text.isEditing) return;

  const composing = !!(text as TextboxWithCompose).inCompositionMode;
  if (!composing && text.hiddenTextarea) {
    applyAutoWrapLive(text);
  }
  applyArtboardAlignToObject(canvas, text);
}

function flushTextEditingSync(): void {
  syncRaf = 0;
  const canvas = pendingCanvas;
  const text = pendingText;
  pendingCanvas = null;
  pendingText = null;
  if (!canvas || !text?.isEditing) return;
  runTextEditingSync(canvas, text);
  canvas.requestRenderAll();
}

export function scheduleTextEditingSync(canvas: Canvas, text: Textbox): void {
  pendingCanvas = canvas;
  pendingText = text;
  if (syncRaf) return;
  syncRaf = requestAnimationFrame(flushTextEditingSync);
}

/** 编辑态：监听 textarea，在每次按键后刷新换行与画板对齐 */
export function bindTextEditingSync(canvas: Canvas, text: Textbox): void {
  unbindTextEditingSync(text);

  const textarea = text.hiddenTextarea;
  if (!textarea) return;

  // 在 Fabric onInput / updateFromTextArea 之后立即同步（比 text:changed 更可靠）
  const onInput = () => {
    runTextEditingSync(canvas, text);
    canvas.requestRenderAll();
  };
  const onCompositionEnd = () => {
    runTextEditingSync(canvas, text);
    canvas.requestRenderAll();
  };

  textarea.addEventListener("input", onInput);
  textarea.addEventListener("compositionend", onCompositionEnd);

  unbindByText.set(text, () => {
    textarea.removeEventListener("input", onInput);
    textarea.removeEventListener("compositionend", onCompositionEnd);
  });
}

export function unbindTextEditingSync(text: Textbox): void {
  unbindByText.get(text)?.();
  unbindByText.delete(text);
  if (pendingText === text) {
    pendingText = null;
    pendingCanvas = null;
  }
}
