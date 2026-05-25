"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas, FabricImage, Textbox, type FabricObject } from "fabric";
import { EditorToolbar } from "./editor-toolbar";
import { EditorTopToolbar } from "./editor-top-toolbar";
import { DEFAULT_TEXT_STYLE, type TextStyleState } from "./types";
import { useCameraViewport } from "./use-camera-viewport";

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

export function ImageEditor() {
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

  const { fitToView } = useCameraViewport(
    containerRef,
    viewportRef,
    canvas,
    canvasSize
  );

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
  }, []);

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
    });

    return () => {
      c.dispose();
      fabricRef.current = null;
      setCanvas(null);
    };
  }, [syncFromSelection]);

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

  const deleteSelected = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;

    const active = c.getActiveObject();
    if (!active) return;

    if (active.type === "activeSelection") {
      const group = active as import("fabric").ActiveSelection;
      group.forEachObject((obj) => c.remove(obj));
    } else {
      c.remove(active);
    }
    c.discardActiveObject();
    c.requestRenderAll();
    setHasSelection(false);
    setHasTextSelection(false);
  }, []);

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
            中键拖动视角 · Alt+滚轮缩放视角 · 画板尺寸不变
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
