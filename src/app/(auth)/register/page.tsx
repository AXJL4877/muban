"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerUser, type ActionState } from "@/actions/user";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ActionState = { success: false, message: "" };

export default function RegisterPage() {
  const [state, formAction, isPending] = useActionState(registerUser, initialState);

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>注册</CardTitle>
          <CardDescription>创建新账户，开始使用全栈应用</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">昵称（可选）</Label>
              <Input id="name" name="name" placeholder="您的昵称" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input id="email" name="email" type="email" placeholder="you@example.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            {state.message && (
              <p
                className={`text-sm ${state.success ? "text-green-600" : "text-destructive"}`}
              >
                {state.message}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "注册中..." : "注册"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            已有账户？{" "}
            <Link href="/login" className="text-primary hover:underline">
              去登录
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
