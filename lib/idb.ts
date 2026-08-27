import { openDB, type IDBPDatabase } from "idb";
import type { Scene } from "./types";

type SceneRecord = {
  key: string; // `${owner}/${repo}/${path}`
  scene: Scene;
  sha: string;
  updatedAt: number;
};

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB("exgit", 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("scenes")) {
          db.createObjectStore("scenes", { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveScene(key: string, scene: Scene, sha: string) {
  const db = await getDb();
  await db.put("scenes", { key, scene, sha, updatedAt: Date.now() } as SceneRecord);
}

export async function loadScene(key: string): Promise<SceneRecord | undefined> {
  const db = await getDb();
  return (await db.get("scenes", key)) as SceneRecord | undefined;
}

export async function clearScene(key: string) {
  const db = await getDb();
  await db.delete("scenes", key);
}
