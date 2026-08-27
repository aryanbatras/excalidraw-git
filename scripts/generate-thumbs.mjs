// Generates 400x300 WebP thumbnails for every gallery template.
// Renders the template's primitives to SVG (no browser needed), then rasterizes
// with sharp. Mirrors Excalidraw's coordinate model so previews stay faithful.
//
//   node scripts/generate-thumbs.mjs
//
import { readdir, readFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATES_DIR = join(ROOT, "public/templates");

const WIDTH = 400;
const HEIGHT = 300;
const MARGIN = 16;
const FONT = "ui-sans-serif, Helvetica, Arial, sans-serif";

const FONT_STACK = {
  // Excalidraw fontFamily codes folded to a clean sans for previews.
  1: FONT, // hand-drawn
  2: FONT, // normal
  3: FONT, // code (mono-ish; keep sans for consistent previews)
  4: FONT,
  5: FONT,
  6: FONT,
};

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rgbOf(color, fallback = "#1e1e1e") {
  if (typeof color !== "string") return fallback;
  return color === "transparent" ? "transparent" : color;
}

// Hachure hatch rendered via an SVG pattern defined once per file.
function hatchPattern(id) {
  return `<pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#000" stroke-opacity="0.14" stroke-width="1.4"/></pattern>`;
}

function strokeProps(el, dflt = "#1e1e1e") {
  const color = rgbOf(el.strokeColor, dflt);
  const width = Math.max(0.5, el.strokeWidth ?? 1);
  const dash = el.strokeStyle === "dashed" ? "4 3" : undefined;
  const opacity = (el.opacity ?? 100) / 100;
  return {
    stroke: color,
    "stroke-width": width,
    fill: "none",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    ...(dash ? { "stroke-dasharray": dash } : {}),
    opacity,
  };
}

function attrs(obj) {
  return Object.entries(obj)
    .map(([k, v]) => (v === undefined ? "" : `${k}="${esc(v)}"`))
    .join(" ");
}

function transformFor(el) {
  const { x = 0, y = 0, width = 0, height = 0, angle = 0 } = el;
  const base = `translate(${x} ${y})`;
  if (!angle) return base;
  const cx = width / 2;
  const cy = height / 2;
  return `${base} rotate(${angle} ${cx} ${cy})`;
}

function renderElement(el) {
  if (el.isDeleted) return "";
  const t = transformFor(el);
  switch (el.type) {
    case "rectangle": {
      const stroke = rgbOf(el.strokeColor, "#1e1e1e");
      const fill =
        el.backgroundColor && el.backgroundColor !== "transparent"
          ? el.backgroundColor
          : "rgba(255,255,255,0)";
      let rx = 0;
      const rt = el.roundness?.type ?? 0;
      const rw = el.roundness?.value ?? 0;
      if (rt === 3) rx = Math.min(el.width, el.height) / 2;
      else if (rt === 2) rx = Math.min(el.width, el.height) / 4;
      else if (rt === 1) rx = 0;
      const isHachure = el.fillStyle === "hachure" || el.fillStyle === "cross-hatch";
      const fillAttr = isHachure
        ? `url(#hatch)`
        : fill;
      const fillOpacity = isHachure
        ? 0.9
        : el.fillStyle === "solid"
          ? 1
          : el.opacity / 100;
      const s = strokeProps(el);
      s.fill = fillAttr;
      s["fill-opacity"] = fillOpacity;
      return `<rect ${attrs({ x: 0, y: 0, width: el.width, height: el.height, rx, ...s })} transform="${t}"/>`;
    }
    case "ellipse": {
      const s = strokeProps(el);
      const fill =
        el.backgroundColor && el.backgroundColor !== "transparent"
          ? el.backgroundColor
          : "none";
      const isHachure = el.fillStyle === "hachure" || el.fillStyle === "cross-hatch";
      s.fill = isHachure ? "url(#hatch)" : fill;
      s["fill-opacity"] = isHachure ? 0.9 : el.fillStyle === "solid" ? 1 : el.opacity / 100;
      return `<ellipse ${attrs({ cx: el.width / 2, cy: el.height / 2, rx: el.width / 2, ry: el.height / 2, ...s })} transform="${t}"/>`;
    }
    case "diamond": {
      const s = strokeProps(el);
      const fill =
        el.backgroundColor && el.backgroundColor !== "transparent"
          ? el.backgroundColor
          : "none";
      const isHachure = el.fillStyle === "hachure" || el.fillStyle === "cross-hatch";
      s.fill = isHachure ? "url(#hatch)" : fill;
      s["fill-opacity"] = isHachure ? 0.9 : el.fillStyle === "solid" ? 1 : el.opacity / 100;
      const pts = `${el.width / 2},0 ${el.width},${el.height / 2} ${el.width / 2},${el.height} 0,${el.height / 2}`;
      return `<polygon ${attrs({ points: pts, ...s })} transform="${t}"/>`;
    }
    case "arrow": {
      const pts = (el.points ?? [[0, 0], [el.width, el.height]]).map(([px, py]) => `${px},${py}`);
      const last = el.points[el.points.length - 1] ?? [el.width, el.height];
      const prev = el.points[el.points.length - 2] ?? [0, 0];
      let a0 = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
      if (!isFinite(a0)) a0 = Math.atan2(el.height, el.width);
      if (Number.isNaN(a0)) a0 = 0;
      const ah = 8 + (el.strokeWidth ?? 1) * 2;
      const ba = 0.42; // arrowhead half angle (rad)
      const p1 = [last[0] - ah * Math.cos(a0 - ba), last[1] - ah * Math.sin(a0 - ba)];
      const p2 = [last[0] - ah * Math.cos(a0 + ba), last[1] - ah * Math.sin(a0 + ba)];
      const sh = strokeProps(el);
      sh.fill = rgbOf(el.strokeColor, "#1e1e1e");
      const head = `<polygon ${attrs({ points: `${last[0]},${last[1]} ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`, fill: sh.fill, stroke: "none", opacity: sh.opacity })}/>`;
      const body = `<polyline ${attrs({ points: pts.join(" "), ...sh })}/>`;
      return `<g transform="${t}">${body}${head}</g>`;
    }
    case "line": {
      const pts = (el.points ?? [[0, 0], [el.width, el.height]]).map(([px, py]) => `${px},${py}`);
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
      const family = FONT_STACK[el.fontFamily] ?? FONT;
      const align = el.textAlign ?? "left";
      const anchor = align === "center" ? "middle" : align === "right" ? "end" : "start";
      const lines = String(el.text ?? "").split("\n").filter((l) => l.length);
      const lh = fontSize * 1.25;
      const baseX = align === "center" ? el.width / 2 : align === "right" ? el.width : 0;
      const startY = el.height ? (el.height - lh * lines.length) / 2 + lh * 0.75 : lh * 0.75;
      const tspans = lines
        .map((ln, i) => {
          const y = startY + i * lh;
          if (ln.length > 46) ln = ln.slice(0, 46) + "\u2026";
          return `<tspan ${attrs({ x: baseX, y })}>${esc(ln)}</tspan>`;
        })
        .join("");
      return `<text ${attrs({ "font-size": fontSize, fill: color, "font-family": family, "font-weight": el.fontWeight === "bold" ? 700 : 400, "text-anchor": anchor, "dominant-baseline": "central", opacity: (el.opacity ?? 100) / 100, "font-style": el.italic ? "italic" : undefined })} transform="${t}">${tspans}</text>`;
    }
    case "sticky": {
      const s = strokeProps(el);
      const fill =
        el.backgroundColor && el.backgroundColor !== "transparent"
          ? el.backgroundColor
          : "#ffec99";
      s.fill = fill;
      s.rx = 4;
      const label = String(el.text ?? "").split("\n").slice(0, 2).join(" ").slice(0, 40);
      return `<g transform="${t}"><rect ${attrs({ x: 0, y: 0, width: el.width, height: el.height, rx: 4, ...s })}/><text x="${el.width / 2}" y="${el.height / 2}" font-size="10" fill="${el.strokeColor ?? "#1e1e1e"}" text-anchor="middle" dominant-baseline="central" font-family="${FONT}">${esc(label)}</text></g>`;
    }
    case "image": {
      return `<rect ${attrs({ x: 0, y: 0, width: el.width, height: el.height, fill: "#e7e7e7", stroke: "#999", "stroke-width": 1, "stroke-dasharray": "3 2", rx: 2 })} transform="${t}"/>`;
    }
    default:
      return ""; // frame, embeddable, link, selection → skip
  }
}

async function sceneToSvg(scene) {
  const els = (scene.elements ?? []).filter((e) => !e.isDeleted);
  if (els.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const e of els) {
    const { x = 0, y = 0, width = 0, height = 0 } = e;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  }
  if (!isFinite(minX) || maxX <= minX || maxY <= minY) return null;
  const bw = maxX - minX;
  const bh = maxY - minY;
  const scale = Math.min((WIDTH - MARGIN * 2) / bw, (HEIGHT - MARGIN * 2) / bh);
  const dx = (WIDTH - bw * scale) / 2 - minX * scale;
  const dy = (HEIGHT - bh * scale) / 2 - minY * scale;
  const body = els
    .map((e) => renderElement(e))
    .join("");
  const wrap =
    `<g transform="translate(${dx} ${dy}) scale(${scale})">${body}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}"><rect width="${WIDTH}" height="${HEIGHT}" fill="#ffffff"/>${hatchPattern("hatch")}${wrap}</svg>`;
}

async function main() {
  const cats = (await readdir(TEMPLATES_DIR, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name);
  let made = 0;
  let failed = 0;
  for (const cat of cats) {
    const dir = join(TEMPLATES_DIR, cat);
    const files = (await readdir(dir)).filter((f) => f.endsWith(".excalidraw"));
    for (const file of files) {
      const scene = JSON.parse(await readFile(join(dir, file), "utf8"));
      const svg = await sceneToSvg(scene);
      if (!svg) {
        console.warn(`skip (empty scene): ${cat}/${file}`);
        failed++;
        continue;
      }
      const slug = file.replace(/\.excalidraw$/, "");
      const outDir = join(TEMPLATES_DIR, "_thumbs", cat);
      await mkdir(outDir, { recursive: true });
      const buf = await sharp(Buffer.from(svg), { limitInputPixels: 1e7 })
        .resize(WIDTH, HEIGHT, { fit: "fill", kernel: "lanczos3" })
        .webp({ quality: 84 })
        .toBuffer();
      await sharp(buf).toFile(join(outDir, `${slug}.webp`));
      made++;
    }
  }
  console.log(`generated ${made} thumbnails` + (failed ? `, ${failed} skipped` : ""));
}

export { sceneToSvg, renderElement };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
