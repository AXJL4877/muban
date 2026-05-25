import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { ApiResponse } from "@/types";

export async function GET() {
  try {
    const users = await db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const response: ApiResponse<typeof users> = {
      success: true,
      data: users,
    };

    return NextResponse.json(response);
  } catch {
    const response: ApiResponse<never> = {
      success: false,
      error: "获取用户列表失败",
    };
    return NextResponse.json(response, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, name, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "邮箱和密码为必填项" } satisfies ApiResponse<never>,
        { status: 400 }
      );
    }

    const user = await db.user.create({
      data: { email, name, password },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    return NextResponse.json({ success: true, data: user } satisfies ApiResponse<typeof user>, {
      status: 201,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "创建用户失败" } satisfies ApiResponse<never>,
      { status: 500 }
    );
  }
}
