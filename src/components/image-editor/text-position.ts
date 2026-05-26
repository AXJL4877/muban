import { IText, Textbox, FabricText, type FabricObject, type Textbox as TextboxType } from "fabric";

export const TEXT_TOP_LEFT_ORIGIN = {
  originX: "left" as const,
  originY: "top" as const,
};

export function isTextLikeObject(
  obj: FabricObject | undefined
): obj is TextboxType {
  const t = obj?.type;
  return t === "textbox" || t === "i-text" || t === "text";
}

/** 新建文本默认以左上角为原点 */
export function installTextTopLeftDefaults(): void {
  const patch = { ...TEXT_TOP_LEFT_ORIGIN };
  Object.assign(Textbox.ownDefaults, patch);
  Object.assign(IText.ownDefaults, patch);
  Object.assign(FabricText.ownDefaults, patch);
}

/** 画布上文本对象的视觉左上角 */
export function getTextboxTopLeft(obj: FabricObject): {
  left: number;
  top: number;
} {
  const rect = obj.getBoundingRect();
  return { left: rect.left, top: rect.top };
}

/**
 * 将文本锚点固定为左上角；若原为 center 等，按视觉位置换算，避免加载后跳动。
 */
export function ensureTextboxTopLeftOrigin(text: FabricObject): void {
  if (!isTextLikeObject(text)) return;
  if (text.originX === "left" && text.originY === "top") return;

  const { left, top } = getTextboxTopLeft(text);
  text.set({
    ...TEXT_TOP_LEFT_ORIGIN,
    left,
    top,
  });
  text.setCoords();
}

/** 修改文本内容或样式后保持左上角不变 */
export function preserveTextboxTopLeft(
  text: TextboxType,
  mutate: () => void
): void {
  ensureTextboxTopLeftOrigin(text);
  const left = text.left ?? 0;
  const top = text.top ?? 0;

  mutate();

  text.set({
    ...TEXT_TOP_LEFT_ORIGIN,
    left,
    top,
  });
  text.setCoords();
}

export function ensureAllTextboxTopLeftOrigins(canvas: {
  getObjects: () => FabricObject[];
}): void {
  canvas.getObjects().forEach((obj) => {
    if (isTextLikeObject(obj)) ensureTextboxTopLeftOrigin(obj);
  });
}

/** 按画布左上角设置位置（文本用 left/top，其它元素保持原逻辑） */
export function setObjectTopLeft(
  obj: FabricObject,
  left: number,
  top: number,
  translateNonText: (obj: FabricObject, dx: number, dy: number) => void
): void {
  if (isTextLikeObject(obj)) {
    ensureTextboxTopLeftOrigin(obj);
    obj.set({ left, top });
  } else {
    const rect = obj.getBoundingRect();
    translateNonText(obj, left - rect.left, top - rect.top);
  }
  obj.setCoords();
}
