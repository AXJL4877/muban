import { NextResponse } from "next/server";
import {
  deletePermanentMaterial,
  fetchImageBuffer,
  uploadPermanentImageMaterial,
} from "@/lib/wechat-api";
import {
  getCredentialsFromBody,
  wechatErrorResponse,
} from "@/lib/wechat-api-route";

interface UploadMaterialBody {
  appId?: string;
  appSecret?: string;
  imageSrc: string;
  filename?: string;
}

interface DeleteMaterialBody {
  appId?: string;
  appSecret?: string;
  mediaId: string;
}

/** 上传永久图片素材（用于草稿封面 thumb_media_id） */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as UploadMaterialBody;
    const credentials = getCredentialsFromBody(body);
    if (credentials instanceof NextResponse) return credentials;

    if (!body.imageSrc?.trim()) {
      return NextResponse.json({ error: "请提供图片 imageSrc" }, { status: 400 });
    }

    const { buffer, ext } = await fetchImageBuffer(body.imageSrc.trim());
    const filename = body.filename?.trim() || `material.${ext}`;
    const result = await uploadPermanentImageMaterial(
      credentials,
      buffer,
      filename
    );

    return NextResponse.json({
      mediaId: result.media_id,
      url: result.url ?? null,
    });
  } catch (err) {
    return wechatErrorResponse(err);
  }
}

/** 删除永久素材 */
export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as DeleteMaterialBody;
    const credentials = getCredentialsFromBody(body);
    if (credentials instanceof NextResponse) return credentials;

    if (!body.mediaId?.trim()) {
      return NextResponse.json({ error: "请提供 mediaId" }, { status: 400 });
    }

    await deletePermanentMaterial(credentials, body.mediaId.trim());
    return NextResponse.json({ ok: true });
  } catch (err) {
    return wechatErrorResponse(err);
  }
}
