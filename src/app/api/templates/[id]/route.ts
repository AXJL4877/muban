import { NextResponse } from "next/server";
import {
  getTemplate,
  getTemplateByType,
  removeTemplate,
  removeTemplateByType,
  renameTemplateInStore,
  renameTemplateByTypeInStore,
  upsertTemplate,
} from "@/lib/template-store";
import type { TemplateRecordType } from "@/lib/image-templates";
import type { SavedImageTemplate } from "@/types/image-template";

function parseRecordType(searchParams: URLSearchParams): TemplateRecordType | null {
  const type = searchParams.get("recordType");
  if (type === "template" || type === "work") return type;
  return null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const recordType = parseRecordType(searchParams);
  const template = recordType ? await getTemplateByType(id, recordType) : await getTemplate(id);
  return NextResponse.json({ template });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const recordType = parseRecordType(searchParams);
  try {
    const body = (await request.json()) as {
      template?: SavedImageTemplate;
      name?: string;
    };

    if (body.template) {
      const updated = await upsertTemplate({ ...body.template, id });
      return NextResponse.json({ template: updated });
    }

    if (typeof body.name === "string") {
      const updated = recordType
        ? await renameTemplateByTypeInStore(id, body.name, recordType)
        : await renameTemplateInStore(id, body.name);
      return NextResponse.json({ template: updated });
    }

    return NextResponse.json({ error: "缺少更新参数" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "更新模板失败" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const recordType = parseRecordType(searchParams);
  try {
    if (recordType) {
      await removeTemplateByType(id, recordType);
    } else {
      await removeTemplate(id);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "删除模板失败" }, { status: 500 });
  }
}
