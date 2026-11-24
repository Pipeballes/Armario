"use client";

// Guardado en la nube (Supabase): prendas en la tabla "garments", perfil en "profiles"
// y fotos privadas en el bucket "photos", dentro de la carpeta de cada usuario.

import type { SupabaseClient } from "@supabase/supabase-js";
import { EMPTY_PROFILE, type Garment, type Profile } from "./types";

const BUCKET = "photos";
const URL_TTL = 60 * 60 * 6; // 6 horas

interface GarmentRow {
  id: string;
  user_id: string;
  name: string;
  category: Garment["category"];
  color: string;
  pattern: Garment["pattern"];
  styles: Garment["styles"];
  formality: number;
  warmth: Garment["warmth"];
  photo_path: string;
  created_at: string;
  last_worn: string | null;
}

/** Recuerda qué ruta de Storage corresponde a cada URL firmada que se muestra. */
const pathBySrc = new Map<string, string>();

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

async function signAll(sb: SupabaseClient, paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (paths.length === 0) return out;
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(paths, URL_TTL);
  if (error) throw error;
  for (const item of data) {
    if (item.signedUrl && item.path) {
      out.set(item.path, item.signedUrl);
      pathBySrc.set(item.signedUrl, item.path);
    }
  }
  return out;
}

async function upload(sb: SupabaseClient, path: string, dataUrl: string): Promise<void> {
  const { error } = await sb.storage
    .from(BUCKET)
    .upload(path, await dataUrlToBlob(dataUrl), { upsert: true, contentType: "image/jpeg" });
  if (error) throw error;
}

function rowToGarment(r: GarmentRow, photo: string): Garment {
  return {
    id: r.id,
    photo,
    name: r.name,
    category: r.category,
    color: r.color,
    pattern: r.pattern,
    styles: r.styles,
    formality: r.formality,
    warmth: r.warmth,
    createdAt: new Date(r.created_at).getTime(),
    lastWorn: r.last_worn ? new Date(r.last_worn).getTime() : undefined,
  };
}

export function createCloud(sb: SupabaseClient, userId: string) {
  return {
    async listGarments(): Promise<Garment[]> {
      const { data, error } = await sb
        .from("garments")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data as GarmentRow[];
      const urls = await signAll(
        sb,
        rows.map((r) => r.photo_path),
      );
      return rows.map((r) => rowToGarment(r, urls.get(r.photo_path) ?? ""));
    },

    /** Guarda la prenda. Si la foto es nueva (data URL) la sube y devuelve la prenda con su URL. */
    async saveGarment(g: Garment): Promise<Garment> {
      let photoPath = pathBySrc.get(g.photo);
      let photo = g.photo;
      if (g.photo.startsWith("data:") || !photoPath) {
        photoPath = `${userId}/${g.id}-${Date.now()}.jpg`;
        await upload(sb, photoPath, g.photo);
        photo = (await signAll(sb, [photoPath])).get(photoPath) ?? g.photo;
      }
      const { data: old } = await sb.from("garments").select("photo_path").eq("id", g.id).maybeSingle();
      const { error } = await sb.from("garments").upsert({
        id: g.id,
        user_id: userId,
        name: g.name,
        category: g.category,
        color: g.color,
        pattern: g.pattern,
        styles: g.styles,
        formality: g.formality,
        warmth: g.warmth,
        photo_path: photoPath,
        created_at: new Date(g.createdAt).toISOString(),
        last_worn: g.lastWorn ? new Date(g.lastWorn).toISOString() : null,
      });
      if (error) throw error;
      if (old?.photo_path && old.photo_path !== photoPath) {
        await sb.storage.from(BUCKET).remove([old.photo_path]);
      }
      return { ...g, photo };
    },

    async deleteGarment(id: string): Promise<void> {
      const { data } = await sb.from("garments").select("photo_path").eq("id", id).maybeSingle();
      const { error } = await sb.from("garments").delete().eq("id", id);
      if (error) throw error;
      if (data?.photo_path) await sb.storage.from(BUCKET).remove([data.photo_path]);
    },

    async markWorn(ids: string[], when: number): Promise<void> {
      const { error } = await sb
        .from("garments")
        .update({ last_worn: new Date(when).toISOString() })
        .in("id", ids);
      if (error) throw error;
    },

    async getProfile(): Promise<Profile> {
      const { data, error } = await sb.from("profiles").select("data").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      const stored = { ...EMPTY_PROFILE, ...((data?.data as Partial<Profile>) ?? {}) };
      // En la nube "inspiration" guarda rutas; para mostrar se cambian por URLs firmadas.
      const urls = await signAll(sb, stored.inspiration);
      return { ...stored, inspiration: stored.inspiration.map((p) => urls.get(p) ?? "").filter(Boolean) };
    },

    /** Guarda el perfil subiendo las fotos de inspiración nuevas. Devuelve el perfil para mostrar. */
    async saveProfile(p: Profile): Promise<Profile> {
      const paths: string[] = [];
      const shown: string[] = [];
      const newPaths: string[] = [];
      for (const [i, src] of p.inspiration.entries()) {
        const known = pathBySrc.get(src);
        if (known && !src.startsWith("data:")) {
          paths.push(known);
          shown.push(src);
        } else {
          const path = `${userId}/inspiracion-${Date.now()}-${i}.jpg`;
          await upload(sb, path, src);
          paths.push(path);
          newPaths.push(path);
          shown.push(src);
        }
      }
      const signed = await signAll(sb, newPaths);
      const display = shown.map((src, i) => signed.get(paths[i]) ?? src);

      const { data: old } = await sb.from("profiles").select("data").eq("user_id", userId).maybeSingle();
      const { error } = await sb
        .from("profiles")
        .upsert({ user_id: userId, data: { ...p, inspiration: paths }, updated_at: new Date().toISOString() });
      if (error) throw error;
      const removed = ((old?.data as Partial<Profile>)?.inspiration ?? []).filter((x) => !paths.includes(x));
      if (removed.length) await sb.storage.from(BUCKET).remove(removed);
      return { ...p, inspiration: display };
    },
  };
}

export type Cloud = ReturnType<typeof createCloud>;
