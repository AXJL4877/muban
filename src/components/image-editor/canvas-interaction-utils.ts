import type { FabricObject } from "fabric";
import { isBackgroundLayer } from "./background-layer";
import { isAlignableObject } from "./align-utils";
import { isSelectionRegion } from "./selection-region";

/** 未选中时悬停可显示拖动提示的对象 */
export function isHoverDraggableObject(obj: FabricObject | undefined): boolean {
  if (!obj || !obj.visible || obj.selectable === false || obj.evented === false) {
    return false;
  }
  if (isBackgroundLayer(obj)) return false;
  return isAlignableObject(obj) || isSelectionRegion(obj);
}

export const HOVER_DRAG_STROKE = "rgba(59, 130, 246, 0.75)";
