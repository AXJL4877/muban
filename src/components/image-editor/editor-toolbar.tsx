"use client";

import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignCenterVertical,
  Bold,
  ImagePlus,
  Italic,
  Minus,
  Plus,
  Space,
  TextWrap,
  Trash2,
  Type,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FontPicker } from "./font-picker";
import type { FontOption } from "@/lib/custom-fonts";
import type { TextStyleState } from "./types";

interface EditorToolbarProps {
  textStyle: TextStyleState;
  hasTextSelection: boolean;
  hasSelection: boolean;
  onAddText: () => void;
  onAddImage: () => void;
  onToggleBold: () => void;
  onToggleItalic: () => void;
  onToggleCenter: () => void;
  onFontFamilyChange: (family: string) => void;
  fontOptions: FontOption[];
  fontImporting?: boolean;
  onImportFont: (file: File) => void | Promise<void>;
  onFontSizeChange: (size: number) => void;
  onFontColorChange: (color: string) => void;
  onCharSpacingChange: (spacing: number) => void;
  autoWrapEnabled: boolean;
  autoWrapMaxChars: number;
  onToggleAutoWrap: () => void;
  onAutoWrapMaxCharsChange: (n: number) => void;
  onAlignHorizontalCenter: () => void;
  onAlignVerticalCenter: () => void;
  onDeleteSelected: () => void;
}

function ToolBtn({
  onClick,
  active,
  title,
  children,
  disabled,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
        "text-muted-foreground hover:bg-accent hover:text-foreground",
        "disabled:pointer-events-none disabled:opacity-40",
        active && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="mx-2 h-px bg-border" />;
}

export function EditorToolbar({
  textStyle,
  hasTextSelection,
  hasSelection,
  onAddText,
  onAddImage,
  onToggleBold,
  onToggleItalic,
  onToggleCenter,
  onFontFamilyChange,
  fontOptions,
  fontImporting,
  onImportFont,
  onFontSizeChange,
  onFontColorChange,
  onCharSpacingChange,
  autoWrapEnabled,
  autoWrapMaxChars,
  onToggleAutoWrap,
  onAutoWrapMaxCharsChange,
  onAlignHorizontalCenter,
  onAlignVerticalCenter,
  onDeleteSelected,
}: EditorToolbarProps) {
  const textControlsDisabled = !hasTextSelection;

  return (
    <aside
      className={cn(
        "absolute right-4 top-1/2 z-20 -translate-y-1/2",
        "flex w-14 flex-col items-center gap-1 rounded-xl border bg-card/95 p-2 shadow-lg backdrop-blur-sm"
      )}
    >
      <ToolBtn onClick={onAddText} title="添加文字">
        <Type className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn onClick={onAddImage} title="添加图片">
        <ImagePlus className="h-4 w-4" />
      </ToolBtn>

      <Divider />

      <FontPicker
        value={textStyle.fontFamily}
        options={fontOptions}
        pickDisabled={textControlsDisabled}
        importing={fontImporting}
        onChange={onFontFamilyChange}
        onImport={onImportFont}
      />

      <div
        className={cn(
          "flex flex-col items-center gap-0.5",
          textControlsDisabled && "opacity-40 pointer-events-none"
        )}
        title="字号"
      >
        <button
          type="button"
          disabled={textControlsDisabled}
          onClick={() => onFontSizeChange(textStyle.fontSize + 2)}
          className="flex h-5 w-9 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
        </button>
        <span className="w-9 text-center text-[10px] font-medium tabular-nums leading-none">
          {textStyle.fontSize}
        </span>
        <button
          type="button"
          disabled={textControlsDisabled}
          onClick={() => onFontSizeChange(Math.max(8, textStyle.fontSize - 2))}
          className="flex h-5 w-9 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Minus className="h-3 w-3" />
        </button>
      </div>

      <div
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-md border",
          textControlsDisabled && "opacity-40 pointer-events-none"
        )}
        title="字体颜色"
      >
        <span
          className="h-4 w-4 rounded-sm border border-border/60"
          style={{ backgroundColor: textStyle.fill }}
        />
        <input
          type="color"
          disabled={textControlsDisabled}
          value={textStyle.fill}
          onChange={(e) => onFontColorChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="字体颜色"
        />
      </div>

      <Divider />

      <ToolBtn
        onClick={onToggleBold}
        active={textStyle.fontWeight === "bold"}
        disabled={textControlsDisabled}
        title="粗体"
      >
        <Bold className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        onClick={onToggleItalic}
        active={textStyle.fontStyle === "italic"}
        disabled={textControlsDisabled}
        title="斜体"
      >
        <Italic className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        onClick={onToggleCenter}
        active={textStyle.textAlign === "center"}
        disabled={textControlsDisabled}
        title="居中"
      >
        <AlignCenter className="h-4 w-4" />
      </ToolBtn>

      <div
        className={cn(
          "flex flex-col items-center gap-0.5",
          textControlsDisabled && "opacity-40 pointer-events-none"
        )}
        title="字间距"
      >
        <button
          type="button"
          disabled={textControlsDisabled}
          onClick={() => onCharSpacingChange(textStyle.charSpacing + 50)}
          className="flex h-5 w-9 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
        </button>
        <Space className="h-3.5 w-3.5 text-muted-foreground" />
        <button
          type="button"
          disabled={textControlsDisabled}
          onClick={() => onCharSpacingChange(Math.max(0, textStyle.charSpacing - 50))}
          className="flex h-5 w-9 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Minus className="h-3 w-3" />
        </button>
      </div>

      <div
        className={cn(
          "flex flex-col items-center gap-0.5",
          textControlsDisabled && "opacity-40 pointer-events-none"
        )}
        title="自动换行（文本块属性，按字数与标点）"
      >
        <button
          type="button"
          disabled={textControlsDisabled}
          onClick={() => onAutoWrapMaxCharsChange(autoWrapMaxChars + 1)}
          className="flex h-5 w-9 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
        </button>
        <ToolBtn
          onClick={onToggleAutoWrap}
          active={autoWrapEnabled}
          disabled={textControlsDisabled}
          title={autoWrapEnabled ? "关闭自动换行" : "开启自动换行"}
        >
          <TextWrap className="h-4 w-4" />
        </ToolBtn>
        <span className="w-9 text-center text-[10px] font-medium tabular-nums leading-none">
          {autoWrapMaxChars}
        </span>
        <button
          type="button"
          disabled={textControlsDisabled}
          onClick={() => onAutoWrapMaxCharsChange(Math.max(4, autoWrapMaxChars - 1))}
          className="flex h-5 w-9 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Minus className="h-3 w-3" />
        </button>
      </div>

      <Divider />

      <ToolBtn
        onClick={onAlignHorizontalCenter}
        disabled={!hasSelection}
        title="水平对准画板（横向中心）"
      >
        <AlignCenterVertical className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        onClick={onAlignVerticalCenter}
        disabled={!hasSelection}
        title="垂直对准画板"
      >
        <AlignCenterHorizontal className="h-4 w-4" />
      </ToolBtn>

      <Divider />

      <ToolBtn onClick={onDeleteSelected} title="删除选中" disabled={!hasSelection}>
        <Trash2 className="h-4 w-4" />
      </ToolBtn>
    </aside>
  );
}
