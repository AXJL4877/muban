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
): CameraState | null {
  if (
    artboardW < 1 ||
    artboardH < 1 ||
    container.clientWidth < 80 ||
    container.clientHeight < 80
  ) {
    return null;
  }

  const cw = Math.max(container.clientWidth - padding, 1);
  const ch = Math.max(container.clientHeight - padding, 1);
  const zoom = clampZoom(Math.min(cw / artboardW, ch / artboardH, 1));
  const panX = (container.clientWidth - artboardW * zoom) / 2;
  const panY = (container.clientHeight - artboardH * zoom) / 2;

  if (!Number.isFinite(zoom) || !Number.isFinite(panX) || !Number.isFinite(panY)) {
    return null;
  }

  return { panX, panY, zoom };
}

interface UseCameraViewportOptions {
  onCameraChange?: () => void;
  /** 返回 true 时冻结相机（如文字编辑中），避免 ResizeObserver 把画板甩出视口 */
  shouldFreezeCamera?: () => boolean;
}

export function useCameraViewport(
  containerRef: React.RefObject<HTMLDivElement | null>,
  viewportRef: React.RefObject<HTMLDivElement | null>,
  fabricCanvas: Canvas | null,
  artboardSize: { width: number; height: number },
  options?: UseCameraViewportOptions
) {
  const cameraRef = useRef<CameraState>({ panX: 0, panY: 0, zoom: 1 });
  const isPanningRef = useRef(false);
  const userAdjustedCameraRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const onCameraChangeRef = useRef(options?.onCameraChange);
  const shouldFreezeCameraRef = useRef(options?.shouldFreezeCamera);
  onCameraChangeRef.current = options?.onCameraChange;
  shouldFreezeCameraRef.current = options?.shouldFreezeCamera;

  const syncTransform = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    applyTransform(viewport, cameraRef.current);
    if (!shouldFreezeCameraRef.current?.()) {
      fabricCanvas?.calcOffset();
      onCameraChangeRef.current?.();
    }
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

  const fitToView = useCallback(
    (opts?: { force?: boolean }) => {
      const container = containerRef.current;
      if (!container) return;
      if (shouldFreezeCameraRef.current?.()) return;
      if (opts?.force) {
        userAdjustedCameraRef.current = false;
      } else if (userAdjustedCameraRef.current) {
        return;
      }
      const next = fitArtboardInView(
        container,
        artboardSize.width,
        artboardSize.height
      );
      if (next) setCamera(next);
    },
    [containerRef, artboardSize.width, artboardSize.height, setCamera]
  );

  useEffect(() => {
    if (shouldFreezeCameraRef.current?.()) return;
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
      userAdjustedCameraRef.current = true;
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
      userAdjustedCameraRef.current = true;
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
      if (
        isPanningRef.current ||
        userAdjustedCameraRef.current ||
        shouldFreezeCameraRef.current?.()
      ) {
        return;
      }
      const next = fitArtboardInView(
        container,
        artboardSize.width,
        artboardSize.height
      );
      if (next) setCamera(next);
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [containerRef, artboardSize.width, artboardSize.height, setCamera]);

  const getCamera = useCallback(() => ({ ...cameraRef.current }), []);

  return { fitToView, setCamera, getCamera };
}
