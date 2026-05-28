import type { Canvas, FabricObject, Textbox } from "fabric";
import type { FabricCanvasJson } from "@/types/image-template";
import {
  isTextLikeObject,
  preserveTextboxTopLeft,
} from "./text-position";
import {
  assertWrapPreservesText,
  wrapTextByRules,
} from "./text-wrap";

export { isTextLikeObject } from "./text-position";

export const AUTO_WRAP_KEY = "autoWrap";
export const AUTO_WRAP_MAX_CHARS_KEY = "autoWrapMaxChars";
export const AUTO_WRAP_SOURCE_KEY = "autoWrapSource";

export const TEXT_AUTO_WRAP_PROPS = [
  AUTO_WRAP_KEY,
  AUTO_WRAP_MAX_CHARS_KEY,
  AUTO_WRAP_SOURCE_KEY,
] as const;

export const DEFAULT_AUTO_WRAP_MAX_CHARS = 12;

/** 测量文本行宽时临时解除 Textbox 宽度约束，避免 Fabric 按窄框二次换行 */
const MEASURE_UNCONSTRAINED_WIDTH = 10000;

type TextLike = FabricObject & {
  text?: string;
  autoWrap?: boolean;
  autoWrapMaxChars?: number;
  autoWrapSource?: string;
};

export function getAutoWrapEnabled(obj: FabricObject): boolean {
  return !!(obj as TextLike).autoWrap;
}

export function getAutoWrapMaxChars(obj: FabricObject): number {
  const n = (obj as TextLike).autoWrapMaxChars;
  if (typeof n === "number" && n >= 4 && n <= 80) return Math.round(n);
  return DEFAULT_AUTO_WRAP_MAX_CHARS;
}

/** 判断文本是否无有效内容（忽略换行与空白） */
export function isEffectivelyEmptyText(text: string): boolean {
  return text.replace(/[\n\r\s]/g, "").length === 0;
}

/** 从持久化字段读取换行源文（加载/重排时用，不反映用户正在编辑的内容） */
export function getAutoWrapSource(obj: Textbox): string {
  const src = (obj as TextLike).autoWrapSource;
  if (typeof src === "string") return src;
  return obj.text ?? "";
}

/** 从当前画布上的可见文本推导源文（用户编辑结束后必须用此函数） */
export function deriveAutoWrapSourceFromDisplay(text: Textbox): string {
  return normalizeAutoWrapSource(text.text ?? "");
}

/** 未开启自动换行时，同步 autoWrapSource；空内容时清空避免重载复活 */
export function syncTextAutoWrapMetadata(text: Textbox): void {
  const display = text.text ?? "";
  if (isEffectivelyEmptyText(display)) {
    text.set({ text: "", [AUTO_WRAP_SOURCE_KEY]: "" });
    return;
  }
  if (!getAutoWrapEnabled(text)) {
    const plain = display.replace(/\n/g, "");
    text.set({ [AUTO_WRAP_SOURCE_KEY]: plain });
  }
}

/**
 * 规范化自动换行源文：合并此前按小字数插入的单换行，保留双换行段落。
 * 避免调大每行字数后仍按旧短行分别重排，导致显示异常。
 */
export function normalizeAutoWrapSource(source: string): string {
  return source
    .split(/\n{2,}/)
    .map((block) => block.replace(/\n/g, ""))
    .join("\n\n")
    .trim();
}

function prepareTextboxWidthForMeasure(text: Textbox): void {
  const minW = text.minWidth ?? 20;
  text.set({ width: Math.max(text.width ?? minW, MEASURE_UNCONSTRAINED_WIDTH) });
}

/** 估算 JSON 文本对象在按字数换行后的合适宽度（无 Fabric 实例时使用） */
export function estimateJsonTextboxWidthForWrappedText(
  obj: Record<string, unknown>,
  wrapped: string
): number {
  const fontSize =
    typeof obj.fontSize === "number" && obj.fontSize > 0 ? obj.fontSize : 16;
  const charSpacing =
    typeof obj.charSpacing === "number" ? obj.charSpacing : 0;
  const scaleX =
    typeof obj.scaleX === "number" && obj.scaleX > 0 ? obj.scaleX : 1;
  const lines = wrapped.split("\n");
  const maxLineLen = Math.max(
    ...lines.map((line) => Array.from(line).length),
    1
  );
  const spacingExtra =
    Math.max(0, maxLineLen - 1) * (charSpacing / 1000) * fontSize;
  const minW = typeof obj.minWidth === "number" ? obj.minWidth : 20;
  const estimated =
    Math.ceil(maxLineLen * fontSize * 1.08 + spacingExtra) + 2;
  return Math.max(minW, Math.ceil(estimated / scaleX));
}

/** 去掉每行末尾空白，避免 Fabric 按空格撑大行宽与包围盒 */
export function trimTextboxTrailingSpaces(text: Textbox): void {
  const current = text.text ?? "";
  const trimmed = current
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n");
  if (trimmed !== current) {
    text.set({ text: trimmed });
  }
}

/**
 * 将 Textbox 宽度收紧到实际文字行宽（可缩小），避免宽框留白导致位置/尺寸误判。
 * 保留 1px 余量防止亚像素裁切；尊重 dynamicMinWidth（最长词宽）。
 */
export function fitTextboxWidthToContent(text: Textbox): void {
  trimTextboxTrailingSpaces(text);
  prepareTextboxWidthForMeasure(text);
  text.initDimensions();

  const minW = text.minWidth ?? 20;
  const lineCount = text._textLines?.length ?? 0;
  let maxLineW = minW;

  for (let i = 0; i < lineCount; i++) {
    maxLineW = Math.max(maxLineW, text.getLineWidth(i));
  }

  let targetW = Math.max(minW, maxLineW, text.dynamicMinWidth ?? 0);
  targetW = Math.ceil(targetW) + 1;

  text.set({ width: targetW });
  text.initDimensions();

  const minRequired = Math.max(
    minW,
    text.dynamicMinWidth ?? 0,
    typeof text.getMinWidth === "function" ? text.getMinWidth() : 0
  );
  if ((text.width ?? 0) < minRequired) {
    text.set({ width: Math.ceil(minRequired) + 1 });
    text.initDimensions();
  }

  text.set({ dirty: true });
  text._clearCache?.();
}

/** @deprecated 使用 fitTextboxWidthToContent */
export const syncTextboxWidthToWrappedLines = fitTextboxWidthToContent;

/**
 * 样式变更（字号、字间距等）后同步文本框宽高：自动换行时重排，否则仅收紧宽度。
 */
export function syncTextboxDimensions(text: Textbox): void {
  if (getAutoWrapEnabled(text)) {
    if (text.isEditing) {
      applyAutoWrapLive(text);
    } else {
      applyAutoWrapToTextbox(text);
    }
  } else {
    fitTextboxWidthToContent(text);
  }
}

function wrapSourceText(source: string, maxChars: number): string {
  let wrapped = wrapTextByRules(source, {
    maxCharsPerLine: maxChars,
    respectPunctuation: true,
  });
  if (!assertWrapPreservesText(source, wrapped)) {
    wrapped = wrapTextByRules(source, {
      maxCharsPerLine: maxChars,
      respectPunctuation: false,
    });
  }
  return wrapped;
}

let applyingLiveWrap = false;

export function isApplyingLiveAutoWrap(): boolean {
  return applyingLiveWrap;
}

/** 编辑中实时换行：同步 hiddenTextarea 与光标，避免仅在退出编辑时重排 */
export function applyAutoWrapLive(text: Textbox): boolean {
  if (!getAutoWrapEnabled(text)) return false;
  if (applyingLiveWrap) return false;
  if ((text as Textbox & { inCompositionMode?: boolean }).inCompositionMode) {
    return false;
  }

  const textarea = text.hiddenTextarea;
  const display =
    (text.isEditing && textarea ? textarea.value : text.text) ?? "";

  if (isEffectivelyEmptyText(display)) {
    applyingLiveWrap = true;
    try {
      preserveTextboxTopLeft(text, () => {
        text.set({ text: "", [AUTO_WRAP_SOURCE_KEY]: "" });
      });
      if (text.isEditing && textarea) {
        textarea.value = "";
      }
    } finally {
      applyingLiveWrap = false;
    }
    return true;
  }

  const source = normalizeAutoWrapSource(display);
  const maxChars = getAutoWrapMaxChars(text);
  const wrapped = wrapSourceText(source, maxChars);

  if (wrapped === display) {
    fitTextboxWidthToContent(text);
    return false;
  }

  let selStart = 0;
  let selEnd = 0;
  if (text.isEditing && textarea) {
    selStart = textarea.selectionStart;
    selEnd = textarea.selectionEnd;
  }

  applyingLiveWrap = true;
  try {
    preserveTextboxTopLeft(text, () => {
      text.set(AUTO_WRAP_SOURCE_KEY, source);
      text.set({ text: wrapped });
      fitTextboxWidthToContent(text);
    });

    if (text.isEditing && textarea) {
      textarea.value = wrapped;
      const len = wrapped.length;
      const nextStart = Math.min(selStart, len);
      const nextEnd = Math.min(selEnd, len);
      textarea.selectionStart = nextStart;
      textarea.selectionEnd = nextEnd;
      const graphemeSel = text.fromStringToGraphemeSelection(
        nextStart,
        nextEnd,
        wrapped
      );
      text.selectionStart = graphemeSel.selectionStart;
      text.selectionEnd = graphemeSel.selectionEnd;
      text._updateTextarea?.();
    }

    text.set({ dirty: true });
    text.initDimensions();
    text.setCoords();
  } finally {
    applyingLiveWrap = false;
  }

  return true;
}

export function applyAutoWrapToTextbox(
  text: Textbox,
  options?: { sourceText?: string; maxChars?: number }
): void {
  if (text.isEditing) {
    applyAutoWrapLive(text);
    return;
  }

  const maxChars = options?.maxChars ?? getAutoWrapMaxChars(text);
  const rawSource = options?.sourceText ?? getAutoWrapSource(text);
  const source = normalizeAutoWrapSource(rawSource);
  const wrapped = wrapSourceText(source, maxChars);

  preserveTextboxTopLeft(text, () => {
    prepareTextboxWidthForMeasure(text);
    text.set(AUTO_WRAP_SOURCE_KEY, source);
    text.set({ text: wrapped });
    fitTextboxWidthToContent(text);
  });
}

export function setAutoWrapOnTextbox(
  text: Textbox,
  enabled: boolean,
  maxChars?: number
): void {
  const chars =
    maxChars != null
      ? Math.max(4, Math.min(80, Math.round(maxChars)))
      : getAutoWrapMaxChars(text);

  text.set({
    [AUTO_WRAP_KEY]: enabled,
    [AUTO_WRAP_MAX_CHARS_KEY]: chars,
  });

  if (enabled) {
    const display = text.text ?? "";
    const source = isEffectivelyEmptyText(display)
      ? getAutoWrapSource(text)
      : deriveAutoWrapSourceFromDisplay(text);
    applyAutoWrapToTextbox(text, {
      sourceText: source,
      maxChars: chars,
    });
  }
}

/** 用户结束内联编辑或保存前：以当前可见文本为准，绝不回退到旧 autoWrapSource */
export function syncAutoWrapAfterTextEdit(text: Textbox): void {
  const display = text.text ?? "";
  if (isEffectivelyEmptyText(display)) {
    text.set({ text: "", [AUTO_WRAP_SOURCE_KEY]: "" });
    return;
  }
  if (!getAutoWrapEnabled(text)) {
    syncTextAutoWrapMetadata(text);
    return;
  }
  applyAutoWrapToTextbox(text, {
    sourceText: deriveAutoWrapSourceFromDisplay(text),
  });
}

export function applyAutoWrapAllEnabled(canvas: Canvas): void {
  canvas.getObjects().forEach((obj) => {
    if (!isTextLikeObject(obj)) return;
    if (isEffectivelyEmptyText(obj.text ?? "")) {
      obj.set({ text: "", [AUTO_WRAP_SOURCE_KEY]: "" });
      return;
    }
    if (getAutoWrapEnabled(obj)) {
      applyAutoWrapToTextbox(obj);
    }
  });
}

/** 持久化前清理文本对象：空内容不保留陈旧 autoWrapSource */
export function sanitizeTextObjectsInCanvasJson(
  json: FabricCanvasJson
): void {
  const objects = json.objects;
  if (!Array.isArray(objects)) return;

  for (const raw of objects) {
    if (raw == null || typeof raw !== "object") continue;
    const obj = raw as Record<string, unknown>;
    const type = String(obj.type ?? "").toLowerCase();
    if (type !== "textbox" && type !== "i-text" && type !== "text") continue;

    const text = typeof obj.text === "string" ? obj.text : "";
    const source =
      typeof obj[AUTO_WRAP_SOURCE_KEY] === "string"
        ? (obj[AUTO_WRAP_SOURCE_KEY] as string)
        : "";

    if (isEffectivelyEmptyText(text)) {
      obj.text = "";
      delete obj[AUTO_WRAP_SOURCE_KEY];
      continue;
    }

    if (obj[AUTO_WRAP_KEY]) {
      const derived = normalizeAutoWrapSource(text);
      obj[AUTO_WRAP_SOURCE_KEY] = derived;
    } else {
      const plain = text.replace(/\n/g, "");
      if (source !== plain) {
        obj[AUTO_WRAP_SOURCE_KEY] = plain;
      }
    }
  }
}

/** 对序列化 JSON 中的文本对象应用自动换行（AI+ 导入前） */
export function applyAutoWrapToJsonTextObject(
  obj: Record<string, unknown>
): void {
  const type = String(obj.type ?? "").toLowerCase();
  if (type !== "textbox" && type !== "i-text" && type !== "text") return;

  const text = typeof obj.text === "string" ? obj.text : "";
  if (isEffectivelyEmptyText(text)) {
    obj.text = "";
    delete obj[AUTO_WRAP_SOURCE_KEY];
    return;
  }

  if (!obj[AUTO_WRAP_KEY]) return;

  const maxChars =
    typeof obj[AUTO_WRAP_MAX_CHARS_KEY] === "number" &&
    (obj[AUTO_WRAP_MAX_CHARS_KEY] as number) >= 4
      ? Math.round(obj[AUTO_WRAP_MAX_CHARS_KEY] as number)
      : DEFAULT_AUTO_WRAP_MAX_CHARS;

  const raw =
    typeof obj[AUTO_WRAP_SOURCE_KEY] === "string"
      ? (obj[AUTO_WRAP_SOURCE_KEY] as string)
      : typeof obj.text === "string"
        ? obj.text
        : String(obj.text ?? "");

  const source = normalizeAutoWrapSource(raw);
  let wrapped = wrapTextByRules(source, {
    maxCharsPerLine: maxChars,
    respectPunctuation: true,
  });
  if (!assertWrapPreservesText(source, wrapped)) {
    wrapped = wrapTextByRules(source, {
      maxCharsPerLine: maxChars,
      respectPunctuation: false,
    });
  }

  obj[AUTO_WRAP_SOURCE_KEY] = source;
  obj.text = wrapped;
  obj[AUTO_WRAP_MAX_CHARS_KEY] = maxChars;
  obj.width = estimateJsonTextboxWidthForWrappedText(obj, wrapped);
}

/** 写入 AI 文本并尊重该元素的自动换行设置 */
export function setJsonTextWithAutoWrap(
  obj: Record<string, unknown>,
  plainText: string
): void {
  obj[AUTO_WRAP_SOURCE_KEY] = plainText;
  if (obj[AUTO_WRAP_KEY]) {
    applyAutoWrapToJsonTextObject(obj);
  } else {
    obj.text = plainText;
  }
}
