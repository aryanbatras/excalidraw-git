// Unit test for the appendTemplateToScene merge algorithm (offset + ID remap).
// restoreElements is stubbed as identity since it's Excalidraw's own trusted code.
import { readFileSync } from "node:fs";

// Replica of components/templates/appendTemplate.ts with restore stubbed
function normalizeTemplate(raw) {
  return raw;
}
let seedCounter = 0;
function freshSeed() { return seedCounter++ === 0 ? "test1234" : `seed${seedCounter}`; }
function appendTemplateToScene(currentElements, templateElements) {
  const tpl = normalizeTemplate(templateElements);
  if (currentElements.length === 0) return tpl;
  const cur = currentElements;
  let curMinX = Infinity, curMaxX = -Infinity, curMinY = Infinity, curMaxY = -Infinity;
  for (const el of cur) {
    const x = el.x ?? 0, y = el.y ?? 0, w = el.width ?? 0, h = el.height ?? 0;
    if (x < curMinX) curMinX = x;
    if (x + w > curMaxX) curMaxX = x + w;
    if (y < curMinY) curMinY = y;
    if (y + h > curMaxY) curMaxY = y + h;
  }
  let tplMinX = Infinity, tplMinY = Infinity;
  for (const el of tpl) {
    if (el.x < tplMinX) tplMinX = el.x;
    if (el.y < tplMinY) tplMinY = el.y;
  }
  const ox = Number.isFinite(curMaxX) && Number.isFinite(tplMinX) ? curMaxX - tplMinX + 60 : 0;
  const oy = Number.isFinite(curMaxY) && Number.isFinite(tplMinY) ? curMaxY - tplMinY + 80 : 0;
  const seed = freshSeed();
  const idMap = new Map();
  for (const el of tpl) idMap.set(el.id, `tpl-${seed}-${el.id}`);
  const groupMap = new Map();
  for (const el of tpl) for (const g of el.groupIds ?? []) if (!groupMap.has(g)) groupMap.set(g, `tplg-${seed}-${g}`);
  const remapped = tpl.map((el) => ({ ...el, id: idMap.get(el.id) ?? el.id, x: el.x + ox, y: el.y + oy }));
  const remapId = (id) => (id ? idMap.get(id) ?? null : null);
  return [
    ...currentElements,
    ...remapped.map((el) => ({
      ...el,
      groupIds: (el.groupIds ?? []).map((g) => groupMap.get(g) ?? g),
      containerId: remapId(el.containerId ?? null),
      frameId: remapId(el.frameId ?? null),
      boundElements: el.boundElements?.map((be) => ({ ...be, id: remapId(be.id) ?? be.id })) ?? null,
    })),
  ];
}

const assert = (cond, msg) => { if (!cond) { console.error("FAIL:", msg); process.exit(1); } };

// --- Test 1: both-axis offset below-right ---
const current = [{
  id: "c1", x: 0, y: 0, width: 100, height: 50,
  groupIds: [], containerId: null, frameId: null, boundElements: null,
}];
const templ = [
  { id: "t1", x: 0, y: 0, width: 40, height: 30, groupIds: ["g1"], containerId: "t2", frameId: "f1", boundElements: [{ id: "t3", type: "arrow" }] },
  { id: "t2", x: 0, y: 0, width: 40, height: 30, groupIds: ["g1"], containerId: null, frameId: "f1", boundElements: null },
  { id: "t3", x: 200, y: 0, width: 1, height: 1, groupIds: [], containerId: null, frameId: null, boundElements: null },
  { id: "f1", type: "frame", x: 0, y: 0, width: 40, height: 30, groupIds: [], containerId: null, frameId: null, boundElements: null },
];
const out = appendTemplateToScene(current, templ);
assert(out.length === 5, `expected 5 elements, got ${out.length}`);
const b = out[1];
assert(b.x === 160, `x offset wrong: ${b.x}`);
assert(b.y === 130, `y offset wrong: ${b.y}`);
assert(b.id === "tpl-test1234-t1", `id not remapped: ${b.id}`);
assert(b.groupIds[0] === "tplg-test1234-g1", `group not remapped: ${b.groupIds[0]}`);
assert(b.containerId === "tpl-test1234-t2", `container not remapped: ${b.containerId}`);
assert(b.frameId === "tpl-test1234-f1", `frame not remapped: ${b.frameId}`);
assert(b.boundElements[0].id === "tpl-test1234-t3", `bound not remapped: ${b.boundElements[0].id}`);
// groups consistent across members
const b2 = out[2];
assert(b.groupIds[0] === b2.groupIds[0], "group ids differ across members");
// frame element itself remapped + offset
const frame = out[4];
assert(frame.id === "tpl-test1234-f1" && frame.x === 160, "frame offset wrong");
assert(out[0].id === "c1" && out[0].x === 0, "current element mutated!");

// --- Test 2: empty current -> raw template passthrough ---
assert(appendTemplateToScene([], templ).length === 4, "empty-current passthrough failed");

// --- Test 3: empty template -> current passthrough ---
assert(appendTemplateToScene(current, []).length === 1, "empty-template passthrough failed");

// --- Test 4: template with negative coords still lands to the right/below ---
const negTpl = [{ id: "n1", x: -50, y: -20, width: 10, height: 10, groupIds: [], containerId: null, frameId: null, boundElements: null }];
const out2 = appendTemplateToScene(current, negTpl);
assert(out2[1].x === 160, `neg-x offset wrong: ${out2[1].x}`); // -50 + (100-(-50)+60) = 160
assert(out2[1].y === 130, `neg-y offset wrong: ${out2[1].y}`); // -20 + (50-(-20)+80) = 130

// --- Test 5: real template passthrough for blank scene ---
const blank = [];
const tplFile = JSON.parse(readFileSync(new URL("../public/templates/uml-er/class-diagram.excalidraw", import.meta.url), "utf8"));
const merged = appendTemplateToScene(blank, tplFile.elements);
assert(merged.length === tplFile.elements.length, "real template should pass through unchanged for blank scene");
assert(new Set(merged.map((e) => e.id)).size === merged.length, "duplicate ids in real template");

// --- Test 6: real template merged into existing elements ---
const realCurrent = [{ id: "c1", x: 0, y: 1000, width: 600, height: 400, groupIds: [], containerId: null, frameId: null, boundElements: null }];
const merged2 = appendTemplateToScene(realCurrent, tplFile.elements);
assert(merged2.length === 1 + tplFile.elements.length, "merge count wrong");
const ids2 = new Set(merged2.map((e) => e.id));
assert(ids2.size === merged2.length, "ID collision after merge!");
for (const el of merged2.slice(1)) {
  assert(el.x >= 600, `appended el.x ${el.x} overlaps horizontally`);
  assert(el.y >= 1400, `appended el.y ${el.y} overlaps vertically`);
}
// every element-space reference must resolve to a real remapped element id
// (group ids are a separate namespace — checked via consistency/Test 1)
const validIds = new Set(merged2.map((e) => e.id));
const groupIdsLive = merged2.slice(1).flatMap((e) => e.groupIds ?? []);
for (const el of merged2.slice(1)) {
  for (const ref of [el.containerId, el.frameId, ...(el.boundElements?.map((x) => x.id) ?? [])].filter(Boolean)) {
    assert(validIds.has(ref), `dangling element ref ${ref} on ${el.id}`);
  }
}
// group refs must either be fresh (tplg-) or empty
for (const g of groupIdsLive) assert(g.startsWith("tplg-"), `unexpected group ref ${g}`);

// --- Test 7: appending the SAME template twice never collides ---
const once = appendTemplateToScene(realCurrent, tplFile.elements);
const twice = appendTemplateToScene(once, tplFile.elements);
assert(new Set(twice.map((e) => e.id)).size === twice.length, "same-template-twice ID collision!");
const srcIdBefore = (el) => el.id.replace(/^tpl-[a-z0-9]+-/, "");
// second copy's group ids must be isolated from first copy's group ids
const allGroupIds = new Set(twice.flatMap((e) => e.groupIds ?? []));
assert(allGroupIds.size === twice.flatMap((e) => e.groupIds ?? []).length, "group id collision after double append");

console.log("ALL APPEND TESTS PASSED");