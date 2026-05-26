import { Rect, type FabricObject } from "fabric";

export const SELECTION_REGION_ROLE = "selectionRegion";
export const SELECTION_REGION_ROLE_KEY = "editorRole";

export const SELECTION_REGION_PROPS = [SELECTION_REGION_ROLE_KEY] as const;

const DEFAULT_REGION_WIDTH = 200;
const DEFAULT_REGION_HEIGHT = 150;

export function isSelectionRegion(
  obj: FabricObject | undefined
): obj is Rect {
  if (!obj) return false;
  return (
    (obj as FabricObject & { editorRole?: string }).editorRole ===
    SELECTION_REGION_ROLE
  );
}

export function createSelectionRegion(
  left: number,
  top: number,
  width = DEFAULT_REGION_WIDTH,
  height = DEFAULT_REGION_HEIGHT
): Rect {
  return new Rect({
    left,
    top,
    width,
    height,
    fill: "rgba(59, 130, 246, 0.12)",
    stroke: "rgba(59, 130, 246, 0.85)",
    strokeWidth: 2,
    strokeDashArray: [8, 4],
    lockRotation: true,
    cornerColor: "rgba(59, 130, 246, 0.9)",
    cornerStrokeColor: "#ffffff",
    transparentCorners: false,
    [SELECTION_REGION_ROLE_KEY]: SELECTION_REGION_ROLE,
  });
}

/** 将选区设为指定逻辑宽高（重置 scale 为 1） */
export function setSelectionRegionSize(
  obj: FabricObject,
  width: number,
  height: number
): void {
  if (!isSelectionRegion(obj)) return;
  obj.set({
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
    scaleX: 1,
    scaleY: 1,
  });
}

/** 从对象读取逻辑宽高（优先 width×scale，否则用包围盒） */
export function getSelectionRegionSize(obj: FabricObject): {
  width: number;
  height: number;
} {
  const w = (obj.width ?? 0) * (obj.scaleX ?? 1);
  const h = (obj.height ?? 0) * (obj.scaleY ?? 1);
  if (w > 0 && h > 0) {
    return { width: Math.round(w), height: Math.round(h) };
  }
  const rect = obj.getBoundingRect();
  return {
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}
