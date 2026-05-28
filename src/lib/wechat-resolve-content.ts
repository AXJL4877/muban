import type { SavedImageTemplate } from "@/types/image-template";
import type { WechatDraftContentBlock } from "@/types/wechat";
import { renderWorkComposedImage } from "@/lib/render-work-canvas";
import type { WechatContentOption } from "@/lib/wechat-work-content";
import { sortOptionsBySelectionOrder } from "@/lib/wechat-work-content";

async function resolveImageSrc(
  work: SavedImageTemplate,
  option: WechatContentOption,
  composedCache: Map<string, string>
): Promise<string | null> {
  if (option.kind === "composed") {
    const cached = composedCache.get(option.id);
    if (cached) return cached;
    const rendered = await renderWorkComposedImage(work);
    composedCache.set(option.id, rendered);
    return rendered;
  }
  return option.imageSrc?.trim() ?? null;
}

export async function resolveWechatCoverImageSrc(
  work: SavedImageTemplate,
  options: WechatContentOption[],
  coverId: string,
  composedCache: Map<string, string>
): Promise<string | null> {
  const coverOption = options.find((o) => o.id === coverId);
  if (!coverOption) return null;
  return resolveImageSrc(work, coverOption, composedCache);
}

export async function resolveWechatContentBlocks(
  work: SavedImageTemplate,
  options: WechatContentOption[],
  bodyIds: string[],
  composedCache: Map<string, string>
): Promise<WechatDraftContentBlock[]> {
  const ordered = sortOptionsBySelectionOrder(options, bodyIds);
  const blocks: WechatDraftContentBlock[] = [];

  for (const option of ordered) {
    if (option.kind === "text" && option.text?.trim()) {
      blocks.push({ type: "text", text: option.text.trim() });
      continue;
    }

    if (
      option.kind === "image" ||
      option.kind === "composed" ||
      option.kind === "cover"
    ) {
      const imageSrc = await resolveImageSrc(work, option, composedCache);
      if (imageSrc) {
        blocks.push({ type: "image", imageSrc });
      }
    }
  }

  return blocks;
}
