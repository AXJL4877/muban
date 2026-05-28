"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Canvas } from "fabric";
import {
  canvasToPersistJson,
  loadPersistedCanvasJson,
} from "@/lib/canvas-persist";
import {
  getTemplateById,
  getTemplateRecordType,
  saveTemplate,
  updateTemplate,
} from "@/lib/image-templates";
import type { FabricCanvasJson } from "@/types/image-template";

const MAX_HISTORY = 50;

export interface SaveDraftResult {
  ok: boolean;
  updated: boolean;
  error?: string;
}

interface UseCanvasHistoryOptions {
  onRestored?: (canvas: Canvas) => void;
  /** 从「我的模板」打开时传入，保存时更新该模板而非新建 */
  editingTemplateId?: string;
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

      void (async () => {
        const json = JSON.stringify(await canvasToPersistJson(c));
        const current = historyRef.current[indexRef.current];
        if (current === json) return;

        historyRef.current = historyRef.current.slice(0, indexRef.current + 1);
        historyRef.current.push(json);
        while (historyRef.current.length > MAX_HISTORY) {
          historyRef.current.shift();
        }
        indexRef.current = historyRef.current.length - 1;
        syncFlags();
      })();
    },
    [syncFlags]
  );

  const isCanvasTextEditing = useCallback((c: Canvas) => {
    const active = c.getActiveObject() as { isEditing?: boolean } | undefined;
    return !!active?.isEditing;
  }, []);

  const scheduleSave = useCallback(() => {
    if (!canvas || isRestoringRef.current) return;
    if (isCanvasTextEditing(canvas)) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      pushState(canvas);
      saveTimerRef.current = null;
    }, 280);
  }, [canvas, pushState, isCanvasTextEditing]);

  const restoreAt = useCallback(
    async (index: number) => {
      if (!canvas) return;
      const json = historyRef.current[index];
      if (!json) return;

      isRestoringRef.current = true;
      try {
        await loadPersistedCanvasJson(canvas, JSON.parse(json) as FabricCanvasJson);
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

  const exitCanvasTextEditing = useCallback((c: Canvas) => {
    const active = c.getActiveObject() as { isEditing?: boolean } | undefined;
    if (active?.isEditing && typeof (active as { exitEditing?: () => void }).exitEditing === "function") {
      (active as { exitEditing: () => void }).exitEditing();
    }
  }, []);

  const saveDraft = useCallback(async (): Promise<SaveDraftResult> => {
    if (!canvas) {
      return { ok: false, updated: false, error: "画布未就绪" };
    }

    exitCanvasTextEditing(canvas);

    try {
      const canvasSize = {
        width: canvas.getWidth(),
        height: canvas.getHeight(),
      };
      const json = await canvasToPersistJson(canvas);

      const templateId = options?.editingTemplateId;
      const existing =
        templateId ? await getTemplateById(templateId) : undefined;
      const isWork = existing ? getTemplateRecordType(existing) === "work" : false;

      let thumbnail: string | null = null;
      if (isWork) {
        // 作品封面与画布合成图分离，保存时保留原封面缩略图
        thumbnail = existing?.thumbnail ?? null;
      } else {
        try {
          thumbnail = canvas.toDataURL({
            format: "png",
            quality: 0.85,
            multiplier: 0.25,
          });
        } catch {
          /* 画布为空或跨域时可能失败 */
        }
      }

      if (existing && templateId) {
        const updated = await updateTemplate(templateId, {
          canvasSize,
          json,
          thumbnail,
        });
        if (!updated) {
          return { ok: false, updated: false, error: "模板不存在或已被删除" };
        }
        return { ok: true, updated: true };
      }

      await saveTemplate({ canvasSize, json, thumbnail });
      return { ok: true, updated: false };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "保存失败，存储空间可能不足";
      return { ok: false, updated: false, error: message };
    }
  }, [canvas, exitCanvasTextEditing, options?.editingTemplateId]);

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
        void saveDraft();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, saveDraft]);

  return { undo, redo, saveDraft, canUndo, canRedo, scheduleSave, isRestoringRef };
}
