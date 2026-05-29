import { db } from "@/lib/db";
import type { TemplateRecordType } from "@/lib/image-templates";
import type {
  CanvasSize,
  FabricCanvasJson,
  SavedImageTemplate,
  TemplateElementInfo,
  TemplateListItem,
} from "@/types/image-template";
import type { Prisma, Template as TemplateRow } from "@prisma/client";

function normalizeRecordType(template: SavedImageTemplate): TemplateRecordType {
  if (template.recordType === "template" || template.recordType === "work") {
    return template.recordType;
  }
  if (template.name.includes("（导入）") || template.name.includes("（自动化）")) {
    return "work";
  }
  return "template";
}

function rowToTemplate(row: TemplateRow): SavedImageTemplate {
  return {
    id: row.id,
    name: row.name,
    recordType: row.recordType as TemplateRecordType,
    savedAt: Number(row.savedAt),
    canvasSize: row.canvasSize as unknown as CanvasSize,
    json: row.json as FabricCanvasJson,
    thumbnail: row.thumbnail,
    elements: row.elements as unknown as TemplateElementInfo[],
    elementCount: row.elementCount,
    jsonPromptConfig: row.jsonPromptConfig as SavedImageTemplate["jsonPromptConfig"],
    imagePromptConfig: row.imagePromptConfig as SavedImageTemplate["imagePromptConfig"],
  };
}

function templateToRowData(template: SavedImageTemplate): Prisma.TemplateCreateInput {
  return {
    id: template.id,
    name: template.name,
    recordType: normalizeRecordType(template),
    savedAt: BigInt(template.savedAt),
    canvasSize: template.canvasSize as unknown as Prisma.InputJsonValue,
    json: template.json as Prisma.InputJsonValue,
    thumbnail: template.thumbnail,
    elements: template.elements as unknown as Prisma.InputJsonValue,
    elementCount: template.elementCount,
    jsonPromptConfig: (template.jsonPromptConfig ?? null) as Prisma.InputJsonValue,
    imagePromptConfig: (template.imagePromptConfig ?? null) as Prisma.InputJsonValue,
  };
}

export async function listTemplates(): Promise<SavedImageTemplate[]> {
  const rows = await db.template.findMany({
    orderBy: { savedAt: "desc" },
  });
  return rows.map(rowToTemplate);
}

export async function listTemplatesByType(
  recordType: TemplateRecordType
): Promise<SavedImageTemplate[]> {
  const rows = await db.template.findMany({
    where: { recordType },
    orderBy: { savedAt: "desc" },
  });
  return rows.map(rowToTemplate);
}

const listSummarySelect = {
  id: true,
  name: true,
  recordType: true,
  savedAt: true,
  canvasSize: true,
  thumbnail: true,
  elementCount: true,
} as const;

function rowToListItem(
  row: Pick<
    TemplateRow,
    "id" | "name" | "recordType" | "savedAt" | "canvasSize" | "thumbnail" | "elementCount"
  >
): TemplateListItem {
  return {
    id: row.id,
    name: row.name,
    recordType: row.recordType as TemplateRecordType,
    savedAt: Number(row.savedAt),
    canvasSize: row.canvasSize as unknown as CanvasSize,
    thumbnail: row.thumbnail,
    elementCount: row.elementCount,
  };
}

export async function listTemplatesSummary(): Promise<TemplateListItem[]> {
  const rows = await db.template.findMany({
    select: listSummarySelect,
    orderBy: { savedAt: "desc" },
  });
  return rows.map(rowToListItem);
}

export async function listTemplatesSummaryByType(
  recordType: TemplateRecordType
): Promise<TemplateListItem[]> {
  const rows = await db.template.findMany({
    where: { recordType },
    select: listSummarySelect,
    orderBy: { savedAt: "desc" },
  });
  return rows.map(rowToListItem);
}

export async function upsertTemplate(template: SavedImageTemplate): Promise<SavedImageTemplate> {
  const data = templateToRowData(template);
  const row = await db.template.upsert({
    where: { id: template.id },
    create: data,
    update: data,
  });
  return rowToTemplate(row);
}

export async function getTemplate(id: string): Promise<SavedImageTemplate | null> {
  const row = await db.template.findUnique({ where: { id } });
  return row ? rowToTemplate(row) : null;
}

export async function getTemplateByType(
  id: string,
  recordType: TemplateRecordType
): Promise<SavedImageTemplate | null> {
  const row = await db.template.findFirst({
    where: { id, recordType },
  });
  return row ? rowToTemplate(row) : null;
}

export async function removeTemplate(id: string): Promise<void> {
  await db.template.deleteMany({ where: { id } });
}

export async function removeTemplateByType(
  id: string,
  recordType: TemplateRecordType
): Promise<void> {
  await db.template.deleteMany({ where: { id, recordType } });
}

export async function renameTemplateInStore(
  id: string,
  name: string
): Promise<SavedImageTemplate | null> {
  const existing = await getTemplate(id);
  if (!existing) return null;
  const nextName = name.trim() || existing.name;
  const row = await db.template.update({
    where: { id },
    data: { name: nextName },
  });
  return rowToTemplate(row);
}

export async function renameTemplateByTypeInStore(
  id: string,
  name: string,
  recordType: TemplateRecordType
): Promise<SavedImageTemplate | null> {
  const existing = await getTemplateByType(id, recordType);
  if (!existing) return null;
  const nextName = name.trim() || existing.name;
  const row = await db.template.update({
    where: { id },
    data: { name: nextName },
  });
  return rowToTemplate(row);
}
