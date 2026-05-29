import type { SavedImageTemplate, TemplateElementInfo } from "@/types/image-template";
import type { WechatBodyContentPattern } from "@/types/wechat";
import { extractWorkImages } from "@/lib/work-assets";

export type WechatContentKind = "cover" | "composed" | "image" | "text";

export interface WechatContentOption {
  id: string;
  kind: WechatContentKind;
  label: string;
  /** 排序：文字/图片按画布 top，其余按固定顺序 */
  order: number;
  previewText?: string;
  previewSrc?: string;
  text?: string;
  imageSrc?: string;
}

function textSortKey(element: TemplateElementInfo): number {
  return element.top ?? element.index * 1000;
}

/** 从作品中解析可供草稿选用的内容块 */
export function extractWechatContentOptions(
  work: SavedImageTemplate
): WechatContentOption[] {
  const options: WechatContentOption[] = [];
  const canvasImages = extractWorkImages(work).filter(
    (img) => img.label !== "封面"
  );

  if (work.thumbnail) {
    options.push({
      id: "cover-thumbnail",
      kind: "cover",
      label: "封面图",
      order: -1000,
      previewSrc: work.thumbnail,
      imageSrc: work.thumbnail,
    });
  }

  options.push({
    id: "composed-canvas",
    kind: "composed",
    label: "合成整图",
    order: -900,
    previewText: "导出完整画布（含文字与配图排版）",
  });

  canvasImages.forEach((img, index) => {
    options.push({
      id: `image-${img.id}`,
      kind: "image",
      label: img.label.startsWith("画布") ? `配图 · ${img.label}` : img.label,
      order: index * 10,
      previewSrc: img.src,
      imageSrc: img.src,
    });
  });

  const textElements = work.elements
    .filter((el) => el.text?.trim())
    .sort((a, b) => textSortKey(a) - textSortKey(b));

  textElements.forEach((el) => {
    const label = el.elementId?.trim() || el.label;
    options.push({
      id: `text-${el.elementId ?? el.index}`,
      kind: "text",
      label: `文字 · ${label}`,
      order: textSortKey(el),
      previewText: el.text!.length > 60 ? `${el.text!.slice(0, 60)}…` : el.text!,
      text: el.text!,
    });
  });

  return options.sort((a, b) => a.order - b.order);
}

export function getDefaultWechatContentSelection(options: WechatContentOption[]): {
  coverId: string;
  bodyIds: string[];
} {
  const coverCandidate =
    options.find((o) => o.id === "cover-thumbnail") ??
    options.find((o) => o.kind === "composed") ??
    options.find((o) => o.kind === "image");

  const bodyIds = options
    .filter((o) => o.kind === "text" || o.id === "composed-canvas")
    .map((o) => o.id);

  return {
    coverId: coverCandidate?.id ?? "",
    bodyIds,
  };
}

/** 从正文勾选推断发布模板（可跨作品复用） */
export function inferBodyPatternFromIds(
  options: WechatContentOption[],
  bodyIds: string[]
): WechatBodyContentPattern[] {
  const selected = new Set(bodyIds);
  const pattern: WechatBodyContentPattern[] = [];
  if (selected.has("composed-canvas")) pattern.push("composed");
  if (selected.has("cover-thumbnail")) pattern.push("cover");
  if (options.some((o) => o.kind === "text" && selected.has(o.id))) {
    pattern.push("text");
  }
  if (options.some((o) => o.kind === "image" && selected.has(o.id))) {
    pattern.push("image");
  }
  return pattern;
}

/** 将发布模板应用到某个作品的可用选项 */
export function resolveBodyIdsFromPattern(
  options: WechatContentOption[],
  pattern: WechatBodyContentPattern[]
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const add = (id: string) => {
    if (seen.has(id)) return;
    if (!options.some((o) => o.id === id)) return;
    seen.add(id);
    ids.push(id);
  };

  for (const item of pattern) {
    if (item === "composed") add("composed-canvas");
    else if (item === "cover") add("cover-thumbnail");
    else if (item === "text") {
      options.filter((o) => o.kind === "text").forEach((o) => add(o.id));
    } else if (item === "image") {
      options.filter((o) => o.kind === "image").forEach((o) => add(o.id));
    }
  }
  return ids;
}

export function resolvePublishCoverId(
  options: WechatContentOption[],
  preferredCoverId?: string
): string {
  const fallback = getDefaultWechatContentSelection(options).coverId;
  if (!preferredCoverId?.trim()) return fallback;
  return options.some((o) => o.id === preferredCoverId)
    ? preferredCoverId
    : fallback;
}

export function resolvePublishContentSelection(
  options: WechatContentOption[],
  template?: {
    coverId?: string;
    bodyPattern?: WechatBodyContentPattern[];
  }
): { coverId: string; bodyIds: string[] } {
  const fallback = getDefaultWechatContentSelection(options);
  const coverId = resolvePublishCoverId(options, template?.coverId);

  if (template?.bodyPattern?.length) {
    const bodyIds = resolveBodyIdsFromPattern(options, template.bodyPattern);
    if (bodyIds.length > 0) {
      return { coverId, bodyIds };
    }
  }

  return { coverId, bodyIds: fallback.bodyIds };
}

export function getCoverImageOptions(
  options: WechatContentOption[]
): WechatContentOption[] {
  return options.filter(
    (o) => o.kind === "cover" || o.kind === "composed" || o.kind === "image"
  );
}

/** 正文可选：合成整图、配图、文字；封面图也可选入正文 */
export function getSelectableBodyOptions(
  options: WechatContentOption[]
): WechatContentOption[] {
  return options.filter((o) => o.kind !== "cover" || o.id === "cover-thumbnail");
}

export function sortOptionsBySelectionOrder(
  options: WechatContentOption[],
  selectedIds: string[]
): WechatContentOption[] {
  const map = new Map(options.map((o) => [o.id, o]));
  return selectedIds
    .map((id) => map.get(id))
    .filter((o): o is WechatContentOption => !!o);
}
