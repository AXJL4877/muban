import type { Canvas, FabricObject, Textbox } from "fabric";
import { wrapTextByRules } from "./text-wrap";

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

export function isTextLikeObject(obj: FabricObject | undefined): obj is Textbox {
  const t = obj?.type;
  return t === "textbox" || t === "i-text" || t === "text";
}

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

export function applyAutoWrapToTextbox(
  text: Textbox,
  options?: { sourceText?: string; maxChars?: number }
): void {
  const maxChars = options?.maxChars ?? getAutoWrapMaxChars(text);
  const source = options?.sourceText ?? getAutoWrapSource(text);
  text.set(AUTO_WRAP_SOURCE_KEY, source);
  const wrapped = wrapTextByRules(source, {
    maxCharsPerLine: maxChars,
    respectPunctuation: true,
  });
  text.set({ text: wrapped });
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
    const source = (text.text ?? "").trim() ? text.text ?? "" : getAutoWrapSource(text);
    applyAutoWrapToTextbox(text, { sourceText: source, maxChars: chars });
  }
}

export function syncAutoWrapAfterTextEdit(text: Textbox): void {
  if (!getAutoWrapEnabled(text)) return;
  const source = text.text ?? "";
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

  const source =
    typeof obj[AUTO_WRAP_SOURCE_KEY] === "string"
      ? (obj[AUTO_WRAP_SOURCE_KEY] as string)
      : typeof obj.text === "string"
        ? obj.text
        : String(obj.text ?? "");

  obj[AUTO_WRAP_SOURCE_KEY] = source;
  obj.text = wrapTextByRules(source, {
    maxCharsPerLine: maxChars,
    respectPunctuation: true,
  });
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
