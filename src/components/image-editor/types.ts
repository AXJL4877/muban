export interface TextStyleState {
  fontFamily: string;
  fontSize: number;
  fill: string;
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  textAlign: "left" | "center" | "right";
  charSpacing: number;
}

export const DEFAULT_TEXT_STYLE: TextStyleState = {
  fontFamily: "微软雅黑",
  fontSize: 32,
  fill: "#1a1a1a",
  fontWeight: "normal",
  fontStyle: "normal",
  textAlign: "left",
  charSpacing: 0,
};
