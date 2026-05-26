"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Canvas } from "fabric";
import {
  loadTemplatePreviewCanvas,
  setCanvasPreviewInteraction,
} from "@/lib/template-preview-canvas";
import { cn } from "@/lib/utils";
import type { TemplateImageZone } from "@/types/ai-image";
import type { SavedImageTemplate } from "@/types/image-template";
import type { TemplateJsonKeyConfig } from "@/types/ai-template-keys";

export interface TemplateImagePreviewHandle {
  toDataURL: () => string | null;
}

interface TemplateImagePreviewProps {
  template: SavedImageTemplate;
  zone: TemplateImageZone | null;
  generatedImageSrc: string | null;
  aiJson?: Record<string, unknown> | null;
  keyConfigs?: TemplateJsonKeyConfig[];
  editable?: boolean;
  className?: string;
}

const PREVIEW_MAX_HEIGHT = 480;

export const TemplateImagePreview = forwardRef<
  TemplateImagePreviewHandle,
  TemplateImagePreviewProps
>(function TemplateImagePreview(
  {
    template,
    zone,
    generatedImageSrc,
    aiJson,
    keyConfigs,
    editable = false,
    className,
  },
  ref
) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const [ready, setReady] = useState(false);
  const [scale, setScale] = useState(1);

  const { width: cw, height: ch } = template.canvasSize;

  useImperativeHandle(ref, () => ({
    toDataURL: () => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      try {
        return canvas.toDataURL({ format: "png", multiplier: 1 });
      } catch {
        return null;
      }
    },
  }));

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const updateScale = () => {
      const maxW = wrapper.clientWidth || cw;
      const s = Math.min(1, maxW / cw, PREVIEW_MAX_HEIGHT / ch);
      setScale(s);
    };

    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [cw, ch]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    setReady(false);

    const canvasEl = document.createElement("canvas");
    host.replaceChildren(canvasEl);

    const canvas = new Canvas(canvasEl, {
      width: cw,
      height: ch,
      backgroundColor: "#ffffff",
      selection: false,
      preserveObjectStacking: true,
      backgroundVpt: false,
    });
    canvasRef.current = canvas;

    void (async () => {
      try {
        await loadTemplatePreviewCanvas(canvas, template, {
          zone,
          generatedImageSrc,
          aiJson,
          keyConfigs,
          editable,
        });
        if (cancelled) return;
        setReady(true);
      } catch {
        if (!cancelled) setReady(false);
      }
    })();

    return () => {
      cancelled = true;
      canvas.dispose();
      canvasRef.current = null;
      host.replaceChildren();
    };
  }, [template, zone, generatedImageSrc, aiJson, keyConfigs, cw, ch]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ready) return;
    setCanvasPreviewInteraction(canvas, editable);
    canvas.requestRenderAll();
  }, [editable, ready]);

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "flex w-full justify-center transition-opacity duration-200",
        !ready && "opacity-0",
        className
      )}
    >
      <div
        className="relative shrink-0 overflow-hidden rounded-sm"
        style={{ width: cw * scale, height: ch * scale }}
      >
        <div
          ref={hostRef}
          className={cn(
            "absolute left-0 top-0 origin-top-left",
            !editable && "pointer-events-none"
          )}
          style={{
            width: cw,
            height: ch,
            transform: `scale(${scale})`,
          }}
        />
      </div>
    </div>
  );
});
