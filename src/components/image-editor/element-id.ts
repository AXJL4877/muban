import type { Canvas, FabricObject } from "fabric";

export const ELEMENT_ID_KEY = "elementId";

/** 序列化/反序列化时需包含的自定义字段 */
export const FABRIC_CUSTOM_PROPS = [ELEMENT_ID_KEY] as const;

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

export function ensureAllElementIds(canvas: Canvas) {
  canvas.getObjects().forEach((obj) => ensureElementId(obj));
}

export function canvasToPersistJson(canvas: Canvas) {
  return canvas.toObject([...FABRIC_CUSTOM_PROPS]);
}
