"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas, FabricImage, Textbox, type FabricObject } from "fabric";
import {
  alignHorizontalCenter,
  alignVerticalCenter,
  getAlignTarget,
  runAligning,
  translateByCenter,
} from "./align-utils";
import { EditorActionBar } from "./editor-action-bar";
import {
  EditorPositionCard,
  type PositionCardState,
} from "./editor-position-card";
import { EditorToolbar } from "./editor-toolbar";
import { EditorTopToolbar } from "./editor-top-toolbar";
import {
  ensureAllElementIds,
  ensureElementId,
  setElementId,
} from "./element-id";
import { isActiveSelection, getSelectedObjects } from "./selection-utils";
import { DEFAULT_TEXT_STYLE, type TextStyleState } from "./types";
import { useCameraViewport } from "./use-camera-viewport";
import {
  clearAiCanvasImport,
  peekAiCanvasImport,
} from "@/lib/apply-ai-json-to-canvas";
import { getTemplateById, IMAGE_EDITOR_DRAFT_KEY } from "@/lib/image-templates";
import type { FabricCanvasJson } from "@/types/image-template";
import { useCanvasHistory } from "./use-canvas-history";
import { useSnapGuides } from "./use-snap-guides";

const DEFAULT_WIDTH = 900;
const DEFAULT_HEIGHT = 600;

function isTextbox(obj: FabricObject | undefined): obj is Textbox {
  return obj?.type === "textbox" || obj?.type === "i-text" || obj?.type === "text";
}

function readTextStyle(obj: Textbox): TextStyleState {
  return {
    fontFamily: (obj.fontFamily as string) || DEFAULT_TEXT_STYLE.fontFamily,
    fontSize: obj.fontSize ?? DEFAULT_TEXT_STYLE.fontSize,
    fill: (obj.fill as string) || DEFAULT_TEXT_STYLE.fill,
    fontWeight: obj.fontWeight === "bold" ? "bold" : "normal",
    fontStyle: obj.fontStyle === "italic" ? "italic" : "normal",
    textAlign: (obj.textAlign as TextStyleState["textAlign"]) || "left",
    charSpacing: obj.charSpacing ?? 0,
  };
}

interface ImageEditorProps {
  templateId?: string;
  fromAi?: boolean;
}

export function ImageEditor({ templateId, fromAi }: ImageEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const overlayImageInputRef = useRef<HTMLInputElement>(null);
  const layerImageInputRef = useRef<HTMLInputElement>(null);

  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  const [topToolbarExpanded, setTopToolbarExpanded] = useState(true);
  const [textStyle, setTextStyle] = useState<TextStyleState>(DEFAULT_TEXT_STYLE);
  const [hasSelection, setHasSelection] = useState(false);
  const [hasTextSelection, setHasTextSelection] = useState(false);
  const [saveHint, setSaveHint] = useState<string | undefined>();
  const [positionCard, setPositionCard] = useState<PositionCardState | null>(null);

  const onHistoryRestored = useCallback((c: Canvas) => {
    ensureAllElementIds(c);
    setCanvasSize({ width: c.getWidth(), height: c.getHeight() });
    setHasSelection(false);
    setHasTextSelection(false);
    setPositionCard(null);
    requestAnimationFrame(() => fitToViewRef.current?.());
  }, []);

  const fitToViewRef = useRef<(() => void) | null>(null);

  const updatePositionCardRef = useRef<() => void>(() => {});

  const { fitToView, getCamera } = useCameraViewport(
    containerRef,
    viewportRef,
    canvas,
    canvasSize,
    { onCameraChange: () => updatePositionCardRef.current() }
  );

  fitToViewRef.current = fitToView;

  const updatePositionCard = useCallback(() => {
    const c = fabricRef.current;
    if (!c) {
      setPositionCard(null);
      return;
    }

    const active = c.getActiveObject();
    if (!active) {
      setPositionCard(null);
      return;
    }

    const rect = active.getBoundingRect();
    const isMulti = isActiveSelection(active);
    const count = isMulti ? active.getObjects().length : 1;

    if (isMulti) {
      const objs = active.getObjects();
      setPositionCard({
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        isMulti: true,
        count,
        elementIds: objs.map((o) => ensureElementId(o)),
      });
    } else {
      setPositionCard({
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        isMulti: false,
        count: 1,
        elementId: ensureElementId(active),
      });
    }
  }, [getCamera]);

  updatePositionCardRef.current = updatePositionCard;

  const { undo, redo, saveDraft, canUndo, canRedo, scheduleSave } = useCanvasHistory(
    canvas,
    { onRestored: onHistoryRestored }
  );

  useSnapGuides(canvas);

  const getCanvasSize = useCallback(() => canvasSize, [canvasSize]);

  const getActiveText = useCallback((): Textbox | null => {
    const c = fabricRef.current;
    if (!c) return null;
    const active = c.getActiveObject();
    return isTextbox(active) ? active : null;
  }, []);

  const applyToActiveText = useCallback(
    (patch: Partial<TextStyleState>) => {
      const text = getActiveText();
      const c = fabricRef.current;
      if (!text || !c) return;

      const next = { ...readTextStyle(text), ...patch };
      text.set({
        fontFamily: next.fontFamily,
        fontSize: next.fontSize,
        fill: next.fill,
        fontWeight: next.fontWeight,
        fontStyle: next.fontStyle,
        textAlign: next.textAlign,
        charSpacing: next.charSpacing,
      });
      text.setCoords();
      c.requestRenderAll();
      setTextStyle(next);
    },
    [getActiveText]
  );

  const syncFromSelection = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;

    const active = c.getActiveObject();
    const hasActive = !!active;
    setHasSelection(hasActive);

    if (isTextbox(active)) {
      setHasTextSelection(true);
      setTextStyle(readTextStyle(active));
    } else {
      setHasTextSelection(false);
    }
    updatePositionCard();
  }, [updatePositionCard]);

  useEffect(() => {
    if (!canvasElRef.current) return;

    const c = new Canvas(canvasElRef.current, {
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      backgroundColor: "#ffffff",
      preserveObjectStacking: true,
      selection: true,
    });

    // 视角由外层 CSS 相机控制，Fabric 内部保持 1:1，不缩放画板/元素
    c.setViewportTransform([1, 0, 0, 1, 0, 0]);

    fabricRef.current = c;
    setCanvas(c);

    const onSelect = () => syncFromSelection();
    c.on("selection:created", onSelect);
    c.on("selection:updated", onSelect);
    c.on("selection:cleared", () => {
      setHasSelection(false);
      setHasTextSelection(false);
      setPositionCard(null);
    });

    const onObjectChange = () => updatePositionCard();
    c.on("object:moving", onObjectChange);
    c.on("object:modified", onObjectChange);
    c.on("object:scaling", onObjectChange);
    c.on("object:rotating", onObjectChange);

    const loadInitial = async () => {
      let payload: {
        canvasSize?: { width: number; height: number };
        json?: FabricCanvasJson;
      } | null = null;

      if (templateId && fromAi) {
        const aiImport = peekAiCanvasImport(templateId);
        if (aiImport) {
          payload = {
            canvasSize: aiImport.canvasSize,
            json: aiImport.json,
          };
        }
      }

      if (!payload && templateId) {
        const template = getTemplateById(templateId);
        if (template) {
          payload = { canvasSize: template.canvasSize, json: template.json };
        }
      }

      if (!payload) {
        try {
          const raw = localStorage.getItem(IMAGE_EDITOR_DRAFT_KEY);
          if (raw) payload = JSON.parse(raw) as typeof payload;
        } catch {
          /* ignore */
        }
      }

      if (!payload?.json) return;

      try {
        await c.loadFromJSON(payload.json);
        if (payload.canvasSize) {
          c.setDimensions({
            width: payload.canvasSize.width,
            height: payload.canvasSize.height,
          });
          setCanvasSize(payload.canvasSize);
        }
        c.setViewportTransform([1, 0, 0, 1, 0, 0]);
        ensureAllElementIds(c);
        c.requestRenderAll();
        requestAnimationFrame(() => fitToViewRef.current?.());
        if (templateId && fromAi) {
          clearAiCanvasImport();
        }
      } catch {
        /* ignore corrupt json */
      }
    };

    void loadInitial();

    return () => {
      c.off("object:moving", onObjectChange);
      c.off("object:modified", onObjectChange);
      c.off("object:scaling", onObjectChange);
      c.off("object:rotating", onObjectChange);
      c.dispose();
      fabricRef.current = null;
      setCanvas(null);
    };
  }, [syncFromSelection, updatePositionCard, templateId, fromAi]);

  const addText = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;

    const { width, height } = getCanvasSize();
    const text = new Textbox("双击编辑文字", {
      left: width / 2 - 120,
      top: height / 2 - 20,
      width: 240,
      fontFamily: textStyle.fontFamily,
      fontSize: textStyle.fontSize,
      fill: textStyle.fill,
      fontWeight: textStyle.fontWeight,
      fontStyle: textStyle.fontStyle,
      textAlign: textStyle.textAlign,
      charSpacing: textStyle.charSpacing,
      editable: true,
    });

    ensureElementId(text);
    c.add(text);
    c.setActiveObject(text);
    c.requestRenderAll();
    setHasTextSelection(true);
    setHasSelection(true);
  }, [textStyle, getCanvasSize]);

  const addImageFromFile = useCallback(
    async (file: File) => {
      const c = fabricRef.current;
      if (!c) return;

      const url = URL.createObjectURL(file);
      try {
        const img = await FabricImage.fromURL(url, { crossOrigin: "anonymous" });
        const { width, height } = getCanvasSize();
        const maxW = width * 0.6;
        const maxH = height * 0.6;
        const scale = Math.min(maxW / (img.width || 1), maxH / (img.height || 1), 1);
        img.set({
          left: width / 2,
          top: height / 2,
          originX: "center",
          originY: "center",
          scaleX: scale,
          scaleY: scale,
        });
        ensureElementId(img);
        c.add(img);
        c.setActiveObject(img);
        c.requestRenderAll();
        setHasSelection(true);
        setHasTextSelection(false);
      } finally {
        URL.revokeObjectURL(url);
      }
    },
    [getCanvasSize]
  );

  const importBackground = useCallback(
    async (file: File) => {
      const c = fabricRef.current;
      if (!c) return;

      const url = URL.createObjectURL(file);
      try {
        const img = await FabricImage.fromURL(url, { crossOrigin: "anonymous" });
        const w = Math.round(img.width || DEFAULT_WIDTH);
        const h = Math.round(img.height || DEFAULT_HEIGHT);

        c.clear();
        c.setDimensions({ width: w, height: h });
        c.setViewportTransform([1, 0, 0, 1, 0, 0]);
        c.backgroundColor = "#ffffff";

        img.set({
          left: 0,
          top: 0,
          originX: "left",
          originY: "top",
          scaleX: w / (img.width || 1),
          scaleY: h / (img.height || 1),
          selectable: false,
          evented: false,
        });

        await c.set("backgroundImage", img);
        c.requestRenderAll();

        setCanvasSize({ width: w, height: h });
        setHasSelection(false);
        setHasTextSelection(false);

        requestAnimationFrame(() => fitToView());
      } finally {
        URL.revokeObjectURL(url);
      }
    },
    [fitToView]
  );

  const clearCanvas = useCallback(async () => {
    const c = fabricRef.current;
    if (!c) return;

    c.clear();
    c.setDimensions({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
    c.setViewportTransform([1, 0, 0, 1, 0, 0]);
    c.backgroundColor = "#ffffff";
    await c.set("backgroundImage", undefined);
    c.discardActiveObject();
    c.requestRenderAll();

    setCanvasSize({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
    setHasSelection(false);
    setHasTextSelection(false);

    requestAnimationFrame(() => fitToView());
  }, [fitToView]);

  const exportImage = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;

    const dataUrl = c.toDataURL({
      format: "png",
      quality: 1,
      multiplier: 1,
    });

    const link = document.createElement("a");
    link.download = `canvas-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  }, []);

  const triggerBackgroundUpload = useCallback(() => {
    overlayImageInputRef.current?.click();
  }, []);

  const triggerLayerImageUpload = useCallback(() => {
    layerImageInputRef.current?.click();
  }, []);

  const alignToArtboardHorizontal = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;
    const target = getAlignTarget(c);
    if (!target) return;

    runAligning(() => {
      alignHorizontalCenter(c, target);
      target.setCoords();
      c.setActiveObject(target);
      c.requestRenderAll();
    });
    scheduleSave();
  }, [scheduleSave]);

  const alignToArtboardVertical = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;
    const target = getAlignTarget(c);
    if (!target) return;

    runAligning(() => {
      alignVerticalCenter(c, target);
      target.setCoords();
      c.setActiveObject(target);
      c.requestRenderAll();
    });
    scheduleSave();
  }, [scheduleSave]);

  const handleSave = useCallback(() => {
    const ok = saveDraft();
    if (ok) {
      setSaveHint("已保存到我的模板");
      setTimeout(() => setSaveHint(undefined), 2000);
    } else {
      setSaveHint("保存失败");
      setTimeout(() => setSaveHint(undefined), 2000);
    }
  }, [saveDraft]);

  const applyPositionX = useCallback(
    (newX: number) => {
      const c = fabricRef.current;
      if (!c) return;
      const active = c.getActiveObject();
      if (!active || isActiveSelection(active)) return;
      const rect = active.getBoundingRect();
      translateByCenter(active, newX - rect.left, 0);
      active.setCoords();
      c.requestRenderAll();
      updatePositionCard();
      scheduleSave();
    },
    [updatePositionCard, scheduleSave]
  );

  const applyElementId = useCallback(
    (newId: string): { ok: boolean; error?: string } => {
      const c = fabricRef.current;
      if (!c) return { ok: false, error: "画布未就绪" };
      const active = c.getActiveObject();
      if (!active || isActiveSelection(active)) {
        return { ok: false, error: "请单选一个元素" };
      }
      const result = setElementId(c, active, newId);
      if (!result.ok) return { ok: false, error: result.error };
      c.requestRenderAll();
      updatePositionCard();
      scheduleSave();
      return { ok: true };
    },
    [updatePositionCard, scheduleSave]
  );

  const applyPositionY = useCallback(
    (newY: number) => {
      const c = fabricRef.current;
      if (!c) return;
      const active = c.getActiveObject();
      if (!active || isActiveSelection(active)) return;
      const rect = active.getBoundingRect();
      translateByCenter(active, 0, newY - rect.top);
      active.setCoords();
      c.requestRenderAll();
      updatePositionCard();
      scheduleSave();
    },
    [updatePositionCard, scheduleSave]
  );

  const deleteSelected = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;

    const objects = getSelectedObjects(c);
    if (!objects.length) return;

    c.discardActiveObject();
    objects.forEach((obj) => c.remove(obj));
    c.requestRenderAll();
    setHasSelection(false);
    setHasTextSelection(false);
    setPositionCard(null);
    scheduleSave();
  }, [scheduleSave]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && hasSelection) {
        const target = e.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return;
        }
        deleteSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasSelection, deleteSelected]);

  return (
    <div className="flex h-[calc(100vh)] flex-col">
      <header className="flex shrink-0 items-center justify-between border-b px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">图像编辑</h1>
          <p className="text-xs text-muted-foreground">
            中键拖动视角 · Alt+滚轮缩放 · Shift 拖动与元素对齐吸附
          </p>
        </div>
      </header>

      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden"
        style={{
          backgroundImage: `
            linear-gradient(45deg, hsl(var(--muted)) 25%, transparent 25%),
            linear-gradient(-45deg, hsl(var(--muted)) 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, hsl(var(--muted)) 75%),
            linear-gradient(-45deg, transparent 75%, hsl(var(--muted)) 75%)
          `,
          backgroundSize: "20px 20px",
          backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
          backgroundColor: "hsl(var(--background))",
        }}
      >
        {/* 相机层：仅 transform 平移/缩放，画板逻辑像素不变 */}
        <div ref={viewportRef} className="absolute left-0 top-0 will-change-transform">
          <div
            className="rounded-lg shadow-2xl ring-1 ring-border/50"
            style={{ width: canvasSize.width, height: canvasSize.height }}
          >
            <canvas ref={canvasElRef} className="block" />
          </div>
        </div>

        <EditorTopToolbar
          expanded={topToolbarExpanded}
          onToggle={() => setTopToolbarExpanded((v) => !v)}
          onImportBackground={triggerBackgroundUpload}
          onExport={exportImage}
          onClearCanvas={() => void clearCanvas()}
          canvasSize={canvasSize}
        />

        <EditorPositionCard
          state={positionCard}
          containerRef={containerRef}
          onChangeX={applyPositionX}
          onChangeY={applyPositionY}
          onChangeElementId={applyElementId}
        />

        <EditorActionBar
          canUndo={canUndo}
          canRedo={canRedo}
          saveHint={saveHint}
          onUndo={undo}
          onRedo={redo}
          onSave={handleSave}
        />

        <EditorToolbar
          textStyle={textStyle}
          hasTextSelection={hasTextSelection}
          hasSelection={hasSelection}
          onAddText={addText}
          onAddImage={triggerLayerImageUpload}
          onToggleBold={() =>
            applyToActiveText({
              fontWeight: textStyle.fontWeight === "bold" ? "normal" : "bold",
            })
          }
          onToggleItalic={() =>
            applyToActiveText({
              fontStyle: textStyle.fontStyle === "italic" ? "normal" : "italic",
            })
          }
          onToggleCenter={() =>
            applyToActiveText({
              textAlign: textStyle.textAlign === "center" ? "left" : "center",
            })
          }
          onFontFamilyChange={(family) => applyToActiveText({ fontFamily: family })}
          onFontSizeChange={(size) => applyToActiveText({ fontSize: size })}
          onFontColorChange={(color) => applyToActiveText({ fill: color })}
          onCharSpacingChange={(spacing) => applyToActiveText({ charSpacing: spacing })}
          onAlignHorizontalCenter={alignToArtboardHorizontal}
          onAlignVerticalCenter={alignToArtboardVertical}
          onDeleteSelected={deleteSelected}
        />

        <input
          ref={overlayImageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importBackground(file);
            e.target.value = "";
          }}
        />
        <input
          ref={layerImageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void addImageFromFile(file);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
