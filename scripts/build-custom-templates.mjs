// Builds the spec-example templates that were still missing from the gallery
// (sequence diagram, microservices, wireframes, data pipeline, network
// topologies). Constructs valid Excalidraw scenes from primitives so the
// gallery covers every category table hint from phase-02.
//
//   node scripts/build-custom-templates.mjs
//
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = (file) => join(ROOT, "public/templates", file);

let n = 0;
const nextIndex = () => `a${n}`;
function el(type, { x, y, width, height, text }, extra = {}) {
  n++;
  const base = {
    id: `tpl-el-${n}`,
    type,
    x,
    y,
    width,
    height: height ?? (type === "text" ? 20 : 0),
    angle: 0,
    strokeColor: extra.strokeColor ?? "#1e1e1e",
    backgroundColor: extra.backgroundColor ?? "transparent",
    fillStyle: extra.fillStyle ?? "solid",
    strokeWidth: extra.strokeWidth ?? 2,
    strokeStyle: extra.strokeStyle ?? "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    index: nextIndex(),
    seed: 1000 + n * 7919,
    version: 1,
    versionNonce: 100000 + n * 104729,
    isDeleted: false,
    boundElements: [],
  };
  if (type === "text") {
    base.text = text ?? "";
    base.fontSize = extra.fontSize ?? 16;
    base.fontFamily = extra.fontFamily ?? 2;
    base.textAlign = extra.textAlign ?? "center";
    base.verticalAlign = "middle";
    base.baseline = 18;
    base.lineHeight = 1.25;
    base.autoResize = true;
    base.containerId = null;
    base.originalText = base.text;
  }
  if (type === "arrow" || type === "line") {
    base.points = extra.points ?? [[0, 0], [width ?? 0, height ?? 0]];
  }
  return base;
}

const box = (x, y, w, h, label, bg = "#dbe4ff", textColor = "#1e1e1e") => [
  el("rectangle", { x, y, width: w, height: h }, { backgroundColor: bg, fillStyle: "solid" }),
  el("text", { x, y, width: w, height: h, text: label }, { fontSize: 13, strokeColor: textColor }),
];
const diamond = (x, y, w, h, label, bg = "#fff3bf") => [
  el("diamond", { x, y, width: w, height: h }, { backgroundColor: bg, fillStyle: "solid" }),
  el("text", { x, y, width: w, height: h, text: label }, { fontSize: 12 }),
];

function scene(title, elements) {
  return {
    type: "excalidraw",
    version: 2,
    source: "https://excalidraw.com",
    elements,
    appState: { viewBackgroundColor: "#ffffff", gridSize: null },
    files: {},
  };
}

function save(file, s) {
  return mkdir(dirname(OUT(file)), { recursive: true }).then(() =>
    writeFile(OUT(file), JSON.stringify(s, null, 2)),
  );
}

// ---- cloud-arch/microservices ---------------------------------------------
{
  const e = [];
  e.push(...box(20, 40, 150, 36, "API Gateway", "#d6f5d6"));
  const svc = [
    ["Orders", 20, 180, "#cffafe"],
    ["Payments", 210, 180, "#e7d6f9"],
    ["Inventory", 400, 180, "#ffe8cc"],
  ];
  for (const [name, x, y, bg] of svc) e.push(...box(x, y, 170, 40, name, bg));
  e.push(el("arrow", { x: 95, y: 76, width: 0, height: 104 }));
  e.push(el("arrow", { x: 95, y: 76, width: 110, height: 104 }, { points: [[0, 0], [110, 104]] }));
  e.push(el("arrow", { x: 295, y: 76, width: 110, height: 104 }, { points: [[0, 0], [110, 104]] }));
  e.push(el("text", { x: 70, y: 300, width: 300, height: 20, text: "Request flows: Gateway → Services → their state stores" }, { fontSize: 13 }));
  await save("cloud-arch/microservices.excalidraw", scene("microservices", e));
  console.log("cloud-arch/microservices ok");
}

// ---- uml-er/sequence-diagram ----------------------------------------------
{
  const e = [];
  e.push(...box(20, 20, 110, 30, "Client", "#fff3bf"));
  e.push(...box(180, 20, 130, 30, "API Server", "#cffafe"));
  e.push(...box(370, 20, 130, 30, "Database", "#ffe8cc"));
  // lifelines
  e.push(el("line", { x: 75, y: 50, width: 0, height: 170 }, { points: [[0, 0], [0, 170]] }));
  e.push(el("line", { x: 245, y: 50, width: 0, height: 170 }, { points: [[0, 0], [0, 170]] }));
  e.push(el("line", { x: 435, y: 50, width: 0, height: 170 }, { points: [[0, 0], [0, 170]] }));
  // messages
  e.push(el("arrow", { x: 75, y: 80, width: 170, height: 0 }, { points: [[0, 0], [170, 0]] }));
  e.push(el("text", { x: 90, y: 62, width: 140, height: 16, text: "POST /order" }, { fontSize: 11 }));
  e.push(el("arrow", { x: 245, y: 110, width: 190, height: 0 }, { points: [[0, 0], [190, 0]] }));
  e.push(el("text", { x: 260, y: 92, width: 160, height: 16, text: "INSERT order_row" }, { fontSize: 11 }));
  e.push(el("arrow", { x: 245, y: 140, width: 190, height: 0 }, { points: [[0, 0], [190, 0]] }));
  e.push(el("text", { x: 260, y: 122, width: 160, height: 16, text: "row_id + receipt" }, { fontSize: 11 }));
  e.push(el("arrow", { x: 75, y: 170, width: 170, height: 0 }, { points: [[0, 0], [170, 0]] }));
  e.push(el("text", { x: 90, y: 152, width: 140, height: 16, text: "201 Created" }, { fontSize: 11 }));
  await save("uml-er/sequence-diagram.excalidraw", scene("sequence diagram", e));
  console.log("uml-er/sequence-diagram ok");
}

// ---- wireframes/mobile-app -------------------------------------------------
{
  const e = [];
  e.push(el("rectangle", { x: 30, y: 10, width: 200, height: 300 }, { backgroundColor: "#ffffff", strokeColor: "#333" }));
  e.push(el("rectangle", { x: 40, y: 22, width: 180, height: 24 }, { backgroundColor: "#cfe3ff", fillStyle: "solid" }));
  e.push(el("rectangle", { x: 40, y: 56, width: 180, height: 90 }, { backgroundColor: "#e7e7e7", fillStyle: "solid", strokeStyle: "dashed" }));
  e.push(el("text", { x: 60, y: 96, width: 140, height: 16, text: "Hero image" }, { fontSize: 12 }));
  e.push(...box(40, 156, 180, 26, "Primary button", "#6965db"));
  e.push(...box(40, 192, 180, 26, "Secondary action", "#ffffff"));
  for (let i = 0; i < 3; i++) {
    e.push(el("rectangle", { x: 40, y: 228 + i * 24, width: 180, height: 16 }, { backgroundColor: "#eeeeee", fillStyle: "solid" }));
  }
  await save("wireframes/mobile-app.excalidraw", scene("mobile app", e));
  console.log("wireframes/mobile-app ok");
}

// ---- wireframes/dashboard --------------------------------------------------
{
  const e = [];
  e.push(el("rectangle", { x: 10, y: 10, width: 80, height: 280 }, { backgroundColor: "#1b1b1f", fillStyle: "solid" }));
  e.push(el("text", { x: 20, y: 20, width: 60, height: 14, text: "NAV" }, { fontSize: 12, backgroundColor: "#1b1b1f", textColor: "#fff", strokeColor: "#fff" }));
  for (let i = 0; i < 5; i++) e.push(el("rectangle", { x: 20, y: 48 + i * 34, width: 60, height: 20 }, { backgroundColor: "#2b2b31", fillStyle: "solid" }));
  e.push(el("text", { x: 110, y: 16, width: 200, height: 20, text: "Dashboard" }, { fontSize: 16 }));
  // stat cards
  const stats = [["Revenue", "#d6f5d6"], ["Users", "#cffafe"], ["Uptime", "#ffe8cc"]];
  stats.forEach(([label, bg], i) => {
    const x = 110 + i * 100;
    e.push(...box(x, 48, 88, 52, label, bg));
  });
  // chart placeholder
  e.push(el("rectangle", { x: 110, y: 116, width: 190, height: 90 }, { backgroundColor: "#f4f4f6", fillStyle: "solid", strokeStyle: "dashed" }));
  e.push(el("text", { x: 168, y: 152, width: 80, height: 16, text: "Area chart" }, { fontSize: 12 }));
  e.push(el("rectangle", { x: 110, y: 216, width: 190, height: 74 }, { backgroundColor: "#f4f4f6", fillStyle: "solid" }));
  e.push(el("text", { x: 150, y: 244, width: 110, height: 16, text: "Recent activity" }, { fontSize: 12 }));
  await save("wireframes/dashboard.excalidraw", scene("dashboard", e));
  console.log("wireframes/dashboard ok");
}

// ---- workflows/data-pipeline ----------------------------------------------
{
  const e = [];
  const stages = [["Ingest", 20, "#cffafe"], ["Transform", 150, "#d6f5d6"], ["Store", 280, "#fff3bf"], ["Serve", 410, "#e7d6f9"]];
  for (const [name, x, bg] of stages) e.push(...box(x, 20, 100, 44, name, bg));
  e.push(el("arrow", { x: 120, y: 42, width: 30, height: 0 }, { points: [[0, 0], [30, 0]] }));
  e.push(el("arrow", { x: 250, y: 42, width: 30, height: 0 }, { points: [[0, 0], [30, 0]] }));
  e.push(el("arrow", { x: 380, y: 42, width: 30, height: 0 }, { points: [[0, 0], [30, 0]] }));
  // feedback loop
  e.push(el("arrow", { x: 330, y: 64, width: -160, height: 60 }, { points: [[0, 0], [-100, 24], [-160, 60]] }));
  e.push(el("text", { x: 190, y: 118, width: 160, height: 16, text: "re-queue on failure" }, { fontSize: 11 }));
  e.push(el("text", { x: 100, y: 150, width: 260, height: 20, text: "Events stream → lake → serving layer, with retry loop" }, { fontSize: 13 }));
  await save("workflows/data-pipeline.excalidraw", scene("data pipeline", e));
  console.log("workflows/data-pipeline ok");
}

// ---- network/datacenter-topology ------------------------------------------
{
  const e = [];
  e.push(...box(150, 16, 120, 34, "Core", "#d6f5d6"));
  e.push(...box(60, 84, 100, 34, "Agg 1", "#cffafe"));
  e.push(...box(260, 84, 100, 34, "Agg 2", "#cffafe"));
  e.push(el("line", { x: 180, y: 50, width: -20, height: 34 }, { points: [[0, 0], [-20, 34]] }));
  e.push(el("line", { x: 240, y: 50, width: 20, height: 34 }, { points: [[0, 0], [20, 34]] }));
  for (let i = 0; i < 3; i++) {
    e.push(...box(30, 168 + i * 34, 70, 26, `Rack ${i + 1}`, "#ffe8cc"));
    e.push(...box(190, 168 + i * 34, 70, 26, `Rack ${i + 1}`, "#ffe8cc"));
    e.push(el("line", { x: 110, y: 101 + i * 0, width: 10, height: 67 + i * 34 }, { points: [[0, 0], [10, 67 + i * 34]] }));
    e.push(el("line", { x: 230, y: 101 + i * 0, width: 10, height: 67 + i * 34 }, { points: [[0, 0], [10, 67 + i * 34]] }));
  }
  e.push(el("text", { x: 60, y: 300, width: 300, height: 20, text: "Two-aggregation-layer design with per-rack access" }, { fontSize: 13 }));
  await save("network/datacenter-topology.excalidraw", scene("datacenter topology", e));
  console.log("network/datacenter-topology ok");
}

// ---- network/home-office --------------------------------------------------
{
  const e = [];
  e.push(...box(30, 40, 120, 32, "Modem", "#f4f4f6"));
  e.push(...box(180, 40, 120, 32, "Router", "#cffafe"));
  e.push(el("arrow", { x: 150, y: 56, width: 30, height: 0 }, { points: [[0, 0], [30, 0]] }));
  e.push(...box(180, 120, 120, 32, "Laptop", "#d6f5d6"));
  e.push(...box(30, 120, 120, 32, "Printer", "#f4f4f6"));
  e.push(el("line", { x: 240, y: 72, width: 0, height: 48 }, { points: [[0, 0], [0, 48]] }));
  e.push(el("line", { x: 90, y: 72, width: 0, height: 48 }, { points: [[0, 0], [0, 48]] }));
  for (let i = 0; i < 3; i++) e.push(...box(30, 200 + i * 30, 120, 24, `Wi-Fi device ${i + 1}`, "#e7d6f9"));
  e.push(el("text", { x: 60, y: 310, width: 300, height: 20, text: "Cable modest setup with Wi-Fi extension for devices" }, { fontSize: 13 }));
  await save("network/home-office.excalidraw", scene("home office", e));
  console.log("network/home-office ok");
}

console.log("done");
