/** 模板元素对应的 JSON 键配置（用于组装系统提示词） */
export interface TemplateJsonKeyConfig {
  /** JSON 对象中的键名 */
  key: string;
  /** 关联的模板元素 index */
  elementIndex: number;
  /** 元素展示名（来自模板） */
  label: string;
  /** 是否纳入本次生成的 json 与提示词 */
  enabled: boolean;
  /** 该键的生成要求说明 */
  instruction: string;
  /** 字数上限（可选） */
  maxChars?: number;
  /** 字数下限（可选） */
  minChars?: number;
}

/** 提交给 API 的键配置（仅传必要字段） */
export interface TemplateJsonKeyPayload {
  key: string;
  enabled: boolean;
  label: string;
  instruction?: string;
  maxChars?: number;
  minChars?: number;
}
