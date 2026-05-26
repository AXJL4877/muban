export interface TextStyleState {
  fontFamily: string;
  fontSize: number;
  fill: string;
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  textAlign: "left" | "center" | "right";
  charSpacing: number;
  /** 行高倍数（Fabric lineHeight，默认 1.16） */
  lineHeight: number;
}

export const DEFAULT_LINE_HEIGHT = 1.16;
export const LINE_HEIGHT_MIN = 0.8;
export const LINE_HEIGHT_MAX = 3;
export const LINE_HEIGHT_STEP = 0.1;

export const DEFAULT_TEXT_STYLE: TextStyleState = {
  fontFamily: "微软雅黑",
  fontSize: 32,
  fill: "#1a1a1a",
  fontWeight: "normal",
  fontStyle: "normal",
  textAlign: "left",
  charSpacing: 0,
  lineHeight: DEFAULT_LINE_HEIGHT,
};

export function clampLineHeight(value: number): number {
  const stepped = Math.round(value / LINE_HEIGHT_STEP) * LINE_HEIGHT_STEP;
  return Math.min(LINE_HEIGHT_MAX, Math.max(LINE_HEIGHT_MIN, stepped));
}

export const OPACITY_MIN = 0;
export const OPACITY_MAX = 100;
export const OPACITY_STEP = 5;

export function clampOpacityPercent(value: number): number {
  const stepped = Math.round(value / OPACITY_STEP) * OPACITY_STEP;
  return Math.min(OPACITY_MAX, Math.max(OPACITY_MIN, stepped));
}
