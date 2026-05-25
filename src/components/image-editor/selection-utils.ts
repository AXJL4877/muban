import { ActiveSelection, type Canvas, type FabricObject } from "fabric";

export function isActiveSelection(
  obj: FabricObject | undefined | null
): obj is ActiveSelection {
  if (!obj) return false;
  return (
    obj instanceof ActiveSelection ||
    obj.type === "ActiveSelection" ||
    obj.type === "activeSelection"
  );
}

/** 获取待删除对象（多选时展开为全部子对象） */
export function getSelectedObjects(canvas: Canvas): FabricObject[] {
  const active = canvas.getActiveObject();
  if (!active) return [];
  if (isActiveSelection(active)) {
    return active.getObjects();
  }
  return [active];
}
