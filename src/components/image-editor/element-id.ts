import { FabricObject } from "fabric";
import type { Canvas } from "fabric";
import { BACKGROUND_LAYER_PROPS } from "./background-layer";
import { SELECTION_REGION_PROPS } from "./selection-region";
import { ARTBOARD_ALIGN_PROPS } from "./artboard-align";
import { TEXT_AUTO_WRAP_PROPS } from "./text-auto-wrap";
import { ensureAllTextboxTopLeftOrigins } from "./text-position";

export const ELEMENT_ID_KEY = "elementId";

/** 序列化/反序列化时需包含的自定义字段 */
export const FABRIC_CUSTOM_PROPS = [
  ELEMENT_ID_KEY,
  ...TEXT_AUTO_WRAP_PROPS,
  ...ARTBOARD_ALIGN_PROPS,
  ...SELECTION_REGION_PROPS,
  ...BACKGROUND_LAYER_PROPS,
] as const;

let fabricCustomPropsRegistered = false;

/** 注册自定义序列化字段，确保保存后重新加载不丢失 */
export function registerFabricCustomProperties(): void {
  if (fabricCustomPropsRegistered) return;
  fabricCustomPropsRegistered = true;

  for (const key of FABRIC_CUSTOM_PROPS) {
    if (!FabricObject.customProperties.includes(key)) {
      FabricObject.customProperties.push(key);
    }
  }
}

export function generateElementId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `el_${crypto.randomUUID()}`;
  }
  return `el_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function getElementId(obj: FabricObject): string | undefined {
  const id = (obj as FabricObject & { elementId?: string }).elementId;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

/** 确保元素带有唯一 JSON 身份键 */
export function ensureElementId(obj: FabricObject): string {
  const existing = getElementId(obj);
  if (existing) return existing;
  const id = generateElementId();
  obj.set(ELEMENT_ID_KEY, id);
  return id;
}

export function validateElementId(id: string): string | null {
  const normalized = id.trim();
  if (!normalized) return "键名不能为空";
  if (normalized.length > 80) return "键名不能超过 80 个字符";
  if (/\s/.test(normalized)) return "键名不能包含空格";
  return null;
}

export function isElementIdTaken(
  canvas: Canvas,
  id: string,
  exclude?: FabricObject
): boolean {
  const normalized = id.trim();
  return canvas.getObjects().some((obj) => {
    if (obj === exclude) return false;
    return getElementId(obj) === normalized;
  });
}

export function setElementId(
  canvas: Canvas,
  obj: FabricObject,
  newId: string
): { ok: true; id: string } | { ok: false; error: string } {
  const normalized = newId.trim();
  const validationError = validateElementId(normalized);
  if (validationError) return { ok: false, error: validationError };
  if (isElementIdTaken(canvas, normalized, obj)) {
    return { ok: false, error: "该键名已被其他元素使用" };
  }
  obj.set(ELEMENT_ID_KEY, normalized);
  return { ok: true, id: normalized };
}

function isTextObject(obj: FabricObject): boolean {
  const t = obj.type;
  return t === "textbox" || t === "i-text" || t === "text";
}

export function ensureAllElementIds(
  canvas: Canvas,
  hiddenTextareaContainer?: HTMLElement | null
) {
  canvas.getObjects().forEach((obj) => {
    ensureElementId(obj);
    if (hiddenTextareaContainer && isTextObject(obj)) {
      (obj as FabricObject & { hiddenTextareaContainer?: HTMLElement | null })
        .hiddenTextareaContainer = hiddenTextareaContainer;
    }
  });
  ensureAllTextboxTopLeftOrigins(canvas);
}

/** @deprecated 请使用 @/lib/canvas-persist 中的 canvasToPersistJson */
export function canvasToPersistJson(canvas: Canvas) {
  return canvas.toObject([...FABRIC_CUSTOM_PROPS]);
}
