import { Point, type Canvas, type FabricObject } from "fabric";

let isAligning = false;

export function getIsAligning() {
  return isAligning;
}

export function runAligning<T>(fn: () => T): T {
  isAligning = true;
  try {
    return fn();
  } finally {
    isAligning = false;
  }
}

export function getAlignTarget(canvas: Canvas): FabricObject | null {
  return canvas.getActiveObject() ?? null;
}

/** 水平对准画板中心（横向中心） */
export function alignHorizontalCenter(canvas: Canvas, target: FabricObject) {
  canvas.centerObjectH(target);
}

/** 垂直对准画板中心 */
export function alignVerticalCenter(canvas: Canvas, target: FabricObject) {
  canvas.centerObjectV(target);
}

/** 以几何中心平移，供 Shift 吸附使用 */
export function translateByCenter(
  target: FabricObject,
  dx: number,
  dy: number
) {
  if (dx === 0 && dy === 0) return;
  const center = target.getCenterPoint();
  target.setXY(new Point(center.x + dx, center.y + dy), "center", "center");
  target.setCoords();
}

/** Shift 吸附：文字框与图片 */
export function isAlignableObject(obj: FabricObject): boolean {
  const t = obj.type;
  return t === "textbox" || t === "i-text" || t === "text" || t === "image";
}

export function getObjectEdges(obj: FabricObject) {
  const r = obj.getBoundingRect();
  return {
    left: r.left,
    centerX: r.left + r.width / 2,
    right: r.left + r.width,
    top: r.top,
    centerY: r.top + r.height / 2,
    bottom: r.top + r.height,
  };
}
