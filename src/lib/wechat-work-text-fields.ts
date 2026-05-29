import type { SavedImageTemplate } from "@/types/image-template";

export const WECHAT_TITLE_SOURCE_WORK_NAME = "__work_name__";
export const WECHAT_TEXT_SOURCE_MANUAL = "__manual__";

export interface WorkTextField {
  key: string;
  label: string;
  text: string;
}

/** 作品中带文案的 JSON 字段（elementId 为键名） */
export function listWorkTextFields(work: SavedImageTemplate): WorkTextField[] {
  return work.elements
    .filter((el) => el.text?.trim())
    .map((el) => {
      const key = el.elementId?.trim() || `index-${el.index}`;
      const label = el.elementId?.trim() || el.label;
      return { key, label, text: el.text!.trim() };
    });
}

export function resolveWorkTextByKey(
  work: SavedImageTemplate,
  key: string | undefined | null
): string | null {
  if (!key || key === WECHAT_TEXT_SOURCE_MANUAL) return null;
  if (key === WECHAT_TITLE_SOURCE_WORK_NAME) return work.name.trim() || null;
  const field = listWorkTextFields(work).find((f) => f.key === key);
  return field?.text ?? null;
}

/** 猜测常用标题字段（大标题 / title 等） */
export function guessDefaultTitleFieldKey(
  work: SavedImageTemplate
): string | null {
  const fields = listWorkTextFields(work);
  const preferred = ["大标题", "标题", "title", "Title"];
  for (const name of preferred) {
    const hit = fields.find((f) => f.key === name || f.label === name);
    if (hit) return hit.key;
  }
  return fields[0]?.key ?? null;
}
