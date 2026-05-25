import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href="/" className="text-lg font-semibold">
          My Fullstack App
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/overview" className="text-sm text-muted-foreground hover:text-foreground">
            仪表盘
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">登录</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/register">注册</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
