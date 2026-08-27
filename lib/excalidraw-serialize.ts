import type { Scene } from "./types";

export const EXCALIDRAW_SOURCE = "https://github.com/excalidraw-git";

export function emptyScene(): Scene {
  return {
    type: "excalidraw",
    version: 2,
    source: EXCALIDRAW_SOURCE,
    elements: [],
    appState: { viewBackgroundColor: "#ffffff" },
    files: {},
  };
}

// Encode a scene as base64 (UTF-8) for the Git blob API.
export function sceneToBase64(scene: Scene): string {
  const json = JSON.stringify(scene);
  if (typeof window === "undefined") {
    return Buffer.from(json, "utf8").toString("base64");
  }
  // browser
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToScene(b64: string): Scene {
  let json: string;
  if (typeof window === "undefined") {
    json = Buffer.from(b64, "base64").toString("utf8");
  } else {
    json = atob(b64);
  }
  return JSON.parse(json) as Scene;
}
