import { restoreElements } from "@excalidraw/excalidraw";

// Template files are raw exports; restoreElements normalizes them into the full
// element shape Excalidraw expects at runtime (indices, nonces, bindings).
type TplElement = {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  groupIds?: readonly string[];
  containerId?: string | null;
  frameId?: string | null;
  boundElements?: readonly { id: string }[] | null;
};

function normalizeTemplate(raw: readonly unknown[]): TplElement[] {
  return restoreElements(raw as never, null, {
    refreshDimensions: true,
    repairBindings: true,
  }) as unknown as TplElement[];
}

// Fresh random suffix so appending the same template twice (or colliding with
// existing scene ids) can never produce duplicate element/group ids.
function freshSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Merge template elements into the current (live) scene. Existing elements are
// kept as-is; template elements are normalized, remapped to fresh IDs, and
// placed below-right of the current content (60px / 80px gaps) so the two never
// overlap regardless of where each drawing sits on the canvas.
export function appendTemplateToScene(
  currentElements: readonly unknown[],
  templateElements: readonly unknown[],
): unknown[] {
  if (templateElements.length === 0) return [...currentElements];
  const tpl = normalizeTemplate(templateElements);
  if (currentElements.length === 0) return tpl;

  // Bounding box of current (live) scene
  let curMinX = Infinity, curMaxX = -Infinity, curMinY = Infinity, curMaxY = -Infinity;
  for (const el of currentElements as readonly { x?: number; y?: number; width?: number; height?: number }[]) {
    const x = el.x ?? 0;
    const y = el.y ?? 0;
    const w = el.width ?? 0;
    const h = el.height ?? 0;
    if (x < curMinX) curMinX = x;
    if (x + w > curMaxX) curMaxX = x + w;
    if (y < curMinY) curMinY = y;
    if (y + h > curMaxY) curMaxY = y + h;
  }

  // Bounding box of the template
  let tplMinX = Infinity, tplMinY = Infinity;
  for (const el of tpl) {
    if (el.x < tplMinX) tplMinX = el.x;
    if (el.y < tplMinY) tplMinY = el.y;
  }

  const ox = Number.isFinite(curMaxX) && Number.isFinite(tplMinX) ? curMaxX - tplMinX + 60 : 0;
  const oy = Number.isFinite(curMaxY) && Number.isFinite(tplMinY) ? curMaxY - tplMinY + 80 : 0;

  const seed = freshSeed();

  // Element ids AND group ids are separate identifiers: remap both so the copy
  // never merges into a pre-existing group in the live scene.
  const idMap = new Map<string, string>();
  for (const el of tpl) idMap.set(el.id, `tpl-${seed}-${el.id}`);
  const groupMap = new Map<string, string>();
  for (const el of tpl) {
    for (const gid of el.groupIds ?? []) {
      if (!groupMap.has(gid)) groupMap.set(gid, `tplg-${seed}-${gid}`);
    }
  }

  const remapped: unknown[] = tpl.map((el) => ({
    ...el,
    id: idMap.get(el.id) ?? el.id,
    x: el.x + ox,
    y: el.y + oy,
  }));

  const remapId = (id: string | null | undefined): string | null =>
    id ? idMap.get(id) ?? null : null;

  return [
    ...currentElements,
    ...remapped.map((el) => {
      const t = el as TplElement;
      return {
        ...t,
        groupIds: (t.groupIds ?? []).map((gid) => groupMap.get(gid) ?? gid),
        containerId: remapId(t.containerId ?? null),
        frameId: remapId(t.frameId ?? null),
        boundElements: t.boundElements?.map((be) => ({ ...be, id: remapId(be.id) ?? be.id })) ?? null,
      };
    }),
  ];
}