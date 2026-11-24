"use client";

// Estado compartido entre pantallas. Sin sesión, todo se guarda en el navegador (IndexedDB).
// Con sesión iniciada, se guarda en la nube (Supabase).

import { useSyncExternalStore } from "react";
import { createCloud, type Cloud } from "./cloud";
import { db } from "./db";
import { getSupabase } from "./supabase";
import { EMPTY_PROFILE, type Garment, type Profile } from "./types";

export interface Account {
  id: string;
  email: string;
}

interface State {
  ready: boolean;
  garments: Garment[];
  profile: Profile;
  error: string | null;
  account: Account | null;
  /** Prendas guardadas solo en este navegador (para ofrecer subirlas a la nube). */
  localCount: number;
}

const INITIAL: State = {
  ready: false,
  garments: [],
  profile: EMPTY_PROFILE,
  error: null,
  account: null,
  localCount: 0,
};

let state: State = INITIAL;
let cloud: Cloud | null = null;
const listeners = new Set<() => void>();
let started = false;
let loadToken = 0;
let profileQueue: Promise<void> = Promise.resolve();
let pendingSaves = 0;

// Si todavía se está guardando algo (ej: subiendo fotos), el navegador avisa antes de cerrar.
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", (e) => {
    if (pendingSaves > 0) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
}

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

const sortGarments = (gs: Garment[]) => [...gs].sort((a, b) => b.createdAt - a.createdAt);

async function loadFor(account: Account | null) {
  const token = ++loadToken;
  set({ ready: false, error: null, account });
  try {
    const sb = getSupabase();
    if (account && sb) {
      cloud = createCloud(sb, account.id);
      const [garments, profile, local] = await Promise.all([
        cloud.listGarments(),
        cloud.getProfile(),
        db.listGarments().catch(() => []),
      ]);
      if (token !== loadToken) return;
      set({ ready: true, garments, profile, localCount: local.length });
    } else {
      cloud = null;
      const [garments, profile] = await Promise.all([db.listGarments(), db.getProfile()]);
      if (token !== loadToken) return;
      set({ ready: true, garments, profile, localCount: garments.length });
    }
  } catch {
    if (token !== loadToken) return;
    set({
      ready: true,
      error: account
        ? "No se pudo traer tu armario de la nube. Revisá tu conexión y recargá la página."
        : "No se pudo abrir el armario guardado. Probá con otro navegador o sin modo incógnito.",
    });
  }
}

function start() {
  if (started) return;
  started = true;
  const sb = getSupabase();
  if (!sb) {
    loadFor(null);
    return;
  }
  let current: string | null | undefined;
  sb.auth.onAuthStateChange((_event, session) => {
    const user = session?.user ?? null;
    const id = user?.id ?? null;
    if (id === current) return;
    current = id;
    // Diferido: no se debe llamar a Supabase dentro de este callback.
    setTimeout(() => loadFor(user ? { id: user.id, email: user.email ?? "" } : null), 0);
  });
}

function subscribe(l: () => void) {
  listeners.add(l);
  start();
  return () => listeners.delete(l);
}

export function useArmario(): State {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => INITIAL,
  );
}

export const actions = {
  async saveGarment(g: Garment) {
    const saved = cloud ? await cloud.saveGarment(g) : (await db.saveGarment(g), g);
    set({ garments: sortGarments([saved, ...state.garments.filter((x) => x.id !== g.id)]) });
  },
  async deleteGarment(id: string) {
    if (cloud) await cloud.deleteGarment(id);
    else await db.deleteGarment(id);
    set({ garments: state.garments.filter((x) => x.id !== id) });
  },
  async markWorn(ids: string[]) {
    const now = Date.now();
    if (cloud) await cloud.markWorn(ids, now);
    const updated = state.garments.map((g) => (ids.includes(g.id) ? { ...g, lastWorn: now } : g));
    if (!cloud) await Promise.all(updated.filter((g) => ids.includes(g.id)).map((g) => db.saveGarment(g)));
    set({ garments: updated });
  },
  /**
   * Guarda el perfil. La pantalla se actualiza al instante y los guardados se mandan de a uno,
   * en orden, para que un cambio rápido no pise a otro que todavía estaba viajando.
   */
  saveProfile(p: Profile): Promise<void> {
    set({ profile: p });
    pendingSaves++;
    const run = profileQueue.then(async () => {
      const target = cloud;
      const shown = target ? await target.saveProfile(p) : (await db.saveProfile(p), p);
      // Solo se reemplaza si nadie cambió el perfil mientras tanto (fotos nuevas → links firmados).
      if (state.profile === p) set({ profile: shown });
    });
    profileQueue = run.catch(() => {});
    run.finally(() => {
      pendingSaves--;
    }).catch(() => {});
    return run;
  },
  /** Reemplaza todo por una copia de seguridad (en el lugar donde se esté guardando). */
  async replaceAll(garments: Garment[], profile: Profile) {
    const merged = { ...EMPTY_PROFILE, ...profile };
    if (cloud) {
      for (const g of state.garments) await cloud.deleteGarment(g.id);
      const saved: Garment[] = [];
      for (const g of garments) saved.push(await cloud.saveGarment({ ...g, id: ensureUuid(g.id) }));
      const shownProfile = await cloud.saveProfile(merged);
      set({ garments: sortGarments(saved), profile: shownProfile });
    } else {
      await db.replaceAll(garments, merged);
      set({ garments: sortGarments(garments), profile: merged, localCount: garments.length });
    }
  },
  /** Sube a la nube lo guardado en este navegador. Devuelve cuántas prendas subió. */
  async uploadLocal(onProgress?: (done: number, total: number) => void): Promise<number> {
    if (!cloud) throw new Error("Primero iniciá sesión.");
    const [local, localProfile] = await Promise.all([db.listGarments(), db.getProfile()]);
    const existing = new Set(state.garments.map((g) => g.id));
    const pending = local.filter((g) => !existing.has(g.id));
    const saved: Garment[] = [];
    for (const [i, g] of pending.entries()) {
      saved.push(await cloud.saveGarment({ ...g, id: ensureUuid(g.id) }));
      onProgress?.(i + 1, pending.length);
    }
    let profile = state.profile;
    const cloudProfileEmpty = !profile.undertone && !profile.bodyType && profile.styles.length === 0;
    if (cloudProfileEmpty) profile = await cloud.saveProfile(localProfile);
    set({ garments: sortGarments([...saved, ...state.garments]), profile });
    return saved.length;
  },
  async signIn(email: string): Promise<void> {
    const sb = getSupabase();
    if (!sb) throw new Error("La nube no está configurada.");
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + "/perfil" },
    });
    if (error) throw error;
  },
  /** Entra con el código que llegó por mail (sirve en cualquier dispositivo y en la app instalada). */
  async verifyCode(email: string, code: string): Promise<void> {
    const sb = getSupabase();
    if (!sb) throw new Error("La nube no está configurada.");
    const token = code.replace(/\D/g, "");
    // "email" sirve para el mail de entrada; "signup" para el primer mail de confirmación.
    let { error } = await sb.auth.verifyOtp({ email, token, type: "email" });
    if (error) ({ error } = await sb.auth.verifyOtp({ email, token, type: "signup" }));
    if (error) throw error;
  },
  async signOut(): Promise<void> {
    await getSupabase()?.auth.signOut();
  },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function ensureUuid(id: string): string {
  return UUID.test(id) ? id : newId();
}

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
}

/** Token de la sesión para llamar a las funciones del servidor (IA). */
export async function getAccessToken(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}
