// Regression tests for scene base64 (de)serialization — the REAL library.
// Phase-03 spec: `btoa(JSON.stringify(...))` corrupts non-Latin1 content;
// sceneToBase64/base64ToScene must round-trip UTF-8 losslessly in BOTH the
// node (Buffer) and browser (TextEncoder/TextDecoder/btoa/atob) branches.
import { sceneToBase64, base64ToScene } from "../lib/excalidraw-serialize.ts";

let failures = 0;
function assert(cond, msg) {
  if (cond) {
    console.log(`OK ${msg}`);
  } else {
    failures++;
    console.log(`FAIL ${msg}`);
  }
}

const scenes = [
  { name: "empty", scene: { type: "excalidraw", elements: [] } },
  {
    name: "emoji labels",
    scene: { type: "excalidraw", elements: [{ id: "a", label: { text: "🚀 Fire 🔥 éàü 日本語 👩🏽‍💻" } }] },
  },
  {
    name: "long scene > 0x8000 (multi-chunk)",
    scene: { type: "excalidraw", elements: Array.from({ length: 400 }, (_, i) => ({ id: `e${i}`, x: i, text: `星级元素 numéro ${i} ☂️` })) },
  },
];

for (const { name, scene } of scenes) {
  const json = JSON.stringify(scene);
  console.log(`-- ${name} (${json.length} bytes)`);
  for (const env of ["node", "browser"]) {
    // Flip the library's branch by toggling a global `window`.
    if (env === "browser") globalThis.window = {}; else delete globalThis.window;
    try {
      const b64 = sceneToBase64(scene);
      const back = base64ToScene(b64);
      assert(JSON.stringify(back) === json, `${env}: encode→decode round-trip lossless`);
      if (name === "emoji labels") {
        assert(JSON.stringify(back).includes("🚀") && JSON.stringify(back).includes("日本語"), `${env}: multibyte text preserved`);
      }
    } finally {
      delete globalThis.window;
    }
  }
  // encodings must agree across branches
  globalThis.window = {};
  const b64B = sceneToBase64(scene);
  delete globalThis.window;
  const b64N = sceneToBase64(scene);
  assert(b64B === b64N, "browser and node encodings identical");
}

if (failures > 0) {
  console.error(`\n${failures} FAILURES`);
  process.exit(1);
}
console.log("\nALL SERIALIZE TESTS PASSED");