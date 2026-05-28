import type { FabricCanvasJson, SavedImageTemplate } from "@/types/image-template";

export interface WorkImageAsset {
  id: string;
  label: string;
  src: string;
}

export interface WorkPromptSection {
  title: string;
  lines: Array<{ label: string; value: string }>;
}

function walkFabricObjects(
  value: unknown,
  onObject: (obj: Record<string, unknown>) => void
): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item) => walkFabricObjects(item, onObject));
    return;
  }
  const record = value as Record<string, unknown>;
  onObject(record);
  if (record.objects) walkFabricObjects(record.objects, onObject);
}

export function extractWorkImages(work: SavedImageTemplate): WorkImageAsset[] {
  const images: WorkImageAsset[] = [];
  const seen = new Set<string>();

  const add = (label: string, src: string) => {
    if (!src.trim() || seen.has(src)) return;
    seen.add(src);
    images.push({ id: `${label}-${images.length}`, label, src });
  };

  if (work.thumbnail) add("封面", work.thumbnail);

  walkFabricObjects(work.json, (obj) => {
    const src = obj.src;
    if (typeof src !== "string" || !src.trim()) return;
    const type = String(obj.type ?? "").toLowerCase();
    if (type !== "image" && !src.startsWith("data:image")) return;
    const label =
      (typeof obj.elementId === "string" && obj.elementId) ||
      (typeof obj.name === "string" && obj.name) ||
      "画布图片";
    add(label, src);
  });

  return images;
}

export function extractWorkTextJson(work: SavedImageTemplate): Record<string, string> {
  const result: Record<string, string> = {};
  for (const element of work.elements) {
    if (!element.text?.trim()) continue;
    const key = element.elementId?.trim() || element.label;
    result[key] = element.text;
  }
  return result;
}

export function formatWorkTextJson(work: SavedImageTemplate): string {
  const payload = extractWorkTextJson(work);
  if (Object.keys(payload).length === 0) return "{}";
  return JSON.stringify(payload, null, 2);
}

export function extractWorkPromptSections(
  work: SavedImageTemplate
): WorkPromptSection[] {
  const sections: WorkPromptSection[] = [];

  if (work.jsonPromptConfig) {
    const cfg = work.jsonPromptConfig;
    const lines: Array<{ label: string; value: string }> = [
      { label: "主题", value: cfg.topic },
      { label: "系统提示词", value: cfg.systemPrompt },
    ];
    cfg.keyConfigs?.forEach((item) => {
      if (!item.enabled) return;
      lines.push({
        label: `字段 · ${item.key}`,
        value: item.instruction,
      });
    });
    sections.push({ title: "文案 JSON 提示词", lines: lines.filter((l) => l.value?.trim()) });
  }

  if (work.imagePromptConfig) {
    const cfg = work.imagePromptConfig;
    sections.push({
      title: "图片生成提示词",
      lines: [
        { label: "主图提示词", value: cfg.imagePrompt },
        { label: "封面提示词", value: cfg.coverPrompt ?? "" },
        { label: "主图模型", value: cfg.imageModelValue ?? "" },
        { label: "封面模型", value: cfg.coverModelValue ?? "" },
        { label: "主图尺寸", value: cfg.imageSize ?? "" },
        { label: "封面尺寸", value: cfg.coverSize ?? "" },
      ].filter((l) => l.value?.trim()),
    });
  }

  return sections.filter((section) => section.lines.length > 0);
}

export function summarizeCanvasJson(json: FabricCanvasJson): string {
  try {
    return JSON.stringify(json, null, 2);
  } catch {
    return "{}";
  }
}
