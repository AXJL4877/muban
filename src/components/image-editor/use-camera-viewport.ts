"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Canvas } from "fabric";

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 20;

export interface CameraState {
  panX: number;
  panY: number;
  zoom: number;
}

function clampZoom(z: number) {
  return Math.min(Math.max(z, MIN_ZOOM), MAX_ZOOM);
}

function applyTransform(el: HTMLElement, camera: CameraState) {
  el.style.transform = `translate(${camera.panX}px, ${camera.panY}px) scale(${camera.zoom})`;
  el.style.transformOrigin = "0 0";
}

/** 将画板适配到工作区视口（仅调整相机，不改变画板/元素尺寸） */
export function fitArtboardInView(
  container: HTMLElement,
  artboardW: number,
  artboardH: number,
  padding = 48
): CameraState {
  const cw = container.clientWidth - padding;
  const ch = container.clientHeight - padding;
  const zoom = clampZoom(Math.min(cw / artboardW, ch / artboardH, 1));
  const panX = (container.clientWidth - artboardW * zoom) / 2;
  const panY = (container.clientHeight - artboardH * zoom) / 2;
  return { panX, panY, zoom };
}

export function useCameraViewport(
  containerRef: React.RefObject<HTMLDivElement | null>,
  viewportRef: React.RefObject<HTMLDivElement | null>,
  fabricCanvas: Canvas | null,
  artboardSize: { width: number; height: number }
) {
  const cameraRef = useRef<CameraState>({ panX: 0, panY: 0, zoom: 1 });
  const isPanningRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });

  const syncTransform = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    applyTransform(viewport, cameraRef.current);
    fabricCanvas?.calcOffset();
  }, [viewportRef, fabricCanvas]);

  const setCamera = useCallback(
    (next: CameraState) => {
      cameraRef.current = {
        panX: next.panX,
        panY: next.panY,
        zoom: clampZoom(next.zoom),
      };
      syncTransform();
    },
    [syncTransform]
  );

  const fitToView = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    setCamera(fitArtboardInView(container, artboardSize.width, artboardSize.height));
  }, [containerRef, artboardSize.width, artboardSize.height, setCamera]);

  useEffect(() => {
    fitToView();
  }, [fitToView]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isPanning = false;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 1) return;
      isPanning = true;
      isPanningRef.current = true;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      container.style.cursor = "grabbing";
      e.preventDefault();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isPanning) return;
      const cam = cameraRef.current;
      cam.panX += e.clientX - lastPointerRef.current.x;
      cam.panY += e.clientY - lastPointerRef.current.y;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      syncTransform();
      e.preventDefault();
    };

    const endPan = () => {
      if (!isPanning) return;
      isPanning = false;
      isPanningRef.current = false;
      container.style.cursor = "";
    };

    const onWheel = (e: WheelEvent) => {
      if (!e.altKey) return;
      e.preventDefault();

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const cam = cameraRef.current;
      const worldX = (mouseX - cam.panX) / cam.zoom;
      const worldY = (mouseY - cam.panY) / cam.zoom;

      const factor = 0.999 ** e.deltaY;
      const newZoom = clampZoom(cam.zoom * factor);

      cam.zoom = newZoom;
      cam.panX = mouseX - worldX * newZoom;
      cam.panY = mouseY - worldY * newZoom;
      syncTransform();
    };

    const preventMiddleScroll = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault();
    };

    container.addEventListener("mousedown", onMouseDown);
    container.addEventListener("mousemove", onMouseMove);
    container.addEventListener("mouseup", endPan);
    container.addEventListener("mouseleave", endPan);
    container.addEventListener("wheel", onWheel, { passive: false });
    container.addEventListener("mousedown", preventMiddleScroll);
    container.addEventListener("auxclick", preventMiddleScroll);
    document.addEventListener("mouseup", endPan);

    return () => {
      container.removeEventListener("mousedown", onMouseDown);
      container.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("mouseup", endPan);
      container.removeEventListener("mouseleave", endPan);
      container.removeEventListener("wheel", onWheel);
      container.removeEventListener("mousedown", preventMiddleScroll);
      container.removeEventListener("auxclick", preventMiddleScroll);
      document.removeEventListener("mouseup", endPan);
    };
  }, [containerRef, syncTransform]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver(() => {
      if (isPanningRef.current) return;
      setCamera(fitArtboardInView(container, artboardSize.width, artboardSize.height));
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [containerRef, artboardSize.width, artboardSize.height, setCamera]);

  return { fitToView, setCamera };
}
