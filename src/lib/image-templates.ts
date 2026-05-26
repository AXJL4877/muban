import type {
  FabricCanvasJson,
  SavedImageTemplate,
  TemplateElementInfo,
} from "@/types/image-template";

export const IMAGE_TEMPLATES_STORAGE_KEY = "image-editor-templates";
export const IMAGE_EDITOR_DRAFT_KEY = "image-editor-draft";

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

  return {
    index,
    type,
    label,
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

export function loadTemplates(): SavedImageTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(IMAGE_TEMPLATES_STORAGE_KEY);
    if (!raw) return migrateDraftIfNeeded();
    const parsed = JSON.parse(raw) as SavedImageTemplate[];
    if (!Array.isArray(parsed)) return migrateDraftIfNeeded();
    return parsed.sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

function persistTemplates(templates: SavedImageTemplate[]): void {
  localStorage.setItem(IMAGE_TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
}

function isQuotaExceededError(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === "QuotaExceededError" || err.code === 22)
  );
}

/** 写入 localStorage，配额不足时可选去掉缩略图后重试 */
function persistTemplatesWithFallback(
  templates: SavedImageTemplate[],
  opts?: { stripThumbnails?: boolean }
): void {
  const payload = opts?.stripThumbnails
    ? templates.map((t) => ({ ...t, thumbnail: null }))
    : templates;

  try {
    persistTemplates(payload);
  } catch (err) {
    if (!isQuotaExceededError(err) || opts?.stripThumbnails) throw err;
    persistTemplatesWithFallback(templates, { stripThumbnails: true });
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

    persistTemplates([template]);
    return [template];
  } catch {
    return [];
  }
}

export interface SaveTemplateInput {
  canvasSize: { width: number; height: number };
  json: FabricCanvasJson;
  thumbnail?: string | null;
  name?: string;
}

export function saveTemplate(input: SaveTemplateInput): SavedImageTemplate {
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

  const list = loadTemplates();
  list.unshift(template);
  persistTemplatesWithFallback(list);
  return template;
}

/** 更新已有模板（保留 id 与名称，刷新内容与保存时间） */
export function updateTemplate(
  id: string,
  input: SaveTemplateInput
): SavedImageTemplate | null {
  const list = loadTemplates();
  const index = list.findIndex((t) => t.id === id);
  if (index === -1) return null;

  const existing = list[index];
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

  list.splice(index, 1);
  list.unshift(updated);
  persistTemplatesWithFallback(list);
  return updated;
}

export function deleteTemplate(id: string): void {
  const list = loadTemplates().filter((t) => t.id !== id);
  persistTemplates(list);
}

export function getTemplateById(id: string): SavedImageTemplate | undefined {
  return loadTemplates().find((t) => t.id === id);
}

export function renameTemplate(id: string, name: string): void {
  const list = loadTemplates();
  const item = list.find((t) => t.id === id);
  if (!item) return;
  item.name = name.trim() || item.name;
  persistTemplates(list);
}
