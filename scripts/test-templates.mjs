// Validates the template gallery end-to-end:
//   - every registry entry points at an existing, parseable .excalidraw file
//   - every thumbnail exists, is WebP, and is exactly 400×300
//   - category/tags sanity
//
//   node scripts/test-templates.mjs
//
import { readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const ROOT = join(fileURLToPath(new URL("..", import.meta.url)));
const PUBLIC = join(ROOT, "public");

const { GALLERY_TEMPLATES } = require("../lib/templates/gallery.ts");

const CATEGORIES = [
  "system-design",
  "cloud-arch",
  "uml-er",
  "wireframes",
  "mind-maps",
  "workflows",
  "algorithms",
  "network",
];

let failures = 0;
const fail = (msg) => {
  failures++;
  console.error("FAIL", msg);
};

const fileExists = async (p) => {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
};

const categories = new Set();
for (const t of GALLERY_TEMPLATES) {
  categories.add(t.category);
  if (!CATEGORIES.includes(t.category)) fail(`${t.id}: unknown category ${t.category}`);

  const scenePath = join(PUBLIC, t.file.replace(/^\//, ""));
  if (!(await fileExists(scenePath))) {
    fail(`${t.id}: missing scene file ${t.file}`);
    continue;
  }
  try {
    const scene = JSON.parse(await readFile(scenePath, "utf8"));
    if (!Array.isArray(scene.elements) || scene.elements.length === 0) {
      fail(`${t.id}: scene has no elements`);
    }
  } catch (e) {
    fail(`${t.id}: scene is not valid JSON (${e.message})`);
  }

  const thumbPath = join(PUBLIC, t.thumbnail.replace(/^\//, ""));
  if (!(await fileExists(thumbPath))) {
    fail(`${t.id}: missing thumbnail ${t.thumbnail}`);
    continue;
  }
  try {
    const meta = await sharp(thumbPath).metadata();
    if (meta.format !== "webp") fail(`${t.id}: thumbnail not webp (${meta.format})`);
    if (meta.width !== 400 || meta.height !== 300) {
      fail(`${t.id}: thumbnail is ${meta.width}x${meta.height}, expected 400x300`);
    }
  } catch (e) {
    fail(`${t.id}: thumbnail unreadable (${e.message})`);
  }
}

// every template file must be registered (no orphans)
const { readdir } = await import("node:fs/promises");
for (const cat of CATEGORIES) {
  const dir = join(PUBLIC, "templates", cat);
  let files;
  try {
    files = await readdir(dir);
  } catch {
    fail(`category dir missing: ${cat}`);
    continue;
  }
  const scenes = files.filter((f) => f.endsWith(".excalidraw"));
  const thumbs = files.filter((f) => f.endsWith(".webp"));
  for (const f of scenes) {
    const tpl = GALLERY_TEMPLATES.find((t) => t.file === `/templates/${cat}/${f}`);
    if (!tpl) fail(`unregistered template file: ${cat}/${f}`);
  }
  if (thumbs.length) fail(`unexpected file in scene dir (should live in _thumbs): ${cat}/${thumbs[0]}`);
  if (scenes.length !== GALLERY_TEMPLATES.filter((t) => t.category === cat).length) {
    fail(`category ${cat}: scene count mismatch`);
  }
}

const required = GALLERY_TEMPLATES.length;
const perCatMin = 1;
const notes = [];
for (const cat of CATEGORIES) {
  const n = GALLERY_TEMPLATES.filter((t) => t.category === cat).length;
  if (n < perCatMin) fail(`category ${cat} has ${n} templates (want >= ${perCatMin})`);
  else if (n < 3) notes.push(`${cat} (${n})`);
}
// Spec AC: at least 15 templates across 5+ categories.
if (required < 15) fail(`total templates ${required} < 15 (spec)`);
if (categories.size < 5) fail(`only ${categories.size} categories represented (spec wants 5+)`);
if (notes.length) console.log(`thin categories (still >=1): ${notes.join(", ")}`);

const thumbDir = join(PUBLIC, "templates/_thumbs");
try {
  const cats = await readdir(thumbDir, { withFileTypes: true });
  for (const d of cats) {
    if (!d.isDirectory()) continue;
    const webps = (await readdir(join(thumbDir, d.name))).filter((f) => f.endsWith(".webp"));
    const expected = GALLERY_TEMPLATES.filter((t) => t.category === d.name).length;
    if (webps.length !== expected) fail(`_thumbs/${d.name}: ${webps.length} webp, expected ${expected}`);
  }
} catch (e) {
  fail(`_thumbs unreadable: ${e.message}`);
}

console.log(
  failures
    ? `${failures} template-gallery problem(s)`
    : `OK: ${required} templates across ${categories.size} categories, all scenes valid, all 400x300 thumbs present`,
);
process.exit(failures ? 1 : 0);
