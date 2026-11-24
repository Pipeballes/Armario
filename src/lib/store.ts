"use client";

// Estado compartido entre pantallas: se carga una vez de IndexedDB y avisa los cambios.

import { useSyncExternalStore } from "react";
import { db } from "./db";
import { EMPTY_PROFILE, type Garment, type Profile } from "./types";

interface State {
  ready: boolean;
  garments: Garment[];
  profile: Profile;
  error: string | null;
}

let state: State = { ready: false, garments: [], profile: EMPTY_PROFILE, error: null };
const listeners = new Set<() => void>();
let loading = false;

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function load() {
  if (loading || state.ready) return;
  loading = true;
  Promise.all([db.listGarments(), db.getProfile()])
    .then(([garments, profile]) => set({ ready: true, garments, profile }))
    .catch(() =>
      set({
        ready: true,
        error: "No se pudo abrir el armario guardado. Probá con otro navegador o sin modo incógnito.",
      }),
    );
}

function subscribe(l: () => void) {
  listeners.add(l);
  load();
  return () => listeners.delete(l);
}

const serverState: State = { ready: false, garments: [], profile: EMPTY_PROFILE, error: null };

export function useArmario(): State {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => serverState,
  );
}

export const actions = {
  async saveGarment(g: Garment) {
    await db.saveGarment(g);
    const others = state.garments.filter((x) => x.id !== g.id);
    set({ garments: [g, ...others].sort((a, b) => b.createdAt - a.createdAt) });
  },
  async deleteGarment(id: string) {
    await db.deleteGarment(id);
    set({ garments: state.garments.filter((x) => x.id !== id) });
  },
  async markWorn(ids: string[]) {
    const now = Date.now();
    const updated = state.garments.map((g) => (ids.includes(g.id) ? { ...g, lastWorn: now } : g));
    await Promise.all(updated.filter((g) => ids.includes(g.id)).map((g) => db.saveGarment(g)));
    set({ garments: updated });
  },
  async saveProfile(p: Profile) {
    await db.saveProfile(p);
    set({ profile: p });
  },
  async replaceAll(garments: Garment[], profile: Profile) {
    const merged = { ...EMPTY_PROFILE, ...profile };
    await db.replaceAll(garments, merged);
    set({ garments: [...garments].sort((a, b) => b.createdAt - a.createdAt), profile: merged });
  },
};

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
