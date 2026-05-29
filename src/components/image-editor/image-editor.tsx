"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas, FabricImage, Shadow, Textbox, type FabricObject } from "fabric";
import { translateByCenter } from "./align-utils";
import {
  applyArtboardAlignAll,
  applyArtboardAlignToObject,
  getAlignArtboardH,
  getAlignArtboardV,
  getAlignTargets,
  setAlignArtboardH as setObjectAlignArtboardH,
  setAlignArtboardV as setObjectAlignArtboardV,
} from "./artboard-align";
import { EditorActionBar } from "./editor-action-bar";
import { CoverPreviewPanel } from "./cover-preview-panel";
import {
  EditorPositionCard,
  type PositionCardState,
} from "./editor-position-card";
import { EditorToolbar } from "./editor-toolbar";
import { EditorTopToolbar } from "./editor-top-toolbar";
import {
  ensureAllElementIds,
  ensureElementId,
  registerFabricCustomProperties,
  setElementId,
} from "./element-id";
import { isActiveSelection, getSelectedObjects } from "./selection-utils";
import {
  getTransformTarget,
  rotateObjectByDelta,
  ROTATE_STEP_DEG,
  toggleFlipHorizontal,
  toggleFlipVertical,
} from "./transform-utils";
import {
  createSelectionRegion,
  getSelectionRegionSize,
  isSelectionRegion,
  setSelectionRegionSize,
} from "./selection-region";
import {
  clampLineHeight,
  clampOpacityPercent,
  DEFAULT_TEXT_STYLE,
  type TextStyleState,
} from "./types";
import { useCameraViewport } from "./use-camera-viewport";
import {
  clearAiCanvasImport,
  peekAiCanvasImport,
} from "@/lib/apply-ai-json-to-canvas";
import {
  clearNativeCanvasBackground,
  hasNativeBackground,
  installNativeBackgroundRenderer,
  syncCanvasBackgroundColor,
} from "@/components/image-editor/background-layer";
import {
  fileToDataUrl,
  loadPersistedCanvasJson,
  removeCanvasBackground,
  setCanvasBackgroundFromDataUrl,
} from "@/lib/canvas-persist";
import { getTemplateById } from "@/lib/image-templates";
import { setWorkEditing } from "@/lib/image-editor-workbench";
import {
  buildSystemFontOptions,
  loadFontFace,
  prepareFontCatalog,
  uploadFontFile,
  type FontOption,
} from "@/lib/custom-fonts";
import { ensureCanvasFontsReady } from "@/lib/canvas-fonts";
import type { FabricCanvasJson } from "@/types/image-template";
import { useCanvasHistory } from "./use-canvas-history";
import { useCanvasHoverDragHint } from "./use-canvas-hover-drag-hint";
import { useCanvasOutsideDeselect } from "./use-canvas-outside-deselect";
import { useSnapGuides } from "./use-snap-guides";
import {
  applyAutoWrapAllEnabled,
  applyAutoWrapLive,
  applyAutoWrapToTextbox,
  getAutoWrapEnabled,
  getAutoWrapMaxChars,
  setAutoWrapOnTextbox,
  syncAutoWrapAfterTextEdit,
  syncTextboxDimensions,
} from "./text-auto-wrap";
import {
  bindTextEditingSync,
  runTextEditingSync,
  scheduleTextEditingSync,
  unbindTextEditingSync,
} from "./text-editing-sync";
import {
  clampTextObjectsOnArtboard,
  ensureTextboxTopLeftOrigin,
  getObjectTopLeft,
  installTextTopLeftDefaults,
  isTextLikeObject,
  preserveTextboxTopLeft,
  setObjectTopLeft,
  TEXT_TOP_LEFT_ORIGIN,
} from "./text-position";
import { getTextContentSize } from "@/lib/fabric-bounds";
import {
  capturePageScroll,
  getFabricTextareaHost,
  patchTextboxTextareaPin,
  restorePageScroll,
  stabilizeFabricTextarea,
  type PageScrollSnapshot,
} from "./text-editing-scroll-lock";

const DEFAULT_WIDTH = 900;
const DEFAULT_HEIGHT = 600;
const TEXT_HIGHLIGHT_SHADOW = "0 0 8px rgba(255,235,59,0.9)";

function createTextHighlightShadow(): Shadow {
  return new Shadow(TEXT_HIGHLIGHT_SHADOW);
}

function isTextbox(obj: FabricObject | undefined): obj is Textbox {
  return obj?.type === "textbox" || obj?.type === "i-text" || obj?.type === "text";
}

function readOpacityPercent(obj: FabricObject): number {
  const o = typeof obj.opacity === "number" ? obj.opacity : 1;
  return Math.round(Math.min(1, Math.max(0, o)) * 100);
}

function readTextStyle(obj: Textbox): TextStyleState {
  const shadowValue =
    typeof obj.shadow === "string"
      ? obj.shadow
      : obj.shadow
        ? String((obj.shadow as { color?: string }).color ?? "")
        : "";
  return {
    fontFamily: (obj.fontFamily as string) || DEFAULT_TEXT_STYLE.fontFamily,
    fontSize: obj.fontSize ?? DEFAULT_TEXT_STYLE.fontSize,
    fill: (obj.fill as string) || DEFAULT_TEXT_STYLE.fill,
    textBackgroundColor:
      (obj.textBackgroundColor as string) || DEFAULT_TEXT_STYLE.textBackgroundColor,
    fontWeight: obj.fontWeight === "bold" ? "bold" : "normal",
    fontStyle: obj.fontStyle === "italic" ? "italic" : "normal",
    underline: !!obj.underline,
    highlightGlow: shadowValue.includes("255,235,59"),
    textAlign: (obj.textAlign as TextStyleState["textAlign"]) || "left",
    charSpacing: obj.charSpacing ?? 0,
    lineHeight: clampLineHeight(
      typeof obj.lineHeight === "number" ? obj.lineHeight : DEFAULT_TEXT_STYLE.lineHeight
    ),
  };
}

interface ImageEditorProps {
  templateId?: string;
  fromAi?: boolean;
}

export function ImageEditor({ templateId, fromAi }: ImageEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
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
  const [autoWrapEnabled, setAutoWrapEnabled] = useState(false);
  const [autoWrapMaxChars, setAutoWrapMaxChars] = useState(12);
  const [alignArtboardH, setAlignArtboardH] = useState(false);
  const [alignArtboardV, setAlignArtboardV] = useState(false);
  const [selectionOpacity, setSelectionOpacity] = useState(100);
  const [fontOptions, setFontOptions] = useState<FontOption[]>(buildSystemFontOptions);
  const [fontImporting, setFontImporting] = useState(false);
  const [hasBackground, setHasBackground] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string>("");
  const [coverTitle, setCoverTitle] = useState<string>("");
  const fontOptionsRef = useRef<FontOption[]>(buildSystemFontOptions());
  fontOptionsRef.current = fontOptions;

  useEffect(() => {
    if (!templateId) return;
    setWorkEditing(templateId, true);
    return () => {
      setWorkEditing(templateId, false);
    };
  }, [templateId]);

  useEffect(() => {
    void (async () => {
      const catalog = await prepareFontCatalog();
      fontOptionsRef.current = catalog;
      setFontOptions(catalog);
    })();
  }, []);

  const onHistoryRestored = useCallback(async (c: Canvas) => {
    ensureAllElementIds(c, getFabricTextareaHost());
    await ensureCanvasFontsReady(c, fontOptionsRef.current);
    applyAutoWrapAllEnabled(c);
    applyArtboardAlignAll(c);
    clampTextObjectsOnArtboard(c);
    setCanvasSize({ width: c.getWidth(), height: c.getHeight() });
    setHasSelection(false);
    setHasTextSelection(false);
    setHasBackground(hasNativeBackground(c));
    setPositionCard(null);
    requestAnimationFrame(() => fitToViewRef.current?.({ force: true }));
  }, []);

  const fitToViewRef = useRef<((opts?: { force?: boolean }) => void) | null>(null);
  const isTextEditingRef = useRef(false);
  const textEditScrollSnapshotRef = useRef<PageScrollSnapshot | null>(null);

  const updatePositionCardRef = useRef<() => void>(() => {});

  const { fitToView, getCamera } = useCameraViewport(
    containerRef,
    viewportRef,
    canvas,
    canvasSize,
    {
      onCameraChange: () => {
        if (isTextEditingRef.current) return;
        updatePositionCardRef.current();
      },
      shouldFreezeCamera: () => isTextEditingRef.current,
    }
  );

  fitToViewRef.current = fitToView;

  const updatePositionCard = useCallback(() => {
    if (isTextEditingRef.current) return;

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
      const region = isSelectionRegion(active);
      const pos = getObjectTopLeft(active);
      const size = region
        ? getSelectionRegionSize(active)
        : isTextLikeObject(active)
          ? getTextContentSize(active)
          : {
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            };
      setPositionCard({
        x: Math.round(pos.left),
        y: Math.round(pos.top),
        width: size.width,
        height: size.height,
        isMulti: false,
        count: 1,
        isSelectionRegion: region,
        elementId: ensureElementId(active),
      });
    }
  }, []);

  updatePositionCardRef.current = updatePositionCard;

  const { undo, redo, saveDraft, canUndo, canRedo, scheduleSave } = useCanvasHistory(
    canvas,
    { onRestored: onHistoryRestored, editingTemplateId: templateId }
  );

  const scheduleSaveRef = useRef(scheduleSave);
  scheduleSaveRef.current = scheduleSave;

  useSnapGuides(canvas);

  const clearSelectionState = useCallback(() => {
    setHasSelection(false);
    setHasTextSelection(false);
    setSelectionOpacity(100);
    setPositionCard(null);
  }, []);

  const exitActiveTextEditing = useCallback((c: Canvas) => {
    const active = c.getActiveObject();
    if (isTextbox(active) && active.isEditing) {
      active.exitEditing();
    }
  }, []);

  useCanvasOutsideDeselect({
    containerRef,
    headerRef,
    canvas,
    exitTextEditing: exitActiveTextEditing,
    onDeselect: clearSelectionState,
  });

  useCanvasHoverDragHint(canvas);

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
      preserveTextboxTopLeft(text, () => {
        text.set({
          fontFamily: next.fontFamily,
          fontSize: next.fontSize,
          fill: next.fill,
          textBackgroundColor:
            next.textBackgroundColor === "transparent"
              ? ""
              : next.textBackgroundColor,
          fontWeight: next.fontWeight,
          fontStyle: next.fontStyle,
          underline: next.underline,
          shadow: next.highlightGlow ? createTextHighlightShadow() : null,
          textAlign: next.textAlign,
          charSpacing: next.charSpacing,
          lineHeight: next.lineHeight,
        });
      });
      syncTextboxDimensions(text);
      applyArtboardAlignToObject(c, text);
      c.requestRenderAll();
      setTextStyle(next);
    },
    [getActiveText]
  );

  const applyOpacityToSelection = useCallback(
    (percent: number) => {
      const c = fabricRef.current;
      if (!c) return;
      const active = c.getActiveObject();
      if (!active) return;

      const next = clampOpacityPercent(percent);
      const opacity = next / 100;

      if (isActiveSelection(active)) {
        active.getObjects().forEach((obj) => obj.set({ opacity }));
      } else {
        active.set({ opacity });
      }

      active.setCoords();
      c.requestRenderAll();
      setSelectionOpacity(next);
      scheduleSaveRef.current();
    },
    []
  );

  const handleImportFont = useCallback(
    async (file: File) => {
      setFontImporting(true);
      try {
        const added = await uploadFontFile(file);
        if (added.url) {
          await loadFontFace(added.family, added.url);
        }
        setFontOptions((prev) => {
          if (prev.some((f) => f.family === added.family)) return prev;
          return [...prev, added];
        });
        applyToActiveText({ fontFamily: added.family });
      } catch (err) {
        setSaveHint(
          err instanceof Error ? err.message : "字体导入失败"
        );
        setTimeout(() => setSaveHint(undefined), 2500);
      } finally {
        setFontImporting(false);
      }
    },
    [applyToActiveText]
  );

  const stabilizeHiddenTextarea = useCallback((textarea: HTMLTextAreaElement) => {
    stabilizeFabricTextarea(textarea, textEditScrollSnapshotRef.current);
  }, []);

  const syncFromSelection = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;
    if (isTextEditingRef.current) return;

    const active = c.getActiveObject();
    const hasActive = !!active;
    setHasSelection(hasActive);

    if (isTextbox(active)) {
      setHasTextSelection(true);
      setTextStyle(readTextStyle(active));
      setAutoWrapEnabled(getAutoWrapEnabled(active));
      setAutoWrapMaxChars(getAutoWrapMaxChars(active));
    } else {
      setHasTextSelection(false);
    }

    const alignTargets = getAlignTargets(c);
    if (alignTargets.length > 0) {
      setAlignArtboardH(alignTargets.every((o) => getAlignArtboardH(o)));
      setAlignArtboardV(alignTargets.every((o) => getAlignArtboardV(o)));
    } else {
      setAlignArtboardH(false);
      setAlignArtboardV(false);
    }

    if (active) {
      if (isActiveSelection(active)) {
        const objs = active.getObjects();
        setSelectionOpacity(
          objs.length > 0 ? readOpacityPercent(objs[0]) : 100
        );
      } else {
        setSelectionOpacity(readOpacityPercent(active));
      }
    }

    updatePositionCard();
  }, [updatePositionCard]);

  useEffect(() => {
    registerFabricCustomProperties();
    installTextTopLeftDefaults();
    const host = getFabricTextareaHost();
    Textbox.prototype.hiddenTextareaContainer = host;
    return () => {
      Textbox.prototype.hiddenTextareaContainer = null;
    };
  }, []);

  useEffect(() => {
    if (!canvasElRef.current) return;

    const c = new Canvas(canvasElRef.current, {
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      backgroundColor: "#ffffff",
      backgroundVpt: false,
      preserveObjectStacking: true,
      selection: true,
    });

    // 视角由外层 CSS 相机控制，Fabric 内部保持 1:1，不缩放画板/元素
    c.setViewportTransform([1, 0, 0, 1, 0, 0]);
    installNativeBackgroundRenderer(c);

    fabricRef.current = c;
    setCanvas(c);

    const onSelect = () => syncFromSelection();
    c.on("selection:created", onSelect);
    c.on("selection:updated", onSelect);
    c.on("selection:cleared", clearSelectionState);

    const onMouseDownBeforeTextEdit = (opt: { target?: FabricObject }) => {
      const target = opt.target;
      if (!isTextbox(target) || target.isEditing) return;
      const active = c.getActiveObject();
      if (active !== target) return;
      textEditScrollSnapshotRef.current = capturePageScroll();
    };

    const onFocusInCapture = (e: FocusEvent) => {
      const target = e.target;
      if (!(target instanceof HTMLTextAreaElement)) return;
      if (target.getAttribute("data-fabric") !== "textarea") return;
      stabilizeHiddenTextarea(target);
      restorePageScroll(textEditScrollSnapshotRef.current);
    };

    const onTextEditingEntered = () => {
      isTextEditingRef.current = true;
      const active = c.getActiveObject();
      if (!isTextbox(active)) return;
      ensureTextboxTopLeftOrigin(active);
      patchTextboxTextareaPin(active);
      const textarea = active.hiddenTextarea;
      if (!textarea) return;
      stabilizeHiddenTextarea(textarea);
      bindTextEditingSync(c, active);
      runTextEditingSync(c, active);
      c.requestRenderAll();
    };

    const onTextEditingExited = () => {
      isTextEditingRef.current = false;
      textEditScrollSnapshotRef.current = null;
      const active = c.getActiveObject();
      if (isTextbox(active)) {
        const alignEnabled = getAlignArtboardH(active) || getAlignArtboardV(active);
        unbindTextEditingSync(active);
        if (alignEnabled) {
          syncAutoWrapAfterTextEdit(active);
          applyArtboardAlignToObject(c, active);
        } else {
          // 未启用画板对齐时，文本编辑前后的左上锚点必须保持不变。
          preserveTextboxTopLeft(active, () => {
            syncAutoWrapAfterTextEdit(active);
          });
        }
        c.requestRenderAll();
      }
      c.calcOffset();
      updatePositionCardRef.current();
      scheduleSaveRef.current();
    };

    const onTextChanged = (opt: { target?: FabricObject }) => {
      const target = opt.target;
      if (!isTextbox(target) || !target.isEditing) return;
      scheduleTextEditingSync(c, target);
    };

    const onTextSelectionChanged = () => {
      const active = c.getActiveObject();
      if (!isTextbox(active) || !active.isEditing) return;
      const textarea = active.hiddenTextarea;
      if (textarea) stabilizeHiddenTextarea(textarea);
    };

    const onObjectMovingWithAlign = (opt: { target?: FabricObject }) => {
      const target = opt.target;
      if (!target) return;
      const objects = isActiveSelection(target)
        ? target.getObjects()
        : [target];
      let aligned = false;
      for (const obj of objects) {
        if (!getAlignArtboardH(obj) && !getAlignArtboardV(obj)) continue;
        applyArtboardAlignToObject(c, obj);
        aligned = true;
      }
      if (aligned) c.requestRenderAll();
      updatePositionCard();
    };

    const onObjectModifiedWithAlign = (opt: { target?: FabricObject }) => {
      const target = opt.target;
      if (!target) return;
      const objects = isActiveSelection(target)
        ? target.getObjects()
        : [target];
      for (const obj of objects) {
        applyArtboardAlignToObject(c, obj);
      }
      updatePositionCard();
    };

    c.on("mouse:down", onMouseDownBeforeTextEdit);
    c.on("text:editing:entered", onTextEditingEntered);
    c.on("text:editing:exited", onTextEditingExited);
    c.on("text:changed", onTextChanged);
    c.on("text:selection:changed", onTextSelectionChanged);
    document.addEventListener("focusin", onFocusInCapture, true);

    c.on("object:moving", onObjectMovingWithAlign);
    c.on("object:scaling", onObjectMovingWithAlign);
    c.on("object:rotating", onObjectMovingWithAlign);
    c.on("object:modified", onObjectModifiedWithAlign);

    let cancelled = false;
    const isCanvasActive = () => !cancelled && fabricRef.current === c;

    const loadInitial = async () => {
      const catalog = await prepareFontCatalog();
      if (!isCanvasActive()) return;

      fontOptionsRef.current = catalog;
      setFontOptions(catalog);

      let payload: {
        canvasSize?: { width: number; height: number };
        json?: FabricCanvasJson;
      } | null = null;
      let templateMeta: Awaited<ReturnType<typeof getTemplateById>> | null = null;

      if (templateId) {
        templateMeta = (await getTemplateById(templateId)) ?? null;
        if (!isCanvasActive()) return;
        setCoverPreview(templateMeta?.thumbnail ?? "");
        setCoverTitle(templateMeta?.name ?? "");
      } else {
        setCoverPreview("");
        setCoverTitle("");
      }

      if (templateId && fromAi) {
        const aiImport = peekAiCanvasImport(templateId);
        if (aiImport) {
          payload = {
            canvasSize: aiImport.canvasSize,
            json: aiImport.json,
          };
        }
      }

      if (!payload && templateMeta) {
        payload = {
          canvasSize: templateMeta.canvasSize,
          json: templateMeta.json,
        };
        }

      if (!payload?.json) {
        if (!isCanvasActive()) return;
        clearNativeCanvasBackground(c);
        c.clear();
        c.setDimensions({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
        c.setViewportTransform([1, 0, 0, 1, 0, 0]);
        syncCanvasBackgroundColor(c);
        setCanvasSize({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
        setHasBackground(false);
        setHasSelection(false);
        setHasTextSelection(false);
        setPositionCard(null);
        ensureAllElementIds(c, getFabricTextareaHost());
        requestAnimationFrame(() => {
          if (!isCanvasActive()) return;
          fitToViewRef.current?.({ force: true });
        });
        return;
      }

      try {
        await loadPersistedCanvasJson(c, payload.json, {
          canvasSize: payload.canvasSize,
        });
        if (!isCanvasActive()) return;

        if (payload.canvasSize) {
          setCanvasSize(payload.canvasSize);
        }
        ensureAllElementIds(c, getFabricTextareaHost());
        await ensureCanvasFontsReady(c, catalog);
        if (!isCanvasActive()) return;

        applyAutoWrapAllEnabled(c);
        applyArtboardAlignAll(c);
        clampTextObjectsOnArtboard(c);
        setHasBackground(hasNativeBackground(c));
        requestAnimationFrame(() => {
          if (!isCanvasActive()) return;
          fitToViewRef.current?.({ force: true });
        });
        if (templateId && fromAi) {
          clearAiCanvasImport();
        }
      } catch {
        /* ignore corrupt json */
      }
    };

    void loadInitial();

    return () => {
      cancelled = true;
      c.off("mouse:down", onMouseDownBeforeTextEdit);
      c.off("text:editing:entered", onTextEditingEntered);
      c.off("text:editing:exited", onTextEditingExited);
      c.off("text:changed", onTextChanged);
      c.off("text:selection:changed", onTextSelectionChanged);
      document.removeEventListener("focusin", onFocusInCapture, true);
      c.off("object:moving", onObjectMovingWithAlign);
      c.off("object:modified", onObjectModifiedWithAlign);
      c.off("object:scaling", onObjectMovingWithAlign);
      c.off("object:rotating", onObjectMovingWithAlign);
      c.dispose();
      fabricRef.current = null;
      setCanvas(null);
    };
  }, [
    syncFromSelection,
    stabilizeHiddenTextarea,
    updatePositionCard,
    clearSelectionState,
    templateId,
    fromAi,
  ]);

  const addSelectionRegion = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;

    const { width, height } = getCanvasSize();
    const regionW = 200;
    const regionH = 150;
    const region = createSelectionRegion(
      width / 2 - regionW / 2,
      height / 2 - regionH / 2,
      regionW,
      regionH
    );

    ensureElementId(region);
    c.add(region);
    c.bringObjectToFront(region);
    c.setActiveObject(region);
    c.requestRenderAll();
    setHasSelection(true);
    setHasTextSelection(false);
    updatePositionCard();
    scheduleSave();
  }, [getCanvasSize, updatePositionCard, scheduleSave]);

  const addText = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;

    const { width, height } = getCanvasSize();
    const text = new Textbox("双击编辑文字", {
      left: width / 2 - 120,
      top: height / 2 - 20,
      width: 240,
      ...TEXT_TOP_LEFT_ORIGIN,
      fontFamily: textStyle.fontFamily,
      fontSize: textStyle.fontSize,
      fill: textStyle.fill,
      textBackgroundColor:
        textStyle.textBackgroundColor === "transparent"
          ? ""
          : textStyle.textBackgroundColor,
      fontWeight: textStyle.fontWeight,
      fontStyle: textStyle.fontStyle,
      underline: textStyle.underline,
      shadow: textStyle.highlightGlow ? createTextHighlightShadow() : null,
      textAlign: textStyle.textAlign,
      charSpacing: textStyle.charSpacing,
      lineHeight: textStyle.lineHeight,
      opacity: selectionOpacity / 100,
      editable: true,
    });

    ensureElementId(text);
    c.add(text);
    c.setActiveObject(text);
    c.requestRenderAll();
    setHasTextSelection(true);
    setHasSelection(true);
  }, [textStyle, selectionOpacity, getCanvasSize]);

  const addImageFromFile = useCallback(
    async (file: File) => {
      const c = fabricRef.current;
      if (!c) return;

      try {
        const dataUrl = await fileToDataUrl(file);
        const img = await FabricImage.fromURL(dataUrl, { crossOrigin: "anonymous" });
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
          minimumScaleTrigger: 0,
          opacity: selectionOpacity / 100,
          src: dataUrl,
        });
        ensureElementId(img);
        c.add(img);
        c.setActiveObject(img);
        c.requestRenderAll();
        setHasSelection(true);
        setHasTextSelection(false);
      } catch {
        /* ignore */
      }
    },
    [getCanvasSize, selectionOpacity]
  );

  const importBackground = useCallback(
    async (file: File) => {
      const c = fabricRef.current;
      if (!c) return;

      try {
        const dataUrl = await fileToDataUrl(file);
        await setCanvasBackgroundFromDataUrl(c, dataUrl);

        syncCanvasBackgroundColor(c);
        c.requestRenderAll();

        setCanvasSize({ width: c.getWidth(), height: c.getHeight() });
        setHasBackground(true);
        setHasSelection(false);
        setHasTextSelection(false);
        scheduleSave();

        requestAnimationFrame(() => fitToView({ force: true }));
      } catch {
        /* ignore */
      }
    },
    [fitToView, scheduleSave]
  );

  const removeBackground = useCallback(() => {
    const c = fabricRef.current;
    if (!c || !hasNativeBackground(c)) return;

    removeCanvasBackground(c);
    setHasBackground(false);
    setHasSelection(false);
    setHasTextSelection(false);
    scheduleSave();
  }, [scheduleSave]);

  const clearCanvas = useCallback(async () => {
    const c = fabricRef.current;
    if (!c) return;

    clearNativeCanvasBackground(c);
    c.clear();
    c.setDimensions({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
    c.setViewportTransform([1, 0, 0, 1, 0, 0]);
    syncCanvasBackgroundColor(c);
    c.discardActiveObject();
    c.requestRenderAll();

    setCanvasSize({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
    setHasBackground(false);
    setHasSelection(false);
    setHasTextSelection(false);

    requestAnimationFrame(() => fitToView({ force: true }));
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

  const toggleAlignArtboardH = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;
    const targets = getAlignTargets(c);
    if (!targets.length) return;

    const next = !alignArtboardH;
    targets.forEach((obj) => {
      setObjectAlignArtboardH(obj, next);
      if (next) applyArtboardAlignToObject(c, obj);
    });
    const active = c.getActiveObject();
    if (isTextbox(active) && active.isEditing) {
      runTextEditingSync(c, active);
    }
    c.requestRenderAll();
    setAlignArtboardH(next);
    updatePositionCard();
    scheduleSave();
  }, [alignArtboardH, updatePositionCard, scheduleSave]);

  const applySelectionTransform = useCallback(
    (mutate: (obj: FabricObject) => void) => {
      const c = fabricRef.current;
      if (!c) return;
      exitActiveTextEditing(c);
      const target = getTransformTarget(c);
      if (!target) return;

      mutate(target);

      const alignTargets = isActiveSelection(target)
        ? target.getObjects()
        : [target];
      alignTargets.forEach((obj) => applyArtboardAlignToObject(c, obj));

      c.fire("object:modified", { target });
      c.requestRenderAll();
      updatePositionCard();
      scheduleSave();
    },
    [exitActiveTextEditing, updatePositionCard, scheduleSave]
  );

  const rotateSelectionCw = useCallback(() => {
    applySelectionTransform((obj) => rotateObjectByDelta(obj, ROTATE_STEP_DEG));
  }, [applySelectionTransform]);

  const rotateSelectionCcw = useCallback(() => {
    applySelectionTransform((obj) => rotateObjectByDelta(obj, -ROTATE_STEP_DEG));
  }, [applySelectionTransform]);

  const flipSelectionHorizontal = useCallback(() => {
    applySelectionTransform((obj) => toggleFlipHorizontal(obj));
  }, [applySelectionTransform]);

  const flipSelectionVertical = useCallback(() => {
    applySelectionTransform((obj) => toggleFlipVertical(obj));
  }, [applySelectionTransform]);

  const toggleAlignArtboardV = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;
    const targets = getAlignTargets(c);
    if (!targets.length) return;

    const next = !alignArtboardV;
    targets.forEach((obj) => {
      setObjectAlignArtboardV(obj, next);
      if (next) applyArtboardAlignToObject(c, obj);
    });
    const active = c.getActiveObject();
    if (isTextbox(active) && active.isEditing) {
      runTextEditingSync(c, active);
    }
    c.requestRenderAll();
    setAlignArtboardV(next);
    updatePositionCard();
    scheduleSave();
  }, [alignArtboardV, updatePositionCard, scheduleSave]);

  const handleSave = useCallback(async () => {
    const result = await saveDraft();
    if (result.ok) {
      setSaveHint(
        result.updated ? "已更新当前模板" : "已新建并保存到我的模板"
      );
      setTimeout(() => setSaveHint(undefined), 2000);
    } else {
      setSaveHint(result.error ?? "保存失败");
      setTimeout(() => setSaveHint(undefined), 3000);
    }
  }, [saveDraft]);

  const applyPositionX = useCallback(
    (newX: number) => {
      const c = fabricRef.current;
      if (!c) return;
      exitActiveTextEditing(c);
      const active = c.getActiveObject();
      if (!active || isActiveSelection(active)) return;
      const pos = getObjectTopLeft(active);
      setObjectTopLeft(active, newX, pos.top, translateByCenter);
      c.fire("object:modified", { target: active });
      c.requestRenderAll();
      updatePositionCard();
      scheduleSave();
    },
    [exitActiveTextEditing, updatePositionCard, scheduleSave]
  );

  const toggleAutoWrap = useCallback(() => {
    const text = getActiveText();
    const c = fabricRef.current;
    if (!text || !c) return;

    const next = !getAutoWrapEnabled(text);
    setAutoWrapOnTextbox(text, next, autoWrapMaxChars);
    if (text.isEditing) runTextEditingSync(c, text);
    else applyArtboardAlignToObject(c, text);
    text.setCoords();
    c.requestRenderAll();
    setAutoWrapEnabled(next);
    updatePositionCard();
    scheduleSave();
  }, [getActiveText, autoWrapMaxChars, updatePositionCard, scheduleSave]);

  const changeAutoWrapMaxChars = useCallback(
    (n: number) => {
      const text = getActiveText();
      const c = fabricRef.current;
      if (!text || !c) return;

      const clamped = Math.max(4, Math.min(80, Math.round(n)));
      text.set({ autoWrapMaxChars: clamped });
      if (getAutoWrapEnabled(text)) {
        if (text.isEditing) runTextEditingSync(c, text);
        else applyAutoWrapToTextbox(text, { maxChars: clamped });
      } else if (text.isEditing) {
        runTextEditingSync(c, text);
      }
      applyArtboardAlignToObject(c, text);
      text.setCoords();
      c.requestRenderAll();
      setAutoWrapMaxChars(clamped);
      updatePositionCard();
      scheduleSave();
    },
    [getActiveText, updatePositionCard, scheduleSave]
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
      exitActiveTextEditing(c);
      const active = c.getActiveObject();
      if (!active || isActiveSelection(active)) return;
      const pos = getObjectTopLeft(active);
      setObjectTopLeft(active, pos.left, newY, translateByCenter);
      c.fire("object:modified", { target: active });
      c.requestRenderAll();
      updatePositionCard();
      scheduleSave();
    },
    [exitActiveTextEditing, updatePositionCard, scheduleSave]
  );

  const applyRegionWidth = useCallback(
    (newWidth: number) => {
      const c = fabricRef.current;
      if (!c) return;
      const active = c.getActiveObject();
      if (!active || isActiveSelection(active) || !isSelectionRegion(active)) {
        return;
      }
      const { height } = getSelectionRegionSize(active);
      setSelectionRegionSize(active, newWidth, height);
      active.setCoords();
      c.requestRenderAll();
      updatePositionCard();
      scheduleSave();
    },
    [updatePositionCard, scheduleSave]
  );

  const applyRegionHeight = useCallback(
    (newHeight: number) => {
      const c = fabricRef.current;
      if (!c) return;
      const active = c.getActiveObject();
      if (!active || isActiveSelection(active) || !isSelectionRegion(active)) {
        return;
      }
      const { width } = getSelectionRegionSize(active);
      setSelectionRegionSize(active, width, newHeight);
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
      <header
        ref={headerRef}
        className="flex shrink-0 items-center justify-between border-b px-6 py-3"
      >
        <div>
          <h1 className="text-lg font-semibold tracking-tight">图像编辑</h1>
          <p className="text-xs text-muted-foreground">
            中键拖动视角 · Alt+滚轮缩放 · Shift 拖动与元素对齐吸附
          </p>
        </div>
      </header>

      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden overscroll-none"
        style={{
          overscrollBehavior: "none",
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
            className="inline-block overflow-hidden rounded-lg shadow-2xl ring-1 ring-border/50 leading-none"
            style={{ width: canvasSize.width, height: canvasSize.height }}
          >
            <canvas ref={canvasElRef} className="block max-w-none" />
          </div>
        </div>

        <EditorTopToolbar
          expanded={topToolbarExpanded}
          onToggle={() => setTopToolbarExpanded((v) => !v)}
          onImportBackground={triggerBackgroundUpload}
          onRemoveBackground={removeBackground}
          hasBackground={hasBackground}
          onExport={exportImage}
          onClearCanvas={() => void clearCanvas()}
          canvasSize={canvasSize}
        />

        <EditorPositionCard
          state={positionCard}
          containerRef={containerRef}
          onChangeX={applyPositionX}
          onChangeY={applyPositionY}
          onChangeWidth={applyRegionWidth}
          onChangeHeight={applyRegionHeight}
          onChangeElementId={applyElementId}
        />

        <EditorActionBar
          canUndo={canUndo}
          canRedo={canRedo}
          saveHint={saveHint}
          onUndo={undo}
          onRedo={redo}
          onSave={() => void handleSave()}
        />

        <EditorToolbar
          textStyle={textStyle}
          selectionOpacity={selectionOpacity}
          hasTextSelection={hasTextSelection}
          hasSelection={hasSelection}
          onAddText={addText}
          onAddImage={triggerLayerImageUpload}
          onAddSelectionRegion={addSelectionRegion}
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
          fontOptions={fontOptions}
          fontImporting={fontImporting}
          onImportFont={handleImportFont}
          onFontSizeChange={(size) => applyToActiveText({ fontSize: size })}
          onFontColorChange={(color) => applyToActiveText({ fill: color })}
          onTextBackgroundColorChange={(color) =>
            applyToActiveText({ textBackgroundColor: color })
          }
          onToggleUnderline={() =>
            applyToActiveText({ underline: !textStyle.underline })
          }
          onToggleHighlightGlow={() =>
            applyToActiveText({ highlightGlow: !textStyle.highlightGlow })
          }
          onCharSpacingChange={(spacing) => applyToActiveText({ charSpacing: spacing })}
          onLineHeightChange={(lineHeight) =>
            applyToActiveText({ lineHeight: clampLineHeight(lineHeight) })
          }
          onOpacityChange={applyOpacityToSelection}
          autoWrapEnabled={autoWrapEnabled}
          autoWrapMaxChars={autoWrapMaxChars}
          onToggleAutoWrap={toggleAutoWrap}
          onAutoWrapMaxCharsChange={changeAutoWrapMaxChars}
          alignArtboardH={alignArtboardH}
          alignArtboardV={alignArtboardV}
          onToggleAlignArtboardH={toggleAlignArtboardH}
          onToggleAlignArtboardV={toggleAlignArtboardV}
          onRotateCw={rotateSelectionCw}
          onRotateCcw={rotateSelectionCcw}
          onFlipHorizontal={flipSelectionHorizontal}
          onFlipVertical={flipSelectionVertical}
          onDeleteSelected={deleteSelected}
        />

        <CoverPreviewPanel
          coverPreview={coverPreview}
          coverTitle={coverTitle}
          templateId={templateId}
          containerRef={containerRef}
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
