import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { Scene } from "./types";
import { emptyScene } from "./excalidraw-serialize";

export type TemplateId = "blank" | "flowchart" | "timeline" | "gantt";

type Skeleton = Record<string, unknown>;

function buildScene(elements: Skeleton[]): Scene {
  const base = emptyScene();
  base.elements = convertToExcalidrawElements(elements as never) as unknown as Scene["elements"];
  return base;
}

export function buildTemplate(id: TemplateId): Scene {
  switch (id) {
    case "blank":
      return emptyScene();

    case "flowchart":
      return buildScene([
        { type: "rectangle", id: "start", x: 120, y: 80, width: 180, height: 64, label: { text: "Start" }, roundness: { type: 2 }, backgroundColor: "#e7f5ff" },
        { type: "rectangle", id: "proc", x: 120, y: 220, width: 180, height: 64, label: { text: "Process" }, roundness: { type: 2 }, backgroundColor: "#fff4e6" },
        { type: "rectangle", id: "end", x: 120, y: 360, width: 180, height: 64, label: { text: "End" }, roundness: { type: 2 }, backgroundColor: "#ebfbee" },
        { type: "arrow", x: 210, y: 144, width: 0, height: 76, start: { id: "start" }, end: { id: "proc" }, strokeColor: "#495057" },
        { type: "arrow", x: 210, y: 284, width: 0, height: 76, start: { id: "proc" }, end: { id: "end" }, strokeColor: "#495057" },
      ]);

    case "timeline": {
      const x0 = 80;
      const y = 200;
      const ticks = 6;
      const gap = 120;
      const spec: Skeleton[] = [
        { type: "line", x: x0, y, points: [[0, 0], [gap * (ticks - 1), 0]], strokeColor: "#343a40", strokeWidth: 2 },
      ];
      for (let i = 0; i < ticks; i++) {
        const tx = x0 + i * gap;
        spec.push({ type: "line", x: tx, y, points: [[0, -16], [0, 16]], strokeColor: "#343a40" });
        spec.push({ type: "text", x: tx - 24, y: y + 28, text: `Q${i + 1}`, fontSize: 16, strokeColor: "#495057" });
      }
      spec.push({ type: "text", x: x0 - 24, y: y - 60, text: "Timeline", fontSize: 28, strokeColor: "#18181b" });
      return buildScene(spec);
    }

    case "gantt": {
      const x0 = 200;
      const y0 = 80;
      const rowH = 56;
      const bars: Array<[string, number, number]> = [
        ["Research", 0, 3],
        ["Design", 2, 3],
        ["Build", 4, 4],
        ["Ship", 7, 2],
      ];
      const colW = 56;
      const spec: Skeleton[] = [
        { type: "text", x: 20, y: y0 - 40, text: "Gantt", fontSize: 28, strokeColor: "#18181b" },
      ];
      bars.forEach(([label, start, dur], i) => {
        const ry = y0 + i * rowH;
        spec.push({ type: "text", x: 20, y: ry + 8, text: label, fontSize: 16, strokeColor: "#495057" });
        spec.push({
          type: "rectangle",
          x: x0 + start * colW,
          y: ry,
          width: dur * colW,
          height: 36,
          backgroundColor: "#ffd8a8",
          roundness: { type: 2 },
          label: { text: `${dur}w` },
        });
      });
      for (let w = 0; w <= 9; w++) {
        spec.push({ type: "text", x: x0 + w * colW - 8, y: y0 + bars.length * rowH + 8, text: `W${w + 1}`, fontSize: 12, strokeColor: "#868e96" });
      }
      return buildScene(spec);
    }
  }
}
