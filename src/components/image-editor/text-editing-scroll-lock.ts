/** 进入 Fabric 文字编辑时锁定页面滚动，避免 focus / textarea 定位把页面猛拉 */

export interface PageScrollSnapshot {
  windowX: number;
  windowY: number;
  scrollables: Array<{ el: Element; top: number; left: number }>;
}

let textareaHostEl: HTMLDivElement | null = null;

/**
 * 固定尺寸宿主：textarea 放在此处不会撑高 document.body，
 * 避免 Fabric 按光标坐标设置 top/left 后触发 main 区域滚动。
 */
export function getFabricTextareaHost(): HTMLDivElement {
  if (typeof document === "undefined") {
    throw new Error("getFabricTextareaHost requires document");
  }
  if (textareaHostEl?.isConnected) return textareaHostEl;

  const existing = document.getElementById("fabric-hidden-textarea-host");
  if (existing instanceof HTMLDivElement) {
    textareaHostEl = existing;
    return existing;
  }

  const host = document.createElement("div");
  host.id = "fabric-hidden-textarea-host";
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = [
    "position:fixed",
    "top:0",
    "left:0",
    "width:0",
    "height:0",
    "overflow:hidden",
    "opacity:0",
    "z-index:-1",
  ].join(";");
  document.body.appendChild(host);
  textareaHostEl = host;
  return host;
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

/** 覆盖 Fabric 对 textarea 的绝对定位，防止撑高页面 */
export function pinFabricTextarea(textarea: HTMLTextAreaElement) {
  textarea.style.position = "absolute";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.width = "1px";
  textarea.style.height = "1px";
  textarea.style.margin = "0";
  textarea.style.padding = "0";
  textarea.style.scrollMargin = "0";
  textarea.style.scrollPadding = "0";
  textarea.style.overflow = "hidden";
}

export function stabilizeFabricTextarea(
  textarea: HTMLTextAreaElement,
  scrollSnapshot: PageScrollSnapshot | null
) {
  pinFabricTextarea(textarea);
  patchTextareaFocusNoScroll(textarea);

  textarea.focus({ preventScroll: true });

  const restore = () => restorePageScroll(scrollSnapshot);
  restore();
  requestAnimationFrame(() => {
    restore();
    requestAnimationFrame(restore);
  });
}

type TextboxWithPin = {
  hiddenTextarea?: HTMLTextAreaElement | null;
  updateTextareaPosition?: () => void;
  __textareaPinPatched?: boolean;
};

/** 在 Fabric 每次更新 textarea 坐标后仍钉在宿主内 */
export function patchTextboxTextareaPin(text: TextboxWithPin) {
  if (text.__textareaPinPatched || typeof text.updateTextareaPosition !== "function") {
    return;
  }
  text.__textareaPinPatched = true;
  const original = text.updateTextareaPosition.bind(text);
  text.updateTextareaPosition = () => {
    original();
    if (text.hiddenTextarea) {
      stabilizeFabricTextarea(text.hiddenTextarea, null);
    }
  };
}
