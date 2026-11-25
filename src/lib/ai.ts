"use client";

import type { GarmentAnalysis, ProfileAnalysis } from "./ai-schema";
import { getAccessToken } from "./store";

export class AiUnavailable extends Error {}

/** Si el servidor dijo que la IA no está configurada, no se vuelve a preguntar en esta sesión. */
let notConfigured = false;

async function call<T>(kind: "prenda" | "perfil" | "ajuste", images: string[], extra: Record<string, unknown> = {}): Promise<T> {
  if (notConfigured) throw new AiUnavailable("La IA todavía no está configurada.");
  const token = await getAccessToken();
  if (!token) throw new AiUnavailable("Iniciá sesión para usar la IA.");
  const res = await fetch("/api/ia", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ kind, images, ...extra }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 503) notConfigured = true;
  if (res.status === 503 || res.status === 401) throw new AiUnavailable(data.error ?? "IA no disponible.");
  if (!res.ok) throw new Error(data.error ?? "La IA no respondió.");
  return data as T;
}

export type GarmentSide = "adelante" | "atrás" | "etiqueta";

/** Analiza una prenda con sus fotos (adelante, atrás y etiqueta, las que haya). */
export const analyzeGarment = (photos: { src: string; side: GarmentSide }[], gender?: string | null) =>
  call<GarmentAnalysis>(
    "prenda",
    photos.map((p) => p.src),
    { sides: photos.map((p) => p.side), gender },
  );
/** Analiza de 1 a 15 fotos de la persona juntas, para no quedarse con una sola impresión. */
export const analyzeProfile = (images: string[], gender?: string | null) =>
  call<ProfileAnalysis>("perfil", images, { gender });

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

/**
 * Dónde está la prenda en la foto, cuánto está girada, el color de la tela y sus detalles (para
 * vestir el avatar). Con la categoría y el tipo, la IA sabe qué detalles buscar.
 */
export const analyzeFit = (image: string, garment?: { category?: string; kind?: string }) =>
  call<import("./types").GarmentFit>("ajuste", [image], { category: garment?.category, garmentKind: garment?.kind });
