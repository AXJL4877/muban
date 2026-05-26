import { IText, Textbox, FabricText, type FabricObject, type Textbox as TextboxType } from "fabric";
import type { Canvas } from "fabric";
import {
  clampArtboardCoord,
  getArtboardPosition,
  getArtboardPositionRaw,
} from "@/lib/fabric-bounds";

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

/** 画板左上角坐标（位置面板，XY ≥ 0） */
export function getObjectBoundingTopLeft(obj: FabricObject): {
  left: number;
  top: number;
} {
  return getArtboardPosition(obj);
}

/** @deprecated 请使用 getObjectBoundingTopLeft */
export function getTextboxTopLeft(obj: FabricObject): {
  left: number;
  top: number;
} {
  return getObjectBoundingTopLeft(obj);
}

/**
 * 将文本锚点固定为左上角；从 center 等迁移时保持画板上的视觉位置不变。
 */
export function ensureTextboxTopLeftOrigin(text: FabricObject): void {
  if (!isTextLikeObject(text)) return;
  if (text.originX === "left" && text.originY === "top") return;

  const before = getArtboardPositionRaw(text);
  text.set({ ...TEXT_TOP_LEFT_ORIGIN });
  text.setCoords();
  const after = getArtboardPositionRaw(text);
  text.set({
    left: clampArtboardCoord((text.left ?? 0) + (before.left - after.left)),
    top: clampArtboardCoord((text.top ?? 0) + (before.top - after.top)),
  });
  text.setCoords();
}

/** 修改文本内容或样式后保持画板坐标不变 */
export function preserveTextboxTopLeft(
  text: TextboxType,
  mutate: () => void
): void {
  ensureTextboxTopLeftOrigin(text);
  const anchor = getArtboardPositionRaw(text);

  mutate();

  ensureTextboxTopLeftOrigin(text);
  const after = getArtboardPositionRaw(text);
  text.set({
    ...TEXT_TOP_LEFT_ORIGIN,
    left: clampArtboardCoord((text.left ?? 0) + (anchor.left - after.left)),
    top: clampArtboardCoord((text.top ?? 0) + (anchor.top - after.top)),
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

/** 修复载入后文本 left/top 为负的情况（画板内元素应为非负坐标） */
export function clampTextObjectsOnArtboard(canvas: Canvas): void {
  canvas.getObjects().forEach((obj) => {
    if (!isTextLikeObject(obj)) return;
    ensureTextboxTopLeftOrigin(obj);
    const left = obj.left ?? 0;
    const top = obj.top ?? 0;
    if (left < 0 || top < 0) {
      obj.set({
        left: clampArtboardCoord(left),
        top: clampArtboardCoord(top),
      });
      obj.setCoords();
    }
  });
}

/** 任意元素在画板上的位置（与位置面板一致） */
export function getObjectTopLeft(obj: FabricObject): {
  left: number;
  top: number;
} {
  return getArtboardPosition(obj);
}

/**
 * 将元素移动到画板坐标 (left, top)，原点为画板左上角，XY 不小于 0。
 */
export function setObjectTopLeft(
  obj: FabricObject,
  left: number,
  top: number,
  translateNonText: (obj: FabricObject, dx: number, dy: number) => void
): void {
  const x = clampArtboardCoord(left);
  const y = clampArtboardCoord(top);

  if (
    isTextLikeObject(obj) &&
    obj.originX === "left" &&
    obj.originY === "top"
  ) {
    ensureTextboxTopLeftOrigin(obj);
    obj.set({ ...TEXT_TOP_LEFT_ORIGIN, left: x, top: y });
    obj.setCoords();
    return;
  }

  const current = getArtboardPositionRaw(obj);
  const dx = x - current.left;
  const dy = y - current.top;
  if (dx === 0 && dy === 0) return;

  if (isTextLikeObject(obj)) {
    ensureTextboxTopLeftOrigin(obj);
    obj.set({
      ...TEXT_TOP_LEFT_ORIGIN,
      left: clampArtboardCoord((obj.left ?? 0) + dx),
      top: clampArtboardCoord((obj.top ?? 0) + dy),
    });
  } else {
    translateNonText(obj, dx, dy);
  }
  obj.setCoords();
}
