"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart3,
  Bot,
  BriefcaseBusiness,
  ImageIcon,
  LayoutTemplate,
  MessageSquare,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
  User,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const SIDEBAR_EXPANDED = 256;
const SIDEBAR_COLLAPSED = 72;
const STORAGE_KEY = "sidebar-collapsed";

const widthTransition = {
  duration: 0.28,
  ease: [0.32, 0.72, 0, 1] as const,
};

const labelTransition = {
  duration: 0.22,
  ease: [0.4, 0, 0.2, 1] as const,
};

const navItems = [
  { href: "/analytics", label: "数据分析", icon: BarChart3 },
  { href: "/image-edit", label: "图像编辑", icon: ImageIcon },
  { href: "/ai-plus", label: "AI＋", icon: Sparkles },
  { href: "/wechat", label: "微信公众号", icon: MessageSquare },
  { href: "/my-templates", label: "我的模板", icon: LayoutTemplate },
  { href: "/my-works", label: "作品管理", icon: BriefcaseBusiness },
  { href: "/ai-settings", label: "AI设置", icon: Bot },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") setCollapsed(true);
    setMounted(true);
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const width = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;

  if (!mounted) {
    return (
      <aside
        className="flex h-full shrink-0 flex-col border-r bg-muted/30"
        style={{ width: SIDEBAR_EXPANDED }}
      />
    );
  }

  return (
    <motion.aside
      className="flex h-full shrink-0 flex-col border-r bg-muted/30"
      initial={false}
      animate={{ width }}
      transition={widthTransition}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
        <div className="border-b px-2 py-4">
          <div className="flex flex-col items-center">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary/20">
              <User className="h-7 w-7 text-primary" />
            </div>
            <motion.div
              className="w-full overflow-hidden text-center"
              initial={false}
              animate={{
                opacity: collapsed ? 0 : 1,
                marginTop: collapsed ? 0 : 12,
                maxHeight: collapsed ? 0 : 48,
              }}
              transition={labelTransition}
              aria-hidden={collapsed}
            >
              <p className="text-sm text-muted-foreground">昵称</p>
              <p className="mt-0.5 text-base font-semibold">用户昵称</p>
            </motion.div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={cn(
                  "flex h-10 items-center overflow-hidden rounded-lg text-sm transition-colors hover:bg-accent",
                  isActive && "bg-accent font-medium text-foreground"
                )}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center">
                  <Icon className="h-4 w-4" />
                </span>
                <motion.span
                  className="truncate whitespace-nowrap pr-3"
                  initial={false}
                  animate={{
                    opacity: collapsed ? 0 : 1,
                    x: collapsed ? -6 : 0,
                  }}
                  transition={labelTransition}
                  aria-hidden={collapsed}
                >
                  {label}
                </motion.span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="shrink-0 border-t p-2">
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
          className={cn(
            "flex h-10 w-full items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
            collapsed ? "justify-center" : "gap-2 px-3"
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4 shrink-0" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4 shrink-0" />
              <span className="text-sm">收起侧栏</span>
            </>
          )}
        </button>
      </div>
    </motion.aside>
  );
}
