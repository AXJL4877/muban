import { NextResponse } from "next/server";
import {
  getTemplate,
  removeTemplate,
  renameTemplateInStore,
  upsertTemplate,
} from "@/lib/template-store";
import type { SavedImageTemplate } from "@/types/image-template";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const template = await getTemplate(id);
  return NextResponse.json({ template });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
      const updated = await renameTemplateInStore(id, body.name);
      return NextResponse.json({ template: updated });
    }

    return NextResponse.json({ error: "缺少更新参数" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "更新模板失败" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await removeTemplate(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "删除模板失败" }, { status: 500 });
  }
}
