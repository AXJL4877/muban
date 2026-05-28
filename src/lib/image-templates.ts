import type {
  FabricCanvasJson,
  SavedImageTemplate,
  TemplateElementInfo,
} from "@/types/image-template";
import type { TemplateJsonKeyConfig } from "@/types/ai-template-keys";

export const IMAGE_TEMPLATES_STORAGE_KEY = "image-editor-templates";
export const IMAGE_EDITOR_DRAFT_KEY = "image-editor-draft";
const IMAGE_TEMPLATES_MIGRATED_KEY = "image-editor-templates-migrated-db-v1";

const TYPE_LABELS: Record<string, string> = {
  textbox: "文本",
  "i-text": "文本",
  text: "文本",
  image: "图片",
  rect: "矩形",
  circle: "圆形",
  triangle: "三角形",
  line: "线条",
  path: "路径",
  group: "组合",
  activeselection: "多选",
};

const SKIP_EXTRA_KEYS = new Set([
  "type",
  "version",
  "left",
  "top",
  "width",
  "height",
  "scaleX",
  "scaleY",
  "angle",
  "opacity",
  "fill",
  "stroke",
  "strokeWidth",
  "text",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "textAlign",
  "charSpacing",
  "selectable",
  "visible",
  "src",
  "elementId",
]);

function num(v: unknown): number | null {
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function bool(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

function typeLabel(type: string, index: number): string {
  const key = type.toLowerCase();
  const base = TYPE_LABELS[key] ?? type;
  return `${base} #${index + 1}`;
}

function parseFabricObject(obj: Record<string, unknown>, index: number): TemplateElementInfo {
  const type = str(obj.type) ?? "unknown";
  const extra: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (SKIP_EXTRA_KEYS.has(key)) continue;
    if (key === "objects" && Array.isArray(value)) continue;
    extra[key] = value;
  }

  const text = str(obj.text);
  let label = typeLabel(type, index);
  if (text) {
    const preview = text.length > 24 ? `${text.slice(0, 24)}…` : text;
    label = `${label}：${preview}`;
  }

  const elementId = str(obj.elementId) ?? undefined;

  return {
    index,
    type,
    label,
    elementId,
    left: num(obj.left),
    top: num(obj.top),
    width: num(obj.width),
    height: num(obj.height),
    scaleX: num(obj.scaleX),
    scaleY: num(obj.scaleY),
    angle: num(obj.angle),
    opacity: num(obj.opacity),
    fill: str(obj.fill),
    stroke: str(obj.stroke),
    strokeWidth: num(obj.strokeWidth),
    text,
    fontFamily: str(obj.fontFamily),
    fontSize: num(obj.fontSize),
    fontWeight: str(obj.fontWeight) ?? (obj.fontWeight != null ? String(obj.fontWeight) : null),
    fontStyle: str(obj.fontStyle),
    textAlign: str(obj.textAlign),
    charSpacing: num(obj.charSpacing),
    selectable: bool(obj.selectable),
    visible: bool(obj.visible),
    hasImageSrc: typeof obj.src === "string" && obj.src.length > 0,
    extra,
  };
}

export function parseElementsFromCanvasJson(
  json: FabricCanvasJson
): TemplateElementInfo[] {
  const objects = json.objects;
  if (!Array.isArray(objects)) return [];

  return objects
    .filter((o): o is Record<string, unknown> => o != null && typeof o === "object")
    .map((obj, index) => parseFabricObject(obj, index));
}

function formatTemplateName(savedAt: number): string {
  return `作品 ${new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(savedAt))}`;
}

function safeParseLegacyTemplates(): SavedImageTemplate[] {
  try {
    const raw = localStorage.getItem(IMAGE_TEMPLATES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedImageTemplate[];
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

/** 将旧版单条草稿迁移为模板列表的首项 */
function migrateDraftIfNeeded(): SavedImageTemplate[] {
  try {
    const draftRaw = localStorage.getItem(IMAGE_EDITOR_DRAFT_KEY);
    if (!draftRaw) return [];

    const draft = JSON.parse(draftRaw) as {
      savedAt?: number;
      canvasSize?: { width: number; height: number };
      json?: FabricCanvasJson;
    };
    if (!draft.json) return [];

    const savedAt = draft.savedAt ?? Date.now();
    const template: SavedImageTemplate = {
      id: crypto.randomUUID(),
      name: formatTemplateName(savedAt),
      savedAt,
      canvasSize: draft.canvasSize ?? { width: 900, height: 600 },
      json: draft.json,
      thumbnail: null,
      elements: parseElementsFromCanvasJson(draft.json),
      elementCount: parseElementsFromCanvasJson(draft.json).length,
    };

    return [template];
  } catch {
    return [];
  }
}

async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const text = await res.text();
  const data = (text ? JSON.parse(text) : {}) as { error?: string } & T;
  if (!res.ok) {
    throw new Error(data.error || "请求失败");
  }
  return data;
}

async function migrateLocalTemplatesOnce(): Promise<void> {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(IMAGE_TEMPLATES_MIGRATED_KEY) === "1") return;

  const legacyTemplates = safeParseLegacyTemplates();
  const draftTemplates = migrateDraftIfNeeded();
  const templates = [...legacyTemplates];

  for (const item of draftTemplates) {
    if (!templates.some((t) => t.id === item.id)) templates.push(item);
  }

  if (templates.length === 0) {
    localStorage.setItem(IMAGE_TEMPLATES_MIGRATED_KEY, "1");
    return;
  }

  await requestJson("/api/templates/migrate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ templates }),
  });

  localStorage.setItem(IMAGE_TEMPLATES_MIGRATED_KEY, "1");
}

export interface SaveTemplateInput {
  canvasSize: { width: number; height: number };
  json: FabricCanvasJson;
  thumbnail?: string | null;
  name?: string;
}

export interface TemplatePromptConfigPatch {
  jsonPromptConfig?: {
    topic: string;
    systemPrompt: string;
    keyConfigs: TemplateJsonKeyConfig[];
  };
  imagePromptConfig?: {
    prompt: string;
    appendEnabled: boolean;
    appendSelectedKeys: string[];
  };
}

export async function loadTemplates(): Promise<SavedImageTemplate[]> {
  if (typeof window === "undefined") return [];
  await migrateLocalTemplatesOnce();
  const data = await requestJson<{ templates: SavedImageTemplate[] }>("/api/templates");
  return data.templates;
}

export async function saveTemplate(input: SaveTemplateInput): Promise<SavedImageTemplate> {
  const savedAt = Date.now();
  const elements = parseElementsFromCanvasJson(input.json);
  const template: SavedImageTemplate = {
    id: crypto.randomUUID(),
    name: input.name?.trim() || formatTemplateName(savedAt),
    savedAt,
    canvasSize: input.canvasSize,
    json: input.json,
    thumbnail: input.thumbnail ?? null,
    elements,
    elementCount: elements.length,
  };

  await requestJson("/api/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ template }),
  });
  return template;
}

/** 更新已有模板（保留 id 与名称，刷新内容与保存时间） */
export async function updateTemplate(
  id: string,
  input: SaveTemplateInput
): Promise<SavedImageTemplate | null> {
  const existing = await getTemplateById(id);
  if (!existing) return null;
  const savedAt = Date.now();
  const elements = parseElementsFromCanvasJson(input.json);
  const updated: SavedImageTemplate = {
    ...existing,
    savedAt,
    canvasSize: input.canvasSize,
    json: input.json,
    thumbnail: input.thumbnail ?? existing.thumbnail,
    name: input.name?.trim() || existing.name,
    elements,
    elementCount: elements.length,
  };

  await requestJson(`/api/templates/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ template: updated }),
  });
  return updated;
}

export async function deleteTemplate(id: string): Promise<void> {
  await requestJson(`/api/templates/${id}`, {
    method: "DELETE",
  });
}

export async function getTemplateById(id: string): Promise<SavedImageTemplate | undefined> {
  try {
    const data = await requestJson<{ template: SavedImageTemplate | null }>(`/api/templates/${id}`);
    return data.template ?? undefined;
  } catch {
    return undefined;
  }
}

export async function renameTemplate(id: string, name: string): Promise<void> {
  await requestJson(`/api/templates/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export async function updateTemplatePromptConfig(
  id: string,
  patch: TemplatePromptConfigPatch
): Promise<SavedImageTemplate | null> {
  const existing = await getTemplateById(id);
  if (!existing) return null;
  const updated: SavedImageTemplate = {
    ...existing,
    ...patch,
  };
  await requestJson(`/api/templates/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ template: updated }),
  });
  return updated;
}

/** 更新模板画布中某元素的 elementId（与 AI+ JSON 键同步） */
export async function updateTemplateElementId(
  templateId: string,
  elementIndex: number,
  elementId: string
): Promise<SavedImageTemplate | null> {
  const template = await getTemplateById(templateId);
  if (!template) return null;

  const objects = template.json.objects;
  if (!Array.isArray(objects)) return null;

  const obj = objects[elementIndex];
  if (!obj || typeof obj !== "object") return null;

  const json = structuredClone(template.json) as FabricCanvasJson;
  const nextObjects = json.objects as Record<string, unknown>[];
  nextObjects[elementIndex] = {
    ...nextObjects[elementIndex],
    elementId: elementId.trim(),
  };

  return updateTemplate(templateId, {
    canvasSize: template.canvasSize,
    json,
    thumbnail: template.thumbnail,
  });
}
