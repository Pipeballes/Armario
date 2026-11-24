"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let client: SupabaseClient | null = null;

/**
 * Si se abrió un link del mail que ya se usó o venció, Supabase vuelve a la app con el error
 * en la dirección. Se lee acá, antes de que se limpie, para poder explicárselo al usuario.
 */
export const linkError: string | null = (() => {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search.slice(1));
  const code = params.get("error_code") || params.get("error");
  if (!code) return null;
  window.history.replaceState(null, "", window.location.pathname);
  return /expired|invalid|denied/i.test(code)
    ? "Ese link del mail ya se usó o venció (cada link sirve una sola vez). Pedí un código nuevo abajo."
    : "No se pudo entrar con ese link. Pedí un código nuevo abajo.";
})();

/** Cliente de Supabase, o null si la app no está configurada para la nube. */
export function getSupabase(): SupabaseClient | null {
  if (!url || !key || typeof window === "undefined") return null;
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}

export const cloudEnabled = Boolean(url && key);
