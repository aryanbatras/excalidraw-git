// Pure scene → SVG renderer used by the live TemplatePreview view.
// Mirrors scripts/generate-thumbs.mjs/logic so the in-dialog preview matches
// the generated 400×300 thumbnails.

const WIDTH = 400;
const HEIGHT = 300;
const MARGIN = 16;
const FONT = "ui-sans-serif, Helvetica, Arial, sans-serif";

type El = Record<string, unknown> & {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  angle?: number;
  type?: string;
  isDeleted?: boolean;
  strokeColor?: string;
  backgroundColor?: string;
  fillStyle?: string;
  strokeStyle?: string;
  strokeWidth?: number;
  opacity?: number;
  roundness?: { type?: number; value?: number };
  points?: Array<[number, number]>;
  text?: string;
  fontSize?: number;
  fontFamily?: number;
  textAlign?: string;
  fontWeight?: string;
  italic?: boolean;
  [k: string]: unknown;
};

function esc(s: unknown): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rgbOf(color: unknown, fallback = "#1e1e1e"): string {
  if (typeof color !== "string") return fallback;
  return color;
}

function hatchPattern(id: string): string {
  return `<pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#000" stroke-opacity="0.14" stroke-width="1.4"/></pattern>`;
}

function strokeProps(el: El, dflt = "#1e1e1e") {
  const stroke = rgbOf(el.strokeColor, dflt);
  const width = Math.max(0.5, el.strokeWidth ?? 1);
  const dash = el.strokeStyle === "dashed" ? "4 3" : undefined;
  const opacity = (el.opacity ?? 100) / 100;
  return {
    stroke,
    "stroke-width": width,
    fill: "none",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    ...(dash ? { "stroke-dasharray": dash } : {}),
    opacity,
  };
}

function attrs(obj: Record<string, unknown>): string {
  return Object.entries(obj)
    .map(([k, v]) => (v === undefined ? "" : `${k}="${esc(v)}"`))
    .join(" ");
}

function transformFor(el: El): string {
  const x = el.x ?? 0;
  const y = el.y ?? 0;
  const width = el.width ?? 0;
  const height = el.height ?? 0;
  const angle = el.angle ?? 0;
  const base = `translate(${x} ${y})`;
  if (!angle) return base;
  const cx = width / 2;
  const cy = height / 2;
  return `${base} rotate(${angle} ${cx} ${cy})`;
}

export function renderElement(el: El): string {
  if (el.isDeleted) return "";
  if (!el.type) return "";
  const t = transformFor(el);
  const isHachure = el.fillStyle === "hachure" || el.fillStyle === "cross-hatch";
  switch (el.type) {
    case "rectangle": {
      const isSolid = el.fillStyle === "solid";
      const hasFill = el.backgroundColor && el.backgroundColor !== "transparent";
      const fill = isHachure ? "url(#hatch)" : hasFill ? el.backgroundColor : "rgba(255,255,255,0)";
      const fillOpacity = isHachure ? 0.9 : isSolid ? 1 : (el.opacity ?? 100) / 100;
      let rx = 0;
      const rt = el.roundness?.type ?? 0;
      if (rt === 3) rx = Math.min(el.width ?? 0, el.height ?? 0) / 2;
      else if (rt === 2) rx = Math.min(el.width ?? 0, el.height ?? 0) / 4;
      const s = { ...strokeProps(el), fill, "fill-opacity": fillOpacity };
      return `<rect ${attrs({ x: 0, y: 0, width: el.width, height: el.height, rx, ...s })} transform="${t}"/>`;
    }
    case "ellipse": {
      const hasFill = el.backgroundColor && el.backgroundColor !== "transparent";
      const fill = isHachure ? "url(#hatch)" : hasFill ? el.backgroundColor : "none";
      const s = { ...strokeProps(el), fill, "fill-opacity": isHachure ? 0.9 : el.fillStyle === "solid" ? 1 : (el.opacity ?? 100) / 100 };
      return `<ellipse ${attrs({ cx: (el.width ?? 0) / 2, cy: (el.height ?? 0) / 2, rx: (el.width ?? 0) / 2, ry: (el.height ?? 0) / 2, ...s })} transform="${t}"/>`;
    }
    case "diamond": {
      const hasFill = el.backgroundColor && el.backgroundColor !== "transparent";
      const fill = isHachure ? "url(#hatch)" : hasFill ? el.backgroundColor : "none";
      const s = { ...strokeProps(el), fill, "fill-opacity": isHachure ? 0.9 : el.fillStyle === "solid" ? 1 : (el.opacity ?? 100) / 100 };
      const w = el.width ?? 0;
      const h = el.height ?? 0;
      const pts = `${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`;
      return `<polygon ${attrs({ points: pts, ...s })} transform="${t}"/>`;
    }
    case "arrow": {
      const pts = (el.points ?? [[0, 0], [el.width ?? 0, el.height ?? 0]]).map(([px, py]) => `${px},${py}`);
      const last = el.points?.[el.points.length - 1] ?? [el.width ?? 0, el.height ?? 0];
      const prev = el.points?.[el.points.length - 2] ?? [0, 0];
      let a0 = Math.atan2((last[1] as number) - (prev[1] as number), (last[0] as number) - (prev[0] as number));
      if (!Number.isFinite(a0)) a0 = Math.atan2(el.height ?? 0, el.width ?? 0);
      if (Number.isNaN(a0)) a0 = 0;
      const ah = 8 + (el.strokeWidth ?? 1) * 2;
      const ba = 0.42;
      const p1 = [last[0] - ah * Math.cos(a0 - ba), last[1] - ah * Math.sin(a0 - ba)];
      const p2 = [last[0] - ah * Math.cos(a0 + ba), last[1] - ah * Math.sin(a0 + ba)];
      const head = `<polygon ${attrs({ points: `${last[0]},${last[1]} ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`, fill: rgbOf(el.strokeColor, "#1e1e1e"), stroke: "none", opacity: (el.opacity ?? 100) / 100 })}/>`;
      const body = `<polyline ${attrs({ points: pts.join(" "), ...strokeProps(el) })}/>`;
      return `<g transform="${t}">${body}${head}</g>`;
    }
    case "line": {
      const pts = (el.points ?? [[0, 0], [el.width ?? 0, el.height ?? 0]]).map(([px, py]) => `${px},${py}`);
      return `<polyline ${attrs({ points: pts.join(" "), ...strokeProps(el) })} transform="${t}"/>`;
    }
    case "freedraw": {
      const pts = (el.points ?? []).map(([px, py]) => `${px},${py}`).join(" ");
      if (!pts) return "";
      return `<polyline ${attrs({ points: pts, ...strokeProps(el), "stroke-linecap": "round" })} transform="${t}"/>`;
    }
    case "text": {
      const fontSize = Math.max(4, el.fontSize ?? 20);
      const color = rgbOf(el.strokeColor, "#1e1e1e");
      const align = el.textAlign ?? "left";
      const anchor = align === "center" ? "middle" : align === "right" ? "end" : "start";
      const lines = String(el.text ?? "").split("\n").filter((l) => l.length);
      const lh = fontSize * 1.25;
      const baseX = align === "center" ? (el.width ?? 0) / 2 : align === "right" ? el.width ?? 0 : 0;
      const startY = (el.height ?? 0) ? ((el.height ?? 0) - lh * lines.length) / 2 + lh * 0.75 : lh * 0.75;
      const tspans = lines
        .map((ln, i) => {
          const y = startY + i * lh;
          const t = ln.length > 46 ? ln.slice(0, 46) + "\u2026" : ln;
          return `<tspan ${attrs({ x: baseX, y })}>${esc(t)}</tspan>`;
        })
        .join("");
      return `<text ${attrs({ "font-size": fontSize, fill: color, "font-family": FONT, "font-weight": el.fontWeight === "bold" ? 700 : 400, "text-anchor": anchor, "dominant-baseline": "central", opacity: (el.opacity ?? 100) / 100, "font-style": el.italic ? "italic" : undefined })} transform="${t}">${tspans}</text>`;
    }
    case "sticky": {
      const fill = el.backgroundColor && el.backgroundColor !== "transparent" ? el.backgroundColor : "#ffec99";
      const s = { ...strokeProps(el), fill, rx: 4 };
      const label = String(el.text ?? "").split("\n").slice(0, 2).join(" ").slice(0, 40);
      return `<g transform="${t}"><rect ${attrs({ x: 0, y: 0, width: el.width, height: el.height, ...s })}/><text x="${(el.width ?? 0) / 2}" y="${(el.height ?? 0) / 2}" font-size="10" fill="${rgbOf(el.strokeColor, "#1e1e1e")}" text-anchor="middle" dominant-baseline="central" font-family="${FONT}">${esc(label)}</text></g>`;
    }
    case "image": {
      return `<rect ${attrs({ x: 0, y: 0, width: el.width, height: el.height, fill: "#e7e7e7", stroke: "#999", "stroke-width": 1, "stroke-dasharray": "3 2", rx: 2 })} transform="${t}"/>`;
    }
    default:
      return "";
  }
}

export function sceneToSvg(
  scene: { elements?: El[] },
  width = WIDTH,
  height = HEIGHT,
  margin = MARGIN,
): string | null {
  const els = (scene.elements ?? []).filter((e) => !e.isDeleted);
  if (els.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const e of els) {
    const x = e.x ?? 0;
    const y = e.y ?? 0;
    const w = e.width ?? 0;
    const h = e.height ?? 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }
  if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) return null;
  const bw = maxX - minX;
  const bh = maxY - minY;
  const scale = Math.min((width - margin * 2) / bw, (height - margin * 2) / bh);
  const dx = (width - bw * scale) / 2 - minX * scale;
  const dy = (height - bh * scale) / 2 - minY * scale;
  const body = els.map((e) => renderElement(e)).join("");
  const wrap = `<g transform="translate(${dx} ${dy}) scale(${scale})">${body}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#ffffff"/>${hatchPattern("hatch")}${wrap}</svg>`;
}