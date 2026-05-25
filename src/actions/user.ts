"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export type ActionState = {
  success: boolean;
  message: string;
};

export async function registerUser(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = formData.get("email") as string;
  const name = formData.get("name") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { success: false, message: "邮箱和密码为必填项" };
  }

  try {
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return { success: false, message: "该邮箱已被注册" };
    }

    await db.user.create({
      data: {
        email,
        name: name || null,
        password, // 生产环境请使用 bcrypt 等加密
      },
    });

    revalidatePath("/api/users");
    return { success: true, message: "注册成功" };
  } catch {
    return { success: false, message: "注册失败，请稍后重试" };
  }
}

export async function getUsers() {
  return db.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}
