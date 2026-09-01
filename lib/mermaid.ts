"use client";

import type {
  ExcalidrawElement,
  ExcalidrawGenericElement,
} from "@excalidraw/excalidraw/element/types";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";

// Diagram types the official mermaid-to-excalidraw parser can natively convert to
// geometry. Anything else (e.g. gantt, gitGraph) falls back to a bitmap graphImage.
export const NATIVE_MERMAID_TYPES = [
  "flowchart",
  "graph",
  "flowchart-v2",
  "sequenceDiagram",
  "classDiagram",
  "erDiagram",
  "stateDiagram",
  "stateDiagram-v2",
] as const;

export interface MermaidSceneResult {
  elements: ExcalidrawElement[];
  files?: BinaryFiles;
}

function extractMermaidCodeBlock(text: string): string | null {
  const fenced = text.match(/```(?:mermaid)?\s*\n?([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.startsWith("graph ") || trimmed.startsWith("flowchart") || /Diagram$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

function hasDiagramKeyword(text: string): boolean {
  return (
    /^(graph|flowchart|sequenceDiagram|classDiagram|erDiagram|stateDiagram)/m.test(text.trim())
  );
}

export function extractMermaid(text: string): string | null {
  const block = extractMermaidCodeBlock(text);
  if (block) return block;
  if (hasDiagramKeyword(text)) return text.trim();
  return null;
}

/**
 * Convert a Mermaid definition string into Excalidraw elements.
 *
 * Must be called from the browser only (the mermaid-to-excalidraw parser is DOM-dependent).
 * Dynamically imports the parser to keep it out of the SSR/bundle graph.
 */
export async function mermaidToScene(mermaid: string): Promise<MermaidSceneResult> {
  if (!mermaid || !mermaid.trim()) {
    throw new Error("No Mermaid diagram provided.");
  }

  const { parseMermaidToExcalidraw } = await import("@excalidraw/mermaid-to-excalidraw");
  const { convertToExcalidrawElements } = await import("@excalidraw/excalidraw");

  const result = await parseMermaidToExcalidraw(mermaid, {
    themeVariables: { fontSize: "20px" },
    flowchart: { curve: "linear" },
  });

  const elements = convertToExcalidrawElements(result.elements ?? [], {
    regenerateIds: true,
  }) as ExcalidrawElement[];

  return {
    elements: normalizeMermaidElements(elements),
    files: result.files
      ? ((result.files as unknown) as BinaryFiles)
      : undefined,
  };
}

/**
 * Ensure converted elements are fully valid before they are handed to Excalidraw.
 *
 * The mermaid-to-excalidraw converter can emit:
 *  • Linear elements whose `points` array isn't normalized (points[0] must be
 *    [0,0] and all points must be [number,number] pairs).
 *  • Text elements whose x/y are far from their bound container because the
 *    mermaid layout positions text independently of its container.
 *  • Dangling frame/group/binding references to elements that were dropped.
 *
 * This function deep-clones every element, fixes all of the above, and returns
 * a new array.
 */
function normalizeMermaidElements(elements: ExcalidrawElement[]): ExcalidrawElement[] {
  if (!elements || elements.length === 0) return elements;

  const ids = new Set<string>();
  for (const el of elements) ids.add(el.id);

  // ── Pass 1: clone & fix individual element properties ──────────────────
  const normalized: Record<string, unknown>[] = elements.map((el) => {
    // Deep clone so we never mutate the originals.
    const c = JSON.parse(JSON.stringify(el)) as Record<string, unknown>;

    // ── Linear elements (line / arrow) ───────────────────────────────
    if (el.type === "line" || el.type === "arrow") {
      normalizeLinear(c);
    }

    // ── Text elements ────────────────────────────────────────────────
    if (el.type === "text") {
      normalizeText(c, ids);
    }

    // ── All element types: clean dangling refs ───────────────────────
    cleanDanglingRefs(c, ids);

    return c;
  });

  // ── Pass 2: fix text-in-container positions ────────────────────────────
  fixTextContainerPositions(normalized);

  // ── Pass 3: ensure containers reference their bound texts ──────────────
  ensureContainerTextBindings(normalized);

  return normalized as unknown as ExcalidrawElement[];
}

// ── Helpers ───────────────────────────────────────────────────────────────

function normalizeLinear(c: Record<string, unknown>) {
  let points = c.points as number[][] | undefined;

  // Ensure we have a valid array with ≥ 2 entries of [number, number].
  if (!Array.isArray(points) || points.length < 2) {
    const w = (c.width as number) ?? 0;
    const h = (c.height as number) ?? 0;
    points = [
      [0, 0],
      [w || 100, h || 0],
    ];
  } else {
    points = points.map((p) =>
      Array.isArray(p) && p.length >= 2
        ? [Number(p[0]) || 0, Number(p[1]) || 0]
        : [0, 0],
    );
  }

  // Excalidraw requires points[0] === [0, 0].  Shift all points and
  // compensate by moving the element's origin.
  if (points[0][0] !== 0 || points[0][1] !== 0) {
    const dx = points[0][0];
    const dy = points[0][1];
    points = points.map((p) => [p[0] - dx, p[1] - dy]);
    c.x = (c.x as number) + dx;
    c.y = (c.y as number) + dy;
  }

  c.points = points;
  c.lastCommittedPoint = null;

  // Ensure bindings are proper objects or null (not arrays, not random junk).
  normalizeBinding(c, "startBinding");
  normalizeBinding(c, "endBinding");

  // Arrowheads must be string | null.
  if (typeof c.startArrowhead !== "string") c.startArrowhead = null;
  if (typeof c.endArrowhead !== "string") c.endArrowhead = null;

  // Arrows must have `elbowed`.
  if (c.type === "arrow" && typeof c.elbowed !== "boolean") {
    c.elbowed = false;
  }

  // Elbow arrows need fixedSegments, startIsSpecial, endIsSpecial.
  if (c.type === "arrow" && c.elbowed === true) {
    if (!c.fixedSegments) c.fixedSegments = null;
    if (c.startIsSpecial === undefined) c.startIsSpecial = null;
    if (c.endIsSpecial === undefined) c.endIsSpecial = null;
  }
}

function normalizeBinding(c: Record<string, unknown>, key: string) {
  const b = c[key];
  if (b === null || b === undefined) {
    c[key] = null;
    return;
  }
  // Valid binding: plain object with elementId, focus, gap.
  if (
    typeof b === "object" &&
    !Array.isArray(b) &&
    "elementId" in (b as Record<string, unknown>)
  ) {
    const binding = b as Record<string, unknown>;
    if (typeof binding.focus !== "number") binding.focus = 0;
    if (typeof binding.gap !== "number") binding.gap = 1;
    return;
  }
  // Anything else (array, string, etc.) → null.
  c[key] = null;
}

function normalizeText(c: Record<string, unknown>, ids: Set<string>) {
  // containerId must be string | null and reference an existing element.
  if (c.containerId != null && typeof c.containerId === "string") {
    if (!ids.has(c.containerId)) {
      c.containerId = null;
    }
  } else if (c.containerId !== null) {
    c.containerId = null;
  }
  if (typeof c.originalText !== "string") c.originalText = (c.text as string) ?? "";
  if (typeof c.autoResize !== "boolean") c.autoResize = true;
}

function cleanDanglingRefs(c: Record<string, unknown>, ids: Set<string>) {
  // frameId
  if (typeof c.frameId === "string" && !ids.has(c.frameId)) {
    delete c.frameId;
  }

  // boundElements – keep only entries whose id still exists.
  if (Array.isArray(c.boundElements)) {
    c.boundElements = (c.boundElements as Array<Record<string, unknown>>).filter(
      (b) => typeof b?.id === "string" && ids.has(b.id),
    );
  }

  // groupIds – keep only ids that still exist.
  if (Array.isArray(c.groupIds)) {
    const kept = (c.groupIds as string[]).filter((id) => id && ids.has(id));
    c.groupIds = kept;
  }
}

/**
 * When text is bound to a container, Excalidraw computes the visual position
 * from the container, but the text's own x/y are used when the binding is
 * broken.  The mermaid converter can place text at wildly different x values
 * from the container.  Recalculate so text is centred inside its container.
 */
function fixTextContainerPositions(elements: Record<string, unknown>[]) {
  const byId = new Map<string, Record<string, unknown>>();
  for (const el of elements) {
    if (typeof el.id === "string") byId.set(el.id, el);
  }

  for (const el of elements) {
    if (el.type !== "text") continue;
    const cid = el.containerId as string | null;
    if (!cid) continue;
    const container = byId.get(cid);
    if (!container) continue;

    const cw = (container.width as number) ?? 0;
    const ch = (container.height as number) ?? 0;
    const tw = (el.width as number) ?? 0;
    const th = (el.height as number) ?? 0;
    const cx = (container.x as number) ?? 0;
    const cy = (container.y as number) ?? 0;

    // Centre horizontally; vertically respect textAlign / verticalAlign.
    el.x = cx + (cw - tw) / 2;
    if (el.verticalAlign === "middle") {
      el.y = cy + (ch - th) / 2;
    } else {
      // Top-align with Excalidraw's default container padding (~10 units).
      el.y = cy + 10;
    }
  }
}

/**
 * Ensure every container that has bound text elements references them in its
 * `boundElements` array.  The converter sometimes omits these or the ID set
 * filter in `cleanDanglingRefs` removed them.
 */
function ensureContainerTextBindings(elements: Record<string, unknown>[]) {
  // Map: containerId → [textId, ...]
  const containerTexts = new Map<string, string[]>();
  for (const el of elements) {
    if (el.type !== "text") continue;
    const cid = el.containerId as string | null;
    if (!cid) continue;
    if (!containerTexts.has(cid)) containerTexts.set(cid, []);
    containerTexts.get(cid)!.push(el.id as string);
  }

  for (const el of elements) {
    if (el.type === "text") continue;
    const textIds = containerTexts.get(el.id as string);
    if (!textIds) continue;

    const existing = Array.isArray(el.boundElements)
      ? (el.boundElements as Array<Record<string, unknown>>)
      : [];

    const existingIds = new Set(existing.map((b) => b.id));
    for (const tid of textIds) {
      if (!existingIds.has(tid)) {
        existing.push({ id: tid, type: "text" });
      }
    }
    el.boundElements = existing;
  }
}

/**
 * Append converted elements to the existing canvas, offset to avoid overlap.
 * Returns the element array that should be passed to updateScene.
 */
export function appendSceneElements(
  existing: readonly ExcalidrawElement[],
  incoming: readonly ExcalidrawElement[],
): ExcalidrawElement[] {
  if (!incoming || incoming.length === 0) return [...existing];

  const maxX = existing.reduce((max, el) => {
    const x = (el as ExcalidrawGenericElement).x ?? 0;
    const width = (el as ExcalidrawGenericElement).width ?? 0;
    return Math.max(max, x + width);
  }, 0);

  const offset = existing.length > 0 ? maxX + 60 : 0;

  const offsetElements = incoming.map((el): ExcalidrawElement => {
    const generic = el as ExcalidrawGenericElement;
    return { ...generic, x: generic.x + offset };
  });

  return [...existing, ...offsetElements];
}
