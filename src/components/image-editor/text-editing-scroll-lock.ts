/** 进入 Fabric 文字编辑时锁定页面滚动，避免 focus 把 dashboard 的 main 区域猛拉 */

export interface PageScrollSnapshot {
  windowX: number;
  windowY: number;
  scrollables: Array<{ el: Element; top: number; left: number }>;
}

export function capturePageScroll(): PageScrollSnapshot {
  const scrollables: PageScrollSnapshot["scrollables"] = [];

  const maybePush = (el: Element | null | undefined) => {
    if (!el) return;
    scrollables.push({
      el,
      top: el.scrollTop,
      left: el.scrollLeft,
    });
  };

  maybePush(document.documentElement);
  maybePush(document.body);
  document.querySelectorAll("main").forEach((el) => maybePush(el));

  return {
    windowX: window.scrollX,
    windowY: window.scrollY,
    scrollables,
  };
}

export function restorePageScroll(snapshot: PageScrollSnapshot | null) {
  if (!snapshot) return;
  window.scrollTo(snapshot.windowX, snapshot.windowY);
  for (const { el, top, left } of snapshot.scrollables) {
    el.scrollTop = top;
    el.scrollLeft = left;
  }
}

/** Fabric 会多次调用 focus()，统一改为 preventScroll */
export function patchTextareaFocusNoScroll(textarea: HTMLTextAreaElement) {
  const el = textarea as HTMLTextAreaElement & { __fabricFocusPatched?: boolean };
  if (el.__fabricFocusPatched) return;
  el.__fabricFocusPatched = true;

  const nativeFocus = textarea.focus.bind(textarea);
  textarea.focus = (options?: FocusOptions) => {
    nativeFocus({ ...options, preventScroll: true });
  };
}

export function stabilizeFabricTextarea(
  textarea: HTMLTextAreaElement,
  scrollSnapshot: PageScrollSnapshot | null
) {
  patchTextareaFocusNoScroll(textarea);
  textarea.style.scrollMargin = "0";
  textarea.style.scrollPadding = "0";

  textarea.focus({ preventScroll: true });

  const restore = () => restorePageScroll(scrollSnapshot);
  restore();
  requestAnimationFrame(() => {
    restore();
    requestAnimationFrame(restore);
  });
}
