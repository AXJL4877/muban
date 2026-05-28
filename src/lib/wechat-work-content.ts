import type { SavedImageTemplate, TemplateElementInfo } from "@/types/image-template";
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
