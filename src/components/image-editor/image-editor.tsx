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
import {
  createSelectionRegion,
  getSelectionRegionSize,
  isSelectionRegion,
  setSelectionRegionSize,
} from "./selection-region";
import { DEFAULT_TEXT_STYLE, type TextStyleState } from "./types";
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
import {
  buildSystemFontOptions,
  fetchCustomFonts,
  loadAllCustomFonts,
  loadFontFace,
  mergeFontOptions,
  uploadFontFile,
  type FontOption,
} from "@/lib/custom-fonts";
import type { FabricCanvasJson } from "@/types/image-template";
import { useCanvasHistory } from "./use-canvas-history";
import { useSnapGuides } from "./use-snap-guides";
import {
  applyAutoWrapAllEnabled,
  applyAutoWrapToTextbox,
  getAutoWrapEnabled,
  getAutoWrapMaxChars,
  setAutoWrapOnTextbox,
  syncAutoWrapAfterTextEdit,
} from "./text-auto-wrap";
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
  const [autoWrapEnabled, setAutoWrapEnabled] = useState(false);
  const [autoWrapMaxChars, setAutoWrapMaxChars] = useState(12);
  const [fontOptions, setFontOptions] = useState<FontOption[]>(buildSystemFontOptions);
  const [fontImporting, setFontImporting] = useState(false);
  const [hasBackground, setHasBackground] = useState(false);

  useEffect(() => {
    void (async () => {
      const custom = await fetchCustomFonts();
      await loadAllCustomFonts(custom);
      setFontOptions(mergeFontOptions(custom));
    })();
  }, []);

  const onHistoryRestored = useCallback((c: Canvas) => {
    ensureAllElementIds(c, getFabricTextareaHost());
    applyAutoWrapAllEnabled(c);
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
      const size = region
        ? getSelectionRegionSize(active)
        : {
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
      setPositionCard({
        x: Math.round(rect.left),
        y: Math.round(rect.top),
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
    updatePositionCard();
  }, [updatePositionCard]);

  useEffect(() => {
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
    c.on("selection:cleared", () => {
      setHasSelection(false);
      setHasTextSelection(false);
      setPositionCard(null);
    });

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
      patchTextboxTextareaPin(active);
      const textarea = active.hiddenTextarea;
      if (!textarea) return;
      stabilizeHiddenTextarea(textarea);
    };

    const onTextEditingExited = () => {
      isTextEditingRef.current = false;
      textEditScrollSnapshotRef.current = null;
      const active = c.getActiveObject();
      if (isTextbox(active)) {
        syncAutoWrapAfterTextEdit(active);
        c.requestRenderAll();
      }
      c.calcOffset();
      updatePositionCardRef.current();
      scheduleSaveRef.current();
    };

    const onTextSelectionChanged = () => {
      const active = c.getActiveObject();
      if (!isTextbox(active) || !active.isEditing) return;
      const textarea = active.hiddenTextarea;
      if (textarea) stabilizeHiddenTextarea(textarea);
    };

    c.on("mouse:down", onMouseDownBeforeTextEdit);
    c.on("text:editing:entered", onTextEditingEntered);
    c.on("text:editing:exited", onTextEditingExited);
    c.on("text:selection:changed", onTextSelectionChanged);
    document.addEventListener("focusin", onFocusInCapture, true);

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

      if (!payload?.json) {
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
        requestAnimationFrame(() => fitToViewRef.current?.({ force: true }));
        return;
      }

      try {
        await loadPersistedCanvasJson(c, payload.json, {
          canvasSize: payload.canvasSize,
        });
        if (payload.canvasSize) {
          setCanvasSize(payload.canvasSize);
        }
        ensureAllElementIds(c, getFabricTextareaHost());
        applyAutoWrapAllEnabled(c);
        setHasBackground(hasNativeBackground(c));
        requestAnimationFrame(() => fitToViewRef.current?.({ force: true }));
        if (templateId && fromAi) {
          clearAiCanvasImport();
        }
      } catch {
        /* ignore corrupt json */
      }
    };

    void loadInitial();

    return () => {
      c.off("mouse:down", onMouseDownBeforeTextEdit);
      c.off("text:editing:entered", onTextEditingEntered);
      c.off("text:editing:exited", onTextEditingExited);
      c.off("text:selection:changed", onTextSelectionChanged);
      document.removeEventListener("focusin", onFocusInCapture, true);
      c.off("object:moving", onObjectChange);
      c.off("object:modified", onObjectChange);
      c.off("object:scaling", onObjectChange);
      c.off("object:rotating", onObjectChange);
      c.dispose();
      fabricRef.current = null;
      setCanvas(null);
    };
  }, [syncFromSelection, stabilizeHiddenTextarea, updatePositionCard, templateId, fromAi]);

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
    [getCanvasSize]
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
    const isUpdating =
      !!templateId && !!getTemplateById(templateId);
    if (ok) {
      setSaveHint(
        isUpdating ? "已更新当前模板" : "已新建并保存到我的模板"
      );
      setTimeout(() => setSaveHint(undefined), 2000);
    } else {
      setSaveHint("保存失败");
      setTimeout(() => setSaveHint(undefined), 2000);
    }
  }, [saveDraft, templateId]);

  const applyPositionX = useCallback(
    (newX: number) => {
      if (isTextEditingRef.current) return;
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

  const toggleAutoWrap = useCallback(() => {
    const text = getActiveText();
    const c = fabricRef.current;
    if (!text || !c) return;

    const next = !getAutoWrapEnabled(text);
    setAutoWrapOnTextbox(text, next, autoWrapMaxChars);
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
        applyAutoWrapToTextbox(text, { maxChars: clamped });
      }
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
      if (isTextEditingRef.current) return;
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
          onSave={handleSave}
        />

        <EditorToolbar
          textStyle={textStyle}
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
          onCharSpacingChange={(spacing) => applyToActiveText({ charSpacing: spacing })}
          autoWrapEnabled={autoWrapEnabled}
          autoWrapMaxChars={autoWrapMaxChars}
          onToggleAutoWrap={toggleAutoWrap}
          onAutoWrapMaxCharsChange={changeAutoWrapMaxChars}
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
