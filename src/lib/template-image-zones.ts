import { SELECTION_REGION_ROLE, SELECTION_REGION_ROLE_KEY } from "@/components/image-editor/selection-region";
import { getBoundsFromFabricJson } from "@/lib/fabric-bounds";
import type { FabricCanvasJson, SavedImageTemplate } from "@/types/image-template";
import type { TemplateImageZone, TemplateImageZoneKind } from "@/types/ai-image";

function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function getEditorRole(obj: Record<string, unknown>): string | null {
  const direct = str(obj[SELECTION_REGION_ROLE_KEY]);
  if (direct) return direct;
  const extra = obj.extra;
  if (extra && typeof extra === "object") {
    const role = str((extra as Record<string, unknown>)[SELECTION_REGION_ROLE_KEY]);
    if (role) return role;
  }
  return null;
}

function zoneLabel(kind: TemplateImageZoneKind, index: number): string {
  if (kind === "selectionRegion") return `图片选区 #${index + 1}`;
  return `图片图层 #${index + 1}`;
}

/** 从画布 JSON 解析可生图的选区（优先图片选区，其次 image 图层） */
export function parseImageZonesFromCanvasJson(
  json: FabricCanvasJson
): TemplateImageZone[] {
  const objects = json.objects;
  if (!Array.isArray(objects)) return [];

  const zones: TemplateImageZone[] = [];
  let regionCount = 0;
  let imageCount = 0;

  objects.forEach((raw, elementIndex) => {
    if (!raw || typeof raw !== "object") return;
    const obj = raw as Record<string, unknown>;
    const type = str(obj.type)?.toLowerCase() ?? "";
    const role = getEditorRole(obj);

    let kind: TemplateImageZoneKind | null = null;
    if (role === SELECTION_REGION_ROLE) {
      kind = "selectionRegion";
      regionCount += 1;
    } else if (type === "image") {
      kind = "image";
      imageCount += 1;
    }
    if (!kind) return;

    const bounds = getBoundsFromFabricJson(obj);
    const label =
      kind === "selectionRegion"
        ? zoneLabel("selectionRegion", regionCount - 1)
        : zoneLabel("image", imageCount - 1);

    zones.push({
      elementIndex,
      kind,
      label,
      ...bounds,
    });
  });

  return zones;
}

export function getImageZonesForTemplate(
  template: SavedImageTemplate
): TemplateImageZone[] {
  return parseImageZonesFromCanvasJson(template.json);
}
