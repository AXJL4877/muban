import type { FabricObject, Textbox } from "fabric";

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

function isTextLikeObject(obj: FabricObject): boolean {
  const t = obj.type;
  return t === "textbox" || t === "i-text" || t === "text";
}

/** 画板坐标：取整且不小于 0（原点在画板左上角） */
export function clampArtboardCoord(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

/**
 * 画板坐标系：原点在画板左上角 (0,0)，X 向右、Y 向下，单位 px。
 * 文本（左上角锚点）用 left/top；其它元素用外框左上角 aCoords.tl。
 */
export function getArtboardPositionRaw(obj: FabricObject): {
  left: number;
  top: number;
} {
  if (
    isTextLikeObject(obj) &&
    obj.originX === "left" &&
    obj.originY === "top"
  ) {
    return {
      left: Math.round(obj.left ?? 0),
      top: Math.round(obj.top ?? 0),
    };
  }

  obj.setCoords();
  const tl = obj.aCoords?.tl;
  if (tl) {
    return { left: Math.round(tl.x), top: Math.round(tl.y) };
  }

  const rect = obj.getBoundingRect();
  return { left: Math.round(rect.left), top: Math.round(rect.top) };
}

/** 位置面板显示用：画板坐标且 XY ≥ 0 */
export function getArtboardPosition(obj: FabricObject): {
  left: number;
  top: number;
} {
  const raw = getArtboardPositionRaw(obj);
  return {
    left: clampArtboardCoord(raw.left),
    top: clampArtboardCoord(raw.top),
  };
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
    left: clampArtboardCoord(minX),
    top: clampArtboardCoord(minY),
    width: Math.max(1, Math.round(maxX - minX)),
    height: Math.max(1, Math.round(maxY - minY)),
  };
}

/**
 * 文本实际墨迹尺寸（按行宽/总高，不含 Textbox 右侧留白）。
 * 不修改 width，仅用于展示与坐标换算。
 */
export function getTextContentSize(obj: FabricObject): {
  width: number;
  height: number;
} {
  const text = obj as Textbox;
  text.initDimensions();
  const scaleX = obj.scaleX ?? 1;
  const scaleY = obj.scaleY ?? 1;
  const w = Math.max(1, Math.ceil((text.calcTextWidth() || 1) * scaleX));
  const h = Math.max(1, Math.ceil((text.calcTextHeight() || 1) * scaleY));
  return { width: w, height: h };
}

/** 从已加载的 Fabric 对象读取包围盒（位置为画板坐标） */
export function getBoundsFromFabricObject(obj: FabricObject): BoundsRect {
  const pos = getArtboardPosition(obj);
  if (isTextLikeObject(obj)) {
    const size = getTextContentSize(obj);
    return {
      left: pos.left,
      top: pos.top,
      width: size.width,
      height: size.height,
    };
  }
  const rect = obj.getBoundingRect();
  return {
    left: pos.left,
    top: pos.top,
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height)),
  };
}
