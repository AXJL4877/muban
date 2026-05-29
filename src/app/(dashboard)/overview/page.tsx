import { getUsers } from "@/actions/user";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { Users } from "lucide-react";

export default async function OverviewPage() {
  const users = await getUsers();

  return (
    <div className="space-y-6 p-8">
      <PageHeader title="仪表盘概览" description="欢迎回来，这是您的数据概览" />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">用户总数</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground">已注册用户</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>最近注册用户</CardTitle>
          <CardDescription>通过 Server Action 从数据库读取</CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              暂无用户，请前往{" "}
              <a href="/register" className="text-primary hover:underline">
                注册页面
              </a>{" "}
              创建第一个用户。
            </p>
          ) : (
            <ul className="divide-y">
              {users.map((user) => (
                <li key={user.id} className="flex justify-between py-3 text-sm">
                  <span>
                    {user.name || user.email}
                    <span className="ml-2 text-muted-foreground">{user.email}</span>
                  </span>
                  <span className="text-muted-foreground">{formatDate(user.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
