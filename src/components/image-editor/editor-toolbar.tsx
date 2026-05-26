"use client";

import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignVerticalSpaceBetween,
  Bold,
  Droplets,
  FlipHorizontal2,
  FlipVertical2,
  ImagePlus,
  Italic,
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
  Scan,
  Space,
  TextWrap,
  Trash2,
  Type,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FontColorPicker } from "./font-color-picker";
import { FontPicker } from "./font-picker";
import type { FontOption } from "@/lib/custom-fonts";
import {
  clampLineHeight,
  clampOpacityPercent,
  LINE_HEIGHT_STEP,
  OPACITY_STEP,
  type TextStyleState,
} from "./types";
import { EDITOR_CHROME_ATTR } from "./use-canvas-outside-deselect";

interface EditorToolbarProps {
  textStyle: TextStyleState;
  selectionOpacity: number;
  hasTextSelection: boolean;
  hasSelection: boolean;
  onAddText: () => void;
  onAddImage: () => void;
  onAddSelectionRegion: () => void;
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
  onLineHeightChange: (lineHeight: number) => void;
  onOpacityChange: (opacity: number) => void;
  autoWrapEnabled: boolean;
  autoWrapMaxChars: number;
  onToggleAutoWrap: () => void;
  onAutoWrapMaxCharsChange: (n: number) => void;
  alignArtboardH: boolean;
  alignArtboardV: boolean;
  onToggleAlignArtboardH: () => void;
  onToggleAlignArtboardV: () => void;
  onRotateCw: () => void;
  onRotateCcw: () => void;
  onFlipHorizontal: () => void;
  onFlipVertical: () => void;
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
        active &&
          "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
      )}
    >
      {children}
    </button>
  );
}

function ToolbarGroup({
  children,
  disabled,
}: {
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center gap-1",
        disabled && "pointer-events-none opacity-40"
      )}
    >
      {children}
    </div>
  );
}

function SectionDivider() {
  return <div className="my-0.5 h-px w-10 bg-border" />;
}

function Stepper({
  title,
  valueLabel,
  icon,
  disabled,
  onIncrease,
  onDecrease,
}: {
  title: string;
  valueLabel?: string;
  icon: React.ReactNode;
  disabled?: boolean;
  onIncrease: () => void;
  onDecrease: () => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-0.5",
        disabled && "pointer-events-none opacity-40"
      )}
      title={title}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onIncrease}
        className="flex h-5 w-9 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none"
      >
        <Plus className="h-3 w-3" />
      </button>
      {icon}
      {valueLabel ? (
        <span className="w-9 text-center text-[10px] font-medium tabular-nums leading-none">
          {valueLabel}
        </span>
      ) : null}
      <button
        type="button"
        disabled={disabled}
        onClick={onDecrease}
        className="flex h-5 w-9 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none"
      >
        <Minus className="h-3 w-3" />
      </button>
    </div>
  );
}

export function EditorToolbar({
  textStyle,
  selectionOpacity,
  hasTextSelection,
  hasSelection,
  onAddText,
  onAddImage,
  onAddSelectionRegion,
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
  onLineHeightChange,
  onOpacityChange,
  autoWrapEnabled,
  autoWrapMaxChars,
  onToggleAutoWrap,
  onAutoWrapMaxCharsChange,
  alignArtboardH,
  alignArtboardV,
  onToggleAlignArtboardH,
  onToggleAlignArtboardV,
  onRotateCw,
  onRotateCcw,
  onFlipHorizontal,
  onFlipVertical,
  onDeleteSelected,
}: EditorToolbarProps) {
  const textDisabled = !hasTextSelection;

  return (
    <aside
      {...{ [EDITOR_CHROME_ATTR]: "" }}
      className={cn(
        "absolute right-4 top-1/2 z-20 max-h-[min(calc(100vh-5rem),680px)] w-[4.25rem] -translate-y-1/2",
        "flex flex-col items-center gap-0.5 overflow-x-hidden overflow-y-auto rounded-xl border bg-card/95 p-2 shadow-lg backdrop-blur-sm",
        "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      )}
    >
      <ToolbarGroup>
        <ToolBtn onClick={onAddText} title="添加文字">
          <Type className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn onClick={onAddImage} title="添加图片">
          <ImagePlus className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn onClick={onAddSelectionRegion} title="添加选区">
          <Scan className="h-4 w-4" />
        </ToolBtn>
      </ToolbarGroup>

      <SectionDivider />

      <ToolbarGroup disabled={textDisabled}>
        <FontPicker
          value={textStyle.fontFamily}
          options={fontOptions}
          pickDisabled={textDisabled}
          importing={fontImporting}
          onChange={onFontFamilyChange}
          onImport={onImportFont}
        />
        <Stepper
          title="字号"
          valueLabel={String(textStyle.fontSize)}
          icon={<span className="text-[9px] text-muted-foreground">字号</span>}
          disabled={textDisabled}
          onIncrease={() => onFontSizeChange(textStyle.fontSize + 2)}
          onDecrease={() => onFontSizeChange(Math.max(8, textStyle.fontSize - 2))}
        />
        <FontColorPicker
          value={textStyle.fill}
          disabled={textDisabled}
          onChange={onFontColorChange}
        />
        <ToolBtn
          onClick={onToggleBold}
          active={textStyle.fontWeight === "bold"}
          disabled={textDisabled}
          title="粗体"
        >
          <Bold className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn
          onClick={onToggleItalic}
          active={textStyle.fontStyle === "italic"}
          disabled={textDisabled}
          title="斜体"
        >
          <Italic className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn
          onClick={onToggleCenter}
          active={textStyle.textAlign === "center"}
          disabled={textDisabled}
          title="居中"
        >
          <AlignCenter className="h-4 w-4" />
        </ToolBtn>
        <Stepper
          title="字间距"
          icon={<Space className="h-3.5 w-3.5 text-muted-foreground" />}
          disabled={textDisabled}
          onIncrease={() => onCharSpacingChange(textStyle.charSpacing + 50)}
          onDecrease={() => onCharSpacingChange(Math.max(0, textStyle.charSpacing - 50))}
        />
        <Stepper
          title="行间距（行高倍数）"
          valueLabel={textStyle.lineHeight.toFixed(1)}
          icon={
            <AlignVerticalSpaceBetween className="h-3.5 w-3.5 text-muted-foreground" />
          }
          disabled={textDisabled}
          onIncrease={() =>
            onLineHeightChange(
              clampLineHeight(textStyle.lineHeight + LINE_HEIGHT_STEP)
            )
          }
          onDecrease={() =>
            onLineHeightChange(
              clampLineHeight(textStyle.lineHeight - LINE_HEIGHT_STEP)
            )
          }
        />
        <div className="flex flex-col items-center gap-0.5" title="自动换行">
          <button
            type="button"
            disabled={textDisabled}
            onClick={() => onAutoWrapMaxCharsChange(autoWrapMaxChars + 1)}
            className="flex h-5 w-9 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none"
          >
            <Plus className="h-3 w-3" />
          </button>
          <ToolBtn
            onClick={onToggleAutoWrap}
            active={autoWrapEnabled}
            disabled={textDisabled}
            title={autoWrapEnabled ? "关闭自动换行" : "开启自动换行"}
          >
            <TextWrap className="h-4 w-4" />
          </ToolBtn>
          <span className="w-9 text-center text-[10px] font-medium tabular-nums leading-none text-muted-foreground">
            {autoWrapMaxChars}字
          </span>
          <button
            type="button"
            disabled={textDisabled}
            onClick={() => onAutoWrapMaxCharsChange(Math.max(4, autoWrapMaxChars - 1))}
            className="flex h-5 w-9 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none"
          >
            <Minus className="h-3 w-3" />
          </button>
        </div>
      </ToolbarGroup>

      <SectionDivider />

      <ToolbarGroup disabled={!hasSelection}>
        <Stepper
          title="透明度"
          valueLabel={`${selectionOpacity}%`}
          icon={<Droplets className="h-3.5 w-3.5 text-muted-foreground" />}
          disabled={!hasSelection}
          onIncrease={() =>
            onOpacityChange(clampOpacityPercent(selectionOpacity + OPACITY_STEP))
          }
          onDecrease={() =>
            onOpacityChange(clampOpacityPercent(selectionOpacity - OPACITY_STEP))
          }
        />
      </ToolbarGroup>

      <SectionDivider />

      <ToolbarGroup disabled={!hasSelection}>
        <ToolBtn
          onClick={onToggleAlignArtboardH}
          disabled={!hasSelection}
          active={alignArtboardH}
          title={alignArtboardH ? "关闭水平对准画板" : "开启水平对准画板"}
        >
          <AlignCenterVertical className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn
          onClick={onToggleAlignArtboardV}
          disabled={!hasSelection}
          active={alignArtboardV}
          title={alignArtboardV ? "关闭垂直对准画板" : "开启垂直对准画板"}
        >
          <AlignCenterHorizontal className="h-4 w-4" />
        </ToolBtn>
      </ToolbarGroup>

      <SectionDivider />

      <ToolbarGroup disabled={!hasSelection}>
        <ToolBtn
          onClick={onRotateCw}
          disabled={!hasSelection}
          title="顺时针旋转 45°"
        >
          <RotateCw className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn
          onClick={onRotateCcw}
          disabled={!hasSelection}
          title="逆时针旋转 45°"
        >
          <RotateCcw className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn
          onClick={onFlipHorizontal}
          disabled={!hasSelection}
          title="水平翻转"
        >
          <FlipHorizontal2 className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn
          onClick={onFlipVertical}
          disabled={!hasSelection}
          title="垂直翻转"
        >
          <FlipVertical2 className="h-4 w-4" />
        </ToolBtn>
      </ToolbarGroup>

      <SectionDivider />

      <ToolbarGroup disabled={!hasSelection}>
        <ToolBtn
          onClick={onDeleteSelected}
          title="删除选中"
          disabled={!hasSelection}
        >
          <Trash2 className="h-4 w-4" />
        </ToolBtn>
      </ToolbarGroup>
    </aside>
  );
}
