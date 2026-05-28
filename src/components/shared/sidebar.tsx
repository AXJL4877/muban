"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart3,
  Bot,
  Trash2,
  ImageIcon,
  LayoutTemplate,
  MessageSquare,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
  User,
  BriefcaseBusiness,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { SavedImageTemplate } from "@/types/image-template";
import { deleteTemplateByType, loadWorksLibrary } from "@/lib/image-templates";
import {
  loadEditingWorkIds,
  subscribeEditingWorks,
} from "@/lib/image-editor-workbench";

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
  { href: "/ai-settings", label: "AI设置", icon: Bot },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [templates, setTemplates] = useState<SavedImageTemplate[]>([]);
  const [editingIds, setEditingIds] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") setCollapsed(true);
    setMounted(true);
  }, []);

  useEffect(() => {
    let disposed = false;
    const refresh = () => {
      void (async () => {
        const list = await loadWorksLibrary();
        if (disposed) return;
        setTemplates(list);
      })();
      setEditingIds(loadEditingWorkIds());
    };
    refresh();
    const offEditing = subscribeEditingWorks(refresh);
    window.addEventListener("focus", refresh);
    return () => {
      disposed = true;
      offEditing();
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const width = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;
  const editingSet = new Set(editingIds);
  const managedWorks = templates;

  const handleDeleteWork = useCallback((id: string) => {
    void (async () => {
      if (!confirm("确定删除该作品？此操作不可恢复。")) return;
      await deleteTemplateByType(id, "work");
      setTemplates((prev) => prev.filter((w) => w.id !== id));
      setEditingIds(loadEditingWorkIds());
    })();
  }, []);

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

        <div className="border-t p-2">
          <div
            className={cn(
              "flex h-8 items-center rounded-md text-xs text-muted-foreground",
              collapsed ? "justify-center" : "px-2"
            )}
            title={collapsed ? "作品管理" : undefined}
          >
            <BriefcaseBusiness className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && <span className="ml-2 font-medium">作品管理</span>}
          </div>
          <div className="mt-1 space-y-0.5">
            {managedWorks.length === 0 ? (
              <p
                className={cn(
                  "px-2 py-1.5 text-xs text-muted-foreground",
                  collapsed && "text-center"
                )}
              >
                {collapsed ? "暂无" : "暂无作品"}
              </p>
            ) : (
              managedWorks.map((work) => {
                const isEditing = editingSet.has(work.id);
                const href = `/image-edit?templateId=${work.id}`;
                return (
                  <div key={work.id} className="group flex items-center gap-1 rounded-lg pr-1 hover:bg-accent">
                    <Link
                      href={href}
                      title={collapsed ? work.name : undefined}
                      className={cn(
                        "flex h-9 min-w-0 flex-1 items-center rounded-lg text-xs transition-colors",
                        pathname === "/image-edit" && "bg-accent"
                      )}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center text-[10px] text-muted-foreground">
                        {isEditing ? "编" : "存"}
                      </span>
                      {!collapsed && (
                        <div className="flex min-w-0 flex-1 items-center gap-2 pr-1">
                          <div className="h-6 w-6 shrink-0 overflow-hidden rounded border bg-muted/30">
                            {work.thumbnail ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={work.thumbnail}
                                alt={`${work.name} 封面`}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[9px] text-muted-foreground">
                                无
                              </div>
                            )}
                          </div>
                          <span className="min-w-0 flex-1 truncate">{work.name}</span>
                        </div>
                      )}
                    </Link>
                    {!collapsed && (
                      <button
                        type="button"
                        title="删除作品"
                        onClick={() => handleDeleteWork(work.id)}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
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
