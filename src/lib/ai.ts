"use client";

import type { GarmentAnalysis, ProfileAnalysis } from "./ai-schema";
import { getAccessToken } from "./store";

export class AiUnavailable extends Error {}

/** Si el servidor dijo que la IA no está configurada, no se vuelve a preguntar en esta sesión. */
let notConfigured = false;

async function call<T>(kind: "prenda" | "perfil", images: string[]): Promise<T> {
  if (notConfigured) throw new AiUnavailable("La IA todavía no está configurada.");
  const token = await getAccessToken();
  if (!token) throw new AiUnavailable("Iniciá sesión para usar la IA.");
  const res = await fetch("/api/ia", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ kind, images }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 503) notConfigured = true;
  if (res.status === 503 || res.status === 401) throw new AiUnavailable(data.error ?? "IA no disponible.");
  if (!res.ok) throw new Error(data.error ?? "La IA no respondió.");
  return data as T;
}

export const analyzeGarment = (image: string) => call<GarmentAnalysis>("prenda", [image]);
/** Analiza de 1 a 5 fotos de la persona juntas, para no quedarse con una sola impresión. */
export const analyzeProfile = (images: string[]) => call<ProfileAnalysis>("perfil", images);

/** Le pide a la IA que ordene los outfits de mejor a peor y explique la elección. */
export async function chooseOutfit(choose: import("./ai-schema").ChooseRequest): Promise<import("./ai-schema").ChoiceResult> {
  if (notConfigured) throw new AiUnavailable("La IA todavía no está configurada.");
  const token = await getAccessToken();
  if (!token) throw new AiUnavailable("Iniciá sesión para usar la IA.");
  const res = await fetch("/api/ia", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ kind: "elegir", choose }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 503) notConfigured = true;
  if (res.status === 503 || res.status === 401) throw new AiUnavailable(data.error ?? "IA no disponible.");
  if (!res.ok) throw new Error(data.error ?? "La IA no respondió.");
  return data;
}
