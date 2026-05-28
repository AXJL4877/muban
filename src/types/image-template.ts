/** Fabric 画布 JSON（canvas.toJSON() 结果） */
export type FabricCanvasJson = Record<string, unknown>;

export interface CanvasSize {
  width: number;
  height: number;
}

/** 从作品中解析出的单个元素属性 */
export interface TemplateElementInfo {
  index: number;
  type: string;
  /** 元素在画布中的显示名称 */
  label: string;
  /** 与 JSON 键、图像编辑中「键名」一致 */
  elementId?: string;
  left: number | null;
  top: number | null;
  width: number | null;
  height: number | null;
  scaleX: number | null;
  scaleY: number | null;
  angle: number | null;
  opacity: number | null;
  fill: string | null;
  stroke: string | null;
  strokeWidth: number | null;
  text: string | null;
  fontFamily: string | null;
  fontSize: number | null;
  fontWeight: string | null;
  fontStyle: string | null;
  textAlign: string | null;
  charSpacing: number | null;
  selectable: boolean | null;
  visible: boolean | null;
  hasImageSrc: boolean;
  /** 其余未单独列出的 Fabric 属性 */
  extra: Record<string, unknown>;
}

export interface SavedImageTemplate {
  id: string;
  name: string;
  savedAt: number;
  canvasSize: CanvasSize;
  /** 完整画布 JSON，可用于在编辑器中恢复 */
  json: FabricCanvasJson;
  thumbnail: string | null;
  elements: TemplateElementInfo[];
  elementCount: number;
  /** 与模板绑定的文案 JSON 生成配置 */
  jsonPromptConfig?: {
    topic: string;
    systemPrompt: string;
    keyConfigs: Array<{
      key: string;
      elementIndex: number;
      label: string;
      enabled: boolean;
      instruction: string;
      minChars?: number;
      maxChars?: number;
    }>;
  };
  /** 与模板绑定的图片生成提示词配置 */
  imagePromptConfig?: {
    prompt: string;
    appendEnabled: boolean;
    appendSelectedKeys: string[];
  };
}
