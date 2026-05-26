import type { Canvas, FabricObject } from "fabric";

export const ROTATE_STEP_DEG = 45;

function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** 当前选中对象（含多选时的 ActiveSelection） */
export function getTransformTarget(canvas: Canvas): FabricObject | null {
  return canvas.getActiveObject() ?? null;
}

/** 绕元素中心旋转（绝对角度，Fabric centered rotation） */
export function rotateObjectByDelta(obj: FabricObject, deltaDeg: number): void {
  const next = normalizeAngle((obj.angle ?? 0) + deltaDeg);
  obj.rotate(next);
  obj.setCoords();
}

export function toggleFlipHorizontal(obj: FabricObject): void {
  obj.set({ flipX: !obj.flipX });
  obj.setCoords();
}

export function toggleFlipVertical(obj: FabricObject): void {
  obj.set({ flipY: !obj.flipY });
  obj.setCoords();
}
