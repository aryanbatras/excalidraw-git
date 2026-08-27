// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyElement = any;

export function appendTemplateToScene(
  currentElements: readonly AnyElement[],
  templateElements: readonly AnyElement[],
): AnyElement[] {
  if (currentElements.length === 0) return [...templateElements];
  if (templateElements.length === 0) return [...currentElements];

  // Bounding box of current scene
  let curMinX = Infinity, curMaxX = -Infinity;
  for (const el of currentElements) {
    const x1 = el.x;
    const x2 = el.x + (el.width ?? 0);
    if (x1 < curMinX) curMinX = x1;
    if (x2 > curMaxX) curMaxX = x2;
  }

  // Bounding box of template
  let tplMinX = Infinity;
  for (const el of templateElements) {
    if (el.x < tplMinX) tplMinX = el.x;
  }

  // Offset template to the right of current content with a 80px gap
  const offsetX = curMaxX - tplMinX + 80;

  // Generate new IDs to avoid collisions (prefix with "tpl-")
  const idMap = new Map<string, string>();
  const remapped = templateElements.map((el) => {
    const newId = `tpl-${el.id}`;
    idMap.set(el.id, newId);
    return { ...el, id: newId, x: el.x + offsetX };
  });

  // Fix group references and container bindings
  for (const el of remapped) {
    if (el.groupIds?.length) {
      (el as any).groupIds = el.groupIds.map((gid: string) => idMap.get(gid) ?? gid);
    }
    if ((el as any).containerId) {
      (el as any).containerId = idMap.get((el as any).containerId) ?? (el as any).containerId;
    }
    if (el.boundElements?.length) {
      (el as any).boundElements = el.boundElements.map((be: any) => ({
        ...be,
        id: idMap.get(be.id) ?? be.id,
      }));
    }
  }

  return [...currentElements, ...remapped];
}
