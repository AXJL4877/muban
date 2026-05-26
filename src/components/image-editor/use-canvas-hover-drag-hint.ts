"use client";

import { useEffect, useRef } from "react";
import type { Canvas, FabricObject } from "fabric";
import {
  HOVER_DRAG_STROKE,
  isHoverDraggableObject,
} from "./canvas-interaction-utils";

type HoverCursorPatch = FabricObject & {
  _hoverDragSavedCursor?: CSSStyleDeclaration["cursor"] | null;
};

function applyMoveHoverCursor(target: FabricObject) {
  const obj = target as HoverCursorPatch;
  if (obj._hoverDragSavedCursor === undefined) {
    obj._hoverDragSavedCursor = obj.hoverCursor ?? null;
  }
  obj.hoverCursor = "move";
}

function restoreHoverCursor(target: FabricObject) {
  const obj = target as HoverCursorPatch;
  if (obj._hoverDragSavedCursor === undefined) return;
  obj.hoverCursor = obj._hoverDragSavedCursor;
  obj._hoverDragSavedCursor = undefined;
}

/** 未选中元素悬停时显示可拖动边框与 move 光标 */
export function useCanvasHoverDragHint(canvas: Canvas | null) {
  const hoveredRef = useRef<FabricObject | null>(null);

  useEffect(() => {
    if (!canvas) return;

    const clearHover = () => {
      const prev = hoveredRef.current;
      if (!prev) return;
      restoreHoverCursor(prev);
      hoveredRef.current = null;
      canvas.setCursor(canvas.defaultCursor ?? "default");
      canvas.requestRenderAll();
    };

    const setHover = (target: FabricObject) => {
      if (hoveredRef.current === target) return;
      clearHover();
      hoveredRef.current = target;
      applyMoveHoverCursor(target);
      canvas.setCursor("move");
      canvas.requestRenderAll();
    };

    const onMouseOver = (e: { target?: FabricObject }) => {
      if (canvas.getActiveObject()) {
        clearHover();
        return;
      }
      const target = e.target;
      if (!isHoverDraggableObject(target)) {
        clearHover();
        return;
      }
      setHover(target!);
    };

    const onMouseOut = () => {
      clearHover();
    };

    const onSelectionChange = () => {
      clearHover();
    };

    const drawHoverHint = () => {
      const target = hoveredRef.current;
      if (!target || canvas.getActiveObject()) return;

      const ctx = canvas.getContext();
      if (!ctx) return;

      const rect = target.getBoundingRect();
      ctx.save();
      ctx.strokeStyle = HOVER_DRAG_STROKE;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.globalAlpha = 0.95;
      ctx.strokeRect(
        rect.left + 0.5,
        rect.top + 0.5,
        Math.max(0, rect.width - 1),
        Math.max(0, rect.height - 1)
      );
      ctx.restore();
    };

    canvas.on("mouse:over", onMouseOver);
    canvas.on("mouse:out", onMouseOut);
    canvas.on("selection:created", onSelectionChange);
    canvas.on("selection:updated", onSelectionChange);
    canvas.on("selection:cleared", onSelectionChange);
    canvas.on("after:render", drawHoverHint);

    return () => {
      hoveredRef.current = null;
      canvas.off("mouse:over", onMouseOver);
      canvas.off("mouse:out", onMouseOut);
      canvas.off("selection:created", onSelectionChange);
      canvas.off("selection:updated", onSelectionChange);
      canvas.off("selection:cleared", onSelectionChange);
      canvas.off("after:render", drawHoverHint);
    };
  }, [canvas]);
}
