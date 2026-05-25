import {
  applyAutoWrapToJsonTextObject,
  setJsonTextWithAutoWrap,
} from "@/components/image-editor/text-auto-wrap";
import { getEnabledKeys } from "@/lib/ai-template-keys";
import type { FabricCanvasJson } from "@/types/image-template";
import type { TemplateJsonKeyConfig } from "@/types/ai-template-keys";

export const IMAGE_EDITOR_AI_IMPORT_KEY = "image-editor-ai-import";

function stringifyFieldValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function resolveAiFieldValue(
  aiData: Record<string, unknown>,
  key: string
): unknown {
  if (Object.prototype.hasOwnProperty.call(aiData, key)) {
    return aiData[key];
  }
  const normalized = key.trim().toLowerCase();
  for (const [k, v] of Object.entries(aiData)) {
    if (k.trim().toLowerCase() === normalized) return v;
  }
  return undefined;
}

/** 将 AI 生成的 JSON 按键名写入模板画布对应元素 */
export function applyAiJsonToCanvas(
  canvasJson: FabricCanvasJson,
  aiData: Record<string, unknown>,
  keyConfigs: TemplateJsonKeyConfig[]
): FabricCanvasJson {
  const clone = structuredClone(canvasJson) as FabricCanvasJson;
  const objects = clone.objects;
  if (!Array.isArray(objects)) return clone;

  for (const config of getEnabledKeys(keyConfigs)) {
    const key = config.key.trim();
    const value = resolveAiFieldValue(aiData, key);
    if (value === undefined) continue;

    const obj = objects[config.elementIndex] as Record<string, unknown> | undefined;
    if (!obj || typeof obj !== "object") continue;

    const type = String(obj.type ?? "").toLowerCase();
    if (type === "textbox" || type === "i-text" || type === "text") {
      setJsonTextWithAutoWrap(obj, stringifyFieldValue(value));
    } else if (type === "image" && typeof value === "string" && value.length > 0) {
      obj.src = value;
    }
  }

  if (Array.isArray(objects)) {
    for (const item of objects) {
      if (item && typeof item === "object") {
        applyAutoWrapToJsonTextObject(item as Record<string, unknown>);
      }
    }
  }

  return clone;
}

/** 解析模型输出为 JSON 对象（容忍 markdown 代码块） */
export function parseAiJsonOutput(raw: string): Record<string, unknown> | null {
  let text = raw.trim();
  const block = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (block) text = block[1].trim();

  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

export interface AiCanvasImportPayload {
  templateId: string;
  canvasSize: { width: number; height: number };
  json: FabricCanvasJson;
}

export function stashAiCanvasImport(payload: AiCanvasImportPayload): void {
  sessionStorage.setItem(IMAGE_EDITOR_AI_IMPORT_KEY, JSON.stringify(payload));
}

/** 读取 AI 导入数据（不删除，避免 React Strict Mode 二次挂载时丢失） */
export function peekAiCanvasImport(
  templateId: string
): AiCanvasImportPayload | null {
  try {
    const raw = sessionStorage.getItem(IMAGE_EDITOR_AI_IMPORT_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw) as AiCanvasImportPayload;
    if (payload.templateId !== templateId) return null;
    return payload;
  } catch {
    return null;
  }
}

export function clearAiCanvasImport(): void {
  sessionStorage.removeItem(IMAGE_EDITOR_AI_IMPORT_KEY);
}

/** @deprecated 请使用 peekAiCanvasImport + clearAiCanvasImport */
export function consumeAiCanvasImport(
  templateId: string
): AiCanvasImportPayload | null {
  const payload = peekAiCanvasImport(templateId);
  if (payload) clearAiCanvasImport();
  return payload;
}
