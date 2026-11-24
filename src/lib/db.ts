// Guardado local en el navegador con IndexedDB (aguanta fotos, a diferencia de localStorage).
// Más adelante se reemplaza o se sincroniza con Supabase.

import { EMPTY_PROFILE, type Garment, type Profile } from "./types";

const DB_NAME = "armario";
const DB_VERSION = 1;
const GARMENTS = "garments";
const KV = "kv";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(GARMENTS)) db.createObjectStore(GARMENTS, { keyPath: "id" });
        if (!db.objectStoreNames.contains(KV)) db.createObjectStore(KV);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error);
      };
    });
  }
  return dbPromise;
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

export const db = {
  async listGarments(): Promise<Garment[]> {
    const all = await run<Garment[]>(GARMENTS, "readonly", (s) => s.getAll());
    return all.sort((a, b) => b.createdAt - a.createdAt);
  },
  saveGarment(g: Garment): Promise<IDBValidKey> {
    return run(GARMENTS, "readwrite", (s) => s.put(g));
  },
  deleteGarment(id: string): Promise<undefined> {
    return run(GARMENTS, "readwrite", (s) => s.delete(id));
  },
  async getProfile(): Promise<Profile> {
    const p = await run<Profile | undefined>(KV, "readonly", (s) => s.get("profile"));
    return { ...EMPTY_PROFILE, ...(p ?? {}) };
  },
  saveProfile(p: Profile): Promise<IDBValidKey> {
    return run(KV, "readwrite", (s) => s.put(p, "profile"));
  },
  async replaceAll(garments: Garment[], profile: Profile): Promise<void> {
    const database = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction([GARMENTS, KV], "readwrite");
      const gs = tx.objectStore(GARMENTS);
      gs.clear();
      garments.forEach((g) => gs.put(g));
      tx.objectStore(KV).put(profile, "profile");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  },
};

export interface Backup {
  app: "armario";
  version: 1;
  exportedAt: string;
  profile: Profile;
  garments: Garment[];
}

export function parseBackup(text: string): Backup {
  const data = JSON.parse(text);
  if (data?.app !== "armario" || !Array.isArray(data.garments) || typeof data.profile !== "object") {
    throw new Error("El archivo no es una copia de Armario.");
  }
  return data as Backup;
}
