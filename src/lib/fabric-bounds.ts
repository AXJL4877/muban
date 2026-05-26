import type { FabricObject } from "fabric";

export interface BoundsRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function num(v: unknown): number | null {
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

/**
 * 从 Fabric 序列化对象计算轴对齐包围盒（左上角 + 宽高）。
 * left/top 为 origin 点，需结合 originX/originY、scale、angle 换算。
 */
export function getBoundsFromFabricJson(
  obj: Record<string, unknown>
): BoundsRect {
  const originLeft = num(obj.left) ?? 0;
  const originTop = num(obj.top) ?? 0;
  const scaleX = num(obj.scaleX) ?? 1;
  const scaleY = num(obj.scaleY) ?? 1;
  const w = Math.max(1, (num(obj.width) ?? 0) * scaleX);
  const h = Math.max(1, (num(obj.height) ?? 0) * scaleY);
  const angle = num(obj.angle) ?? 0;

  const originX = str(obj.originX) ?? "left";
  const originY = str(obj.originY) ?? "top";

  const ox =
    originX === "center" ? w / 2 : originX === "right" ? w : 0;
  const oy =
    originY === "center" ? h / 2 : originY === "bottom" ? h : 0;

  const localCorners: [number, number][] = [
    [-ox, -oy],
    [w - ox, -oy],
    [w - ox, h - oy],
    [-ox, h - oy],
  ];

  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const [lx, ly] of localCorners) {
    const x = lx * cos - ly * sin + originLeft;
    const y = lx * sin + ly * cos + originTop;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  return {
    left: Math.round(minX),
    top: Math.round(minY),
    width: Math.max(1, Math.round(maxX - minX)),
    height: Math.max(1, Math.round(maxY - minY)),
  };
}

/** 从已加载的 Fabric 对象读取包围盒 */
export function getBoundsFromFabricObject(obj: FabricObject): BoundsRect {
  const rect = obj.getBoundingRect();
  return {
    left: Math.round(rect.left),
    top: Math.round(rect.top),
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height)),
  };
}
