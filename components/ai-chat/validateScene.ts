interface SkeletonElement {
  type: string;
  id?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  strokeColor?: string;
  backgroundColor?: string;
  fillStyle?: string;
  strokeWidth?: number;
  roughness?: number;
  opacity?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: number;
  textAlign?: string;
  verticalAlign?: string;
  label?: { text: string };
  points?: number[][];
  start?: { id: string };
  end?: { id: string };
  endArrowhead?: string;
  startArrowhead?: string;
}

interface ParseResult {
  ok: boolean;
  elements?: SkeletonElement[];
  error?: string;
}

function extractJsonFromFences(raw: string): string | null {
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();

  const firstBrace = raw.indexOf("[");
  if (firstBrace !== -1) {
    const lastBracket = raw.lastIndexOf("]");
    if (lastBracket > firstBrace) {
      return raw.slice(firstBrace, lastBracket + 1);
    }
  }

  return null;
}

function isValidElement(el: unknown): el is SkeletonElement {
  if (!el || typeof el !== "object") return false;
  const obj = el as Record<string, unknown>;
  const validTypes = ["rectangle", "ellipse", "diamond", "text", "arrow", "line"];
  if (!validTypes.includes(obj.type as string)) return false;
  if (typeof obj.x !== "number" || typeof obj.y !== "number") return false;
  return true;
}

function normalizeElement(el: SkeletonElement, index: number): SkeletonElement {
  const id = el.id || `el_${index}`;
  const x = el.x ?? 0;
  const y = el.y ?? 0;
  const width = el.width ?? 160;
  const height = el.height ?? 60;

  const base: SkeletonElement = {
    ...el,
    id,
    x,
    y,
    width,
    height,
    strokeColor: el.strokeColor ?? "#1e1e1e",
    backgroundColor: el.backgroundColor ?? "transparent",
    fillStyle: el.fillStyle ?? "solid",
    strokeWidth: el.strokeWidth ?? 2,
    roughness: el.roughness ?? 1,
    opacity: el.opacity ?? 100,
  };

  if (el.label && !el.text) {
    base.text = el.label.text;
    base.fontSize = el.fontSize ?? 20;
    base.fontFamily = el.fontFamily ?? 5;
    base.textAlign = el.textAlign ?? "center";
    base.verticalAlign = el.verticalAlign ?? "middle";
  }

  return base;
}

export function parseAiResponse(raw: string): ParseResult {
  const jsonStr = extractJsonFromFences(raw);
  if (!jsonStr) {
    return { ok: false, error: "No JSON found in the response." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return { ok: false, error: "Invalid JSON in the response." };
  }

  let elements: SkeletonElement[];
  if (Array.isArray(parsed)) {
    elements = parsed;
  } else if (parsed && typeof parsed === "object" && Array.isArray((parsed as Record<string, unknown>).elements)) {
    elements = (parsed as Record<string, unknown>).elements as SkeletonElement[];
  } else {
    return { ok: false, error: "Response is not an array of elements." };
  }

  if (elements.length === 0) {
    return { ok: false, error: "Empty elements array." };
  }

  const invalidIdx = elements.findIndex((el) => !isValidElement(el));
  if (invalidIdx !== -1) {
    return { ok: false, error: `Invalid element at index ${invalidIdx}.` };
  }

  const normalized = elements.map((el, i) => normalizeElement(el, i));
  return { ok: true, elements: normalized };
}
