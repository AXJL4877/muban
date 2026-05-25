"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Canvas } from "fabric";
import { canvasToPersistJson } from "./element-id";
import {
  IMAGE_EDITOR_DRAFT_KEY,
  saveTemplate,
} from "@/lib/image-templates";
import type { FabricCanvasJson } from "@/types/image-template";
const MAX_HISTORY = 50;

interface UseCanvasHistoryOptions {
  onRestored?: (canvas: Canvas) => void;
}

export function useCanvasHistory(
  canvas: Canvas | null,
  options?: UseCanvasHistoryOptions
) {
  const historyRef = useRef<string[]>([]);
  const indexRef = useRef(-1);
  const isRestoringRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncFlags = useCallback(() => {
    setCanUndo(indexRef.current > 0);
    setCanRedo(indexRef.current < historyRef.current.length - 1);
  }, []);

  const pushState = useCallback(
    (c: Canvas) => {
      if (isRestoringRef.current) return;

      const json = JSON.stringify(canvasToPersistJson(c));
      const current = historyRef.current[indexRef.current];
      if (current === json) return;

      historyRef.current = historyRef.current.slice(0, indexRef.current + 1);
      historyRef.current.push(json);
      while (historyRef.current.length > MAX_HISTORY) {
        historyRef.current.shift();
      }
      indexRef.current = historyRef.current.length - 1;
      syncFlags();
    },
    [syncFlags]
  );

  const scheduleSave = useCallback(() => {
    if (!canvas || isRestoringRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      pushState(canvas);
      saveTimerRef.current = null;
    }, 280);
  }, [canvas, pushState]);

  const restoreAt = useCallback(
    async (index: number) => {
      if (!canvas) return;
      const json = historyRef.current[index];
      if (!json) return;

      isRestoringRef.current = true;
      try {
        await canvas.loadFromJSON(JSON.parse(json));
        canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        canvas.requestRenderAll();
        indexRef.current = index;
        syncFlags();
        options?.onRestored?.(canvas);
      } finally {
        isRestoringRef.current = false;
      }
    },
    [canvas, syncFlags, options]
  );

  const undo = useCallback(() => {
    if (indexRef.current <= 0) return;
    void restoreAt(indexRef.current - 1);
  }, [restoreAt]);

  const redo = useCallback(() => {
    if (indexRef.current >= historyRef.current.length - 1) return;
    void restoreAt(indexRef.current + 1);
  }, [restoreAt]);

  const saveDraft = useCallback(() => {
    if (!canvas) return false;
    try {
      const canvasSize = { width: canvas.getWidth(), height: canvas.getHeight() };
      const json = canvasToPersistJson(canvas) as FabricCanvasJson;

      let thumbnail: string | null = null;
      try {
        thumbnail = canvas.toDataURL({
          format: "png",
          quality: 0.85,
          multiplier: 0.25,
        });
      } catch {
        /* 画布为空或跨域时可能失败 */
      }

      const payload = {
        savedAt: Date.now(),
        canvasSize,
        json,
      };
      localStorage.setItem(IMAGE_EDITOR_DRAFT_KEY, JSON.stringify(payload));
      saveTemplate({ canvasSize, json, thumbnail });
      return true;
    } catch {
      return false;
    }
  }, [canvas]);

  useEffect(() => {
    if (!canvas) return;

    pushState(canvas);

    const onChange = () => scheduleSave();
    canvas.on("object:added", onChange);
    canvas.on("object:removed", onChange);
    canvas.on("object:modified", onChange);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      canvas.off("object:added", onChange);
      canvas.off("object:removed", onChange);
      canvas.off("object:modified", onChange);
    };
  }, [canvas, pushState, scheduleSave]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (e.key === "y" || (e.key === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      } else if (e.key === "s") {
        e.preventDefault();
        saveDraft();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, saveDraft]);

  return { undo, redo, saveDraft, canUndo, canRedo, scheduleSave, isRestoringRef };
}
