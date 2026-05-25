"use client";

import { useEffect, useRef } from "react";
import type { Canvas, FabricObject, TPointerEvent } from "fabric";
import {
  getIsAligning,
  getObjectEdges,
  isAlignableObject,
  translateByCenter,
} from "./align-utils";

const SNAP_THRESHOLD = 6;
const GUIDE_COLOR = "#f43f5e";

export interface GuideLine {
  orientation: "horizontal" | "vertical";
  position: number;
}

interface SnapTargets {
  vertical: number[];
  horizontal: number[];
}

/** 仅收集其他文字框/图片的边界作为吸附目标，不含画板 */
function collectTargets(canvas: Canvas, moving: FabricObject): SnapTargets {
  const vertical: number[] = [];
  const horizontal: number[] = [];

  canvas.getObjects().forEach((obj) => {
    if (obj === moving || !obj.visible || !isAlignableObject(obj)) return;
    const e = getObjectEdges(obj);
    vertical.push(e.left, e.centerX, e.right);
    horizontal.push(e.top, e.centerY, e.bottom);
  });

  return { vertical, horizontal };
}

/** 单轴只取最近的一条吸附，避免多条线拉扯抖动 */
function findBestSnap(
  values: number[],
  candidates: number[]
): { delta: number; guide: number } | null {
  let best: { delta: number; guide: number } | null = null;
  for (const v of values) {
    for (const c of candidates) {
      const delta = c - v;
      const dist = Math.abs(delta);
      if (dist <= SNAP_THRESHOLD) {
        if (!best || dist < Math.abs(best.delta)) {
          best = { delta, guide: c };
        }
      }
    }
  }
  return best;
}

export function useSnapGuides(canvas: Canvas | null) {
  const guidesRef = useRef<GuideLine[]>([]);
  const shiftHeldRef = useRef(false);
  const snappedRef = useRef<{ x: number | null; y: number | null }>({
    x: null,
    y: null,
  });

  useEffect(() => {
    if (!canvas) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") shiftHeldRef.current = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        shiftHeldRef.current = false;
        snappedRef.current = { x: null, y: null };
        guidesRef.current = [];
        canvas.requestRenderAll();
      }
    };

    const onObjectMoving = (e: { target?: FabricObject; e?: TPointerEvent }) => {
      if (getIsAligning()) return;

      const target = e.target;
      const evt = e.e as MouseEvent | undefined;
      const shift = shiftHeldRef.current || evt?.shiftKey;

      if (!target || !shift || !isAlignableObject(target)) {
        guidesRef.current = [];
        snappedRef.current = { x: null, y: null };
        return;
      }

      const edges = getObjectEdges(target);
      const targets = collectTargets(canvas, target);
      const guides: GuideLine[] = [];
      let dx = 0;
      let dy = 0;

      const snapX = findBestSnap(
        [edges.left, edges.centerX, edges.right],
        targets.vertical
      );
      if (snapX) {
        dx = snapX.delta;
        guides.push({ orientation: "vertical", position: snapX.guide });
        snappedRef.current.x = snapX.guide;
      }

      const snapY = findBestSnap(
        [edges.top, edges.centerY, edges.bottom],
        targets.horizontal
      );
      if (snapY) {
        dy = snapY.delta;
        guides.push({ orientation: "horizontal", position: snapY.guide });
        snappedRef.current.y = snapY.guide;
      }

      translateByCenter(target, dx, dy);
      guidesRef.current = guides;
    };

    const clearGuides = () => {
      guidesRef.current = [];
      snappedRef.current = { x: null, y: null };
      canvas.requestRenderAll();
    };

    const drawGuides = () => {
      const guides = guidesRef.current;
      if (!guides.length) return;

      const ctx = canvas.getContext();
      if (!ctx) return;

      const w = canvas.getWidth();
      const h = canvas.getHeight();

      ctx.save();
      ctx.strokeStyle = GUIDE_COLOR;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.globalAlpha = 0.9;

      for (const g of guides) {
        ctx.beginPath();
        if (g.orientation === "vertical") {
          ctx.moveTo(g.position + 0.5, 0);
          ctx.lineTo(g.position + 0.5, h);
        } else {
          ctx.moveTo(0, g.position + 0.5);
          ctx.lineTo(w, g.position + 0.5);
        }
        ctx.stroke();
      }

      ctx.restore();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.on("object:moving", onObjectMoving);
    canvas.on("mouse:up", clearGuides);
    canvas.on("object:modified", clearGuides);
    canvas.on("after:render", drawGuides);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.off("object:moving", onObjectMoving);
      canvas.off("mouse:up", clearGuides);
      canvas.off("object:modified", clearGuides);
      canvas.off("after:render", drawGuides);
    };
  }, [canvas]);
}
