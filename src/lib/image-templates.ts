import type {
  FabricCanvasJson,
  SavedImageTemplate,
  TemplateElementInfo,
  TemplateListItem,
} from "@/types/image-template";
import type { TemplateJsonKeyConfig } from "@/types/ai-template-keys";

export type TemplateRecordType = "template" | "work";

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

function inferRecordType(template: SavedImageTemplate): TemplateRecordType {
  if (template.recordType === "template" || template.recordType === "work") {
    return template.recordType;
  }
  // 兼容历史数据：AI 导入/自动化导出作品可能缺失 recordType
  if (template.name.includes("（导入）") || template.name.includes("（自动化）")) {
    return "work";
  }
  return "template";
}

export function getTemplateRecordType(template: SavedImageTemplate): TemplateRecordType {
  return inferRecordType(template);
}

function withNormalizedRecordType(
  template: SavedImageTemplate
): SavedImageTemplate {
  return {
    ...template,
    recordType: inferRecordType(template),
  };
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

function withRecordTypeParam(url: string, recordType?: TemplateRecordType): string {
  if (!recordType) return url;
  const connector = url.includes("?") ? "&" : "?";
  return `${url}${connector}recordType=${recordType}`;
}

function withListQuery(
  url: string,
  options?: { recordType?: TemplateRecordType; summary?: boolean }
): string {
  let next = url;
  if (options?.recordType) {
    next = withRecordTypeParam(next, options.recordType);
  }
  if (options?.summary) {
    const connector = next.includes("?") ? "&" : "?";
    next = `${next}${connector}summary=1`;
  }
  return next;
}

export interface SaveTemplateInput {
  canvasSize: { width: number; height: number };
  json: FabricCanvasJson;
  thumbnail?: string | null;
  name?: string;
  recordType?: TemplateRecordType;
  jsonPromptConfig?: SavedImageTemplate["jsonPromptConfig"];
  imagePromptConfig?: SavedImageTemplate["imagePromptConfig"];
}

export interface TemplatePromptConfigPatch {
  jsonPromptConfig?: {
    topic: string;
    systemPrompt: string;
    keyConfigs: TemplateJsonKeyConfig[];
  };
  imagePromptConfig?: {
    imageModelValue?: string;
    coverModelValue?: string;
    imageSize?: string;
    coverSize?: string;
    imagePrompt: string;
    coverPrompt?: string;
    imageAppendEnabled: boolean;
    imageAppendSelectedKeys: string[];
    coverAppendEnabled: boolean;
    coverAppendSelectedKeys: string[];
  };
}

export async function loadTemplates(): Promise<SavedImageTemplate[]> {
  const data = await requestJson<{ templates: SavedImageTemplate[] }>("/api/templates");
  return data.templates.map(withNormalizedRecordType);
}

export async function loadTemplatesByType(
  recordType: TemplateRecordType
): Promise<SavedImageTemplate[]> {
  const data = await requestJson<{ templates: SavedImageTemplate[] }>(
    withRecordTypeParam("/api/templates", recordType)
  );
  return data.templates.map(withNormalizedRecordType);
}

export async function loadTemplatesSummaryByType(
  recordType: TemplateRecordType
): Promise<TemplateListItem[]> {
  const data = await requestJson<{ templates: TemplateListItem[] }>(
    withListQuery("/api/templates", { recordType, summary: true })
  );
  return data.templates.map((item) => ({
    ...item,
    recordType: item.recordType ?? recordType,
  }));
}

export async function loadTemplateLibrary(): Promise<SavedImageTemplate[]> {
  return loadTemplatesByType("template");
}

export async function loadTemplateLibrarySummary(): Promise<TemplateListItem[]> {
  return loadTemplatesSummaryByType("template");
}

export async function loadWorksLibrary(): Promise<SavedImageTemplate[]> {
  return loadTemplatesByType("work");
}

export async function loadWorksLibrarySummary(): Promise<TemplateListItem[]> {
  return loadTemplatesSummaryByType("work");
}

export async function saveTemplate(input: SaveTemplateInput): Promise<SavedImageTemplate> {
  const savedAt = Date.now();
  const elements = parseElementsFromCanvasJson(input.json);
  const template: SavedImageTemplate = {
    id: crypto.randomUUID(),
    name: input.name?.trim() || formatTemplateName(savedAt),
    recordType: input.recordType ?? "template",
    savedAt,
    canvasSize: input.canvasSize,
    json: input.json,
    thumbnail: input.thumbnail ?? null,
    elements,
    elementCount: elements.length,
    jsonPromptConfig: input.jsonPromptConfig,
    imagePromptConfig: input.imagePromptConfig,
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

export async function deleteTemplateByType(
  id: string,
  recordType: TemplateRecordType
): Promise<void> {
  await requestJson(withRecordTypeParam(`/api/templates/${id}`, recordType), {
    method: "DELETE",
  });
}

export async function getTemplateById(id: string): Promise<SavedImageTemplate | undefined> {
  try {
    const data = await requestJson<{ template: SavedImageTemplate | null }>(`/api/templates/${id}`);
    if (!data.template) return undefined;
    return withNormalizedRecordType(data.template);
  } catch {
    return undefined;
  }
}

export async function getTemplateByIdAndType(
  id: string,
  recordType: TemplateRecordType
): Promise<SavedImageTemplate | undefined> {
  try {
    const data = await requestJson<{ template: SavedImageTemplate | null }>(
      withRecordTypeParam(`/api/templates/${id}`, recordType)
    );
    if (!data.template) return undefined;
    return withNormalizedRecordType(data.template);
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

export async function renameTemplateByType(
  id: string,
  name: string,
  recordType: TemplateRecordType
): Promise<void> {
  await requestJson(withRecordTypeParam(`/api/templates/${id}`, recordType), {
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
