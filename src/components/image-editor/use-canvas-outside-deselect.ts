"use client";

import { useEffect } from "react";
import type { Canvas } from "fabric";

export const EDITOR_CHROME_ATTR = "data-editor-chrome";

function isFabricTextarea(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLTextAreaElement &&
    target.getAttribute("data-fabric") === "textarea"
  );
}

function isCanvasPointerTarget(canvas: Canvas, target: EventTarget | null): boolean {
  if (!(target instanceof Node)) return false;
  const upper = canvas.upperCanvasEl;
  const lower = canvas.lowerCanvasEl;
  return (
    (!!upper && upper.contains(target)) || (!!lower && lower.contains(target))
  );
}

function isEditorChrome(target: EventTarget | null): boolean {
  return (
    target instanceof Element && !!target.closest(`[${EDITOR_CHROME_ATTR}]`)
  );
}

interface UseCanvasOutsideDeselectOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  headerRef: React.RefObject<HTMLElement | null>;
  canvas: Canvas | null;
  exitTextEditing: (canvas: Canvas) => void;
  onDeselect: () => void;
}

/** 点击画板空白、工作区背景或页头时取消选中（含文字编辑中） */
export function useCanvasOutsideDeselect({
  containerRef,
  headerRef,
  canvas,
  exitTextEditing,
  onDeselect,
}: UseCanvasOutsideDeselectOptions) {
  useEffect(() => {
    if (!canvas) return;

    const deselectAll = () => {
      exitTextEditing(canvas);
      if (canvas.getActiveObject()) {
        canvas.discardActiveObject();
        canvas.requestRenderAll();
      }
      onDeselect();
    };

    const onCanvasMouseDownBefore = (opt: { target?: unknown }) => {
      if (opt.target) return;
      deselectAll();
    };

    const onContainerMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (isEditorChrome(e.target) || isFabricTextarea(e.target)) return;
      if (isCanvasPointerTarget(canvas, e.target)) return;
      deselectAll();
    };

    const onHeaderMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      deselectAll();
    };

    canvas.on("mouse:down:before", onCanvasMouseDownBefore);

    const container = containerRef.current;
    container?.addEventListener("mousedown", onContainerMouseDown);

    const header = headerRef.current;
    header?.addEventListener("mousedown", onHeaderMouseDown);

    return () => {
      canvas.off("mouse:down:before", onCanvasMouseDownBefore);
      container?.removeEventListener("mousedown", onContainerMouseDown);
      header?.removeEventListener("mousedown", onHeaderMouseDown);
    };
  }, [canvas, containerRef, headerRef, exitTextEditing, onDeselect]);
}
