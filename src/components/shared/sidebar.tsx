"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Home } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/overview", label: "概览", icon: LayoutDashboard },
  { href: "/", label: "首页", icon: Home },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-muted/30 md:block">
      <nav className="flex flex-col gap-1 p-4">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent",
              pathname === href && "bg-accent font-medium"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
