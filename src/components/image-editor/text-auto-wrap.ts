import type { Canvas, FabricObject, Textbox } from "fabric";
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

export function getAutoWrapSource(obj: Textbox): string {
  const src = (obj as TextLike).autoWrapSource;
  if (typeof src === "string") return src;
  return obj.text ?? "";
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

/** 按最长逻辑行扩展 Textbox 宽度，避免窄框内二次折行导致末尾不渲染 */
export function syncTextboxWidthToWrappedLines(text: Textbox): void {
  text.initDimensions();

  const lineCount = text._textLines?.length ?? 0;
  let maxLineW = text.minWidth ?? 20;

  for (let i = 0; i < lineCount; i++) {
    maxLineW = Math.max(maxLineW, text.getLineWidth(i) + 8);
  }

  const currentW = text.width ?? 0;
  if (currentW < maxLineW) {
    text.set({ width: maxLineW });
    text.initDimensions();
  }

  text.set({ dirty: true });
  text._clearCache?.();
}

export function applyAutoWrapToTextbox(
  text: Textbox,
  options?: { sourceText?: string; maxChars?: number }
): void {
  const maxChars = options?.maxChars ?? getAutoWrapMaxChars(text);
  const rawSource = options?.sourceText ?? getAutoWrapSource(text);
  const source = normalizeAutoWrapSource(rawSource);

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

  preserveTextboxTopLeft(text, () => {
    text.set(AUTO_WRAP_SOURCE_KEY, source);
    text.set({ text: wrapped });
    syncTextboxWidthToWrappedLines(text);
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
    const raw = (text.text ?? "").trim() ? text.text ?? "" : getAutoWrapSource(text);
    applyAutoWrapToTextbox(text, {
      sourceText: normalizeAutoWrapSource(raw),
      maxChars: chars,
    });
  }
}

export function syncAutoWrapAfterTextEdit(text: Textbox): void {
  if (!getAutoWrapEnabled(text)) return;
  const source = normalizeAutoWrapSource(text.text ?? "");
  applyAutoWrapToTextbox(text, { sourceText: source });
}

export function applyAutoWrapAllEnabled(canvas: Canvas): void {
  canvas.getObjects().forEach((obj) => {
    if (isTextLikeObject(obj) && getAutoWrapEnabled(obj)) {
      applyAutoWrapToTextbox(obj);
    }
  });
}

/** 对序列化 JSON 中的文本对象应用自动换行（AI+ 导入前） */
export function applyAutoWrapToJsonTextObject(
  obj: Record<string, unknown>
): void {
  const type = String(obj.type ?? "").toLowerCase();
  if (type !== "textbox" && type !== "i-text" && type !== "text") return;
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
