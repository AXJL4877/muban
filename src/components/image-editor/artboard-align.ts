import type { Canvas, FabricObject } from "fabric";
import { isActiveSelection } from "./selection-utils";
import {
  alignHorizontalCenter,
  alignVerticalCenter,
  runAligning,
} from "./align-utils";

export const ALIGN_ARTBOARD_H_KEY = "alignArtboardH";
export const ALIGN_ARTBOARD_V_KEY = "alignArtboardV";

export const ARTBOARD_ALIGN_PROPS = [
  ALIGN_ARTBOARD_H_KEY,
  ALIGN_ARTBOARD_V_KEY,
] as const;

type Alignable = FabricObject & {
  alignArtboardH?: boolean;
  alignArtboardV?: boolean;
};

export function getAlignArtboardH(obj: FabricObject): boolean {
  return !!(obj as Alignable).alignArtboardH;
}

export function getAlignArtboardV(obj: FabricObject): boolean {
  return !!(obj as Alignable).alignArtboardV;
}

export function setAlignArtboardH(obj: FabricObject, enabled: boolean): void {
  obj.set(ALIGN_ARTBOARD_H_KEY, enabled);
}

export function setAlignArtboardV(obj: FabricObject, enabled: boolean): void {
  obj.set(ALIGN_ARTBOARD_V_KEY, enabled);
}

/** 当前选区内的可对齐元素（多选时返回全部子对象） */
export function getAlignTargets(canvas: Canvas): FabricObject[] {
  const active = canvas.getActiveObject();
  if (!active) return [];
  if (isActiveSelection(active)) return active.getObjects();
  return [active];
}

/** 按元素上保存的状态，将单元素对齐到画板 */
export function applyArtboardAlignToObject(
  canvas: Canvas,
  obj: FabricObject
): void {
  if (!getAlignArtboardH(obj) && !getAlignArtboardV(obj)) return;

  runAligning(() => {
    if (getAlignArtboardH(obj)) alignHorizontalCenter(canvas, obj);
    if (getAlignArtboardV(obj)) alignVerticalCenter(canvas, obj);
    obj.setCoords();
  });
}

/** 画布上所有已开启对齐状态的元素 */
export function applyArtboardAlignAll(canvas: Canvas): void {
  runAligning(() => {
    canvas.getObjects().forEach((obj) => {
      if (!getAlignArtboardH(obj) && !getAlignArtboardV(obj)) return;
      if (getAlignArtboardH(obj)) alignHorizontalCenter(canvas, obj);
      if (getAlignArtboardV(obj)) alignVerticalCenter(canvas, obj);
      obj.setCoords();
    });
  });
}
