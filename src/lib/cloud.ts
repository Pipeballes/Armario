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
  photo_back_path: string | null;
  photo_label_path: string | null;
  size: string | null;
  sport: string | null;
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

function rowToGarment(r: GarmentRow, urls: Map<string, string>): Garment {
  return {
    id: r.id,
    photo: urls.get(r.photo_path) ?? "",
    photoBack: r.photo_back_path ? urls.get(r.photo_back_path) : undefined,
    photoLabel: r.photo_label_path ? urls.get(r.photo_label_path) : undefined,
    size: r.size ?? undefined,
    sport: r.sport ?? undefined,
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
        rows.flatMap((r) => [r.photo_path, r.photo_back_path, r.photo_label_path].filter((x): x is string => Boolean(x))),
      );
      return rows.map((r) => rowToGarment(r, urls));
    },

    /** Guarda la prenda. Si la foto es nueva (data URL) la sube y devuelve la prenda con su URL. */
    async saveGarment(g: Garment): Promise<Garment> {
      // Sube la foto si es nueva; si ya estaba en la nube, reusa su ruta.
      const store = async (src: string, suffix: string): Promise<{ path: string; url: string }> => {
        const known = pathBySrc.get(src);
        if (known && !src.startsWith("data:")) return { path: known, url: src };
        const path = `${userId}/${g.id}${suffix}-${Date.now()}.jpg`;
        await upload(sb, path, src);
        return { path, url: (await signAll(sb, [path])).get(path) ?? src };
      };
      const front = await store(g.photo, "");
      const back = g.photoBack ? await store(g.photoBack, "-atras") : null;
      const label = g.photoLabel ? await store(g.photoLabel, "-etiqueta") : null;
      const photoPath = front.path;
      const photo = front.url;
      const { data: old } = await sb
        .from("garments")
        .select("photo_path, photo_back_path, photo_label_path")
        .eq("id", g.id)
        .maybeSingle();
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
        photo_back_path: back?.path ?? null,
        photo_label_path: label?.path ?? null,
        size: g.size?.trim() || null,
        sport: g.sport || null,
        created_at: new Date(g.createdAt).toISOString(),
        last_worn: g.lastWorn ? new Date(g.lastWorn).toISOString() : null,
      });
      if (error) throw error;
      const keep = new Set([photoPath, back?.path, label?.path]);
      const stale = [old?.photo_path, old?.photo_back_path, old?.photo_label_path].filter(
        (x): x is string => Boolean(x) && !keep.has(x!),
      );
      if (stale.length) await sb.storage.from(BUCKET).remove(stale);
      return { ...g, photo, photoBack: back?.url, photoLabel: label?.url };
    },

    async deleteGarment(id: string): Promise<void> {
      const { data } = await sb
        .from("garments")
        .select("photo_path, photo_back_path, photo_label_path")
        .eq("id", id)
        .maybeSingle();
      const { error } = await sb.from("garments").delete().eq("id", id);
      if (error) throw error;
      const files = [data?.photo_path, data?.photo_back_path, data?.photo_label_path].filter((x): x is string => Boolean(x));
      if (files.length) await sb.storage.from(BUCKET).remove(files);
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
      // En la nube las fotos del perfil se guardan como rutas; para mostrar se cambian por URLs firmadas.
      const selfies = stored.selfies ?? [];
      const urls = await signAll(sb, [...stored.inspiration, ...selfies]);
      const show = (list: string[]) => list.map((p) => urls.get(p) ?? "").filter(Boolean);
      return { ...stored, inspiration: show(stored.inspiration), selfies: show(selfies) };
    },

    /** Guarda el perfil subiendo las fotos nuevas (inspiración y fotos tuyas). Devuelve el perfil para mostrar. */
    async saveProfile(p: Profile): Promise<Profile> {
      const store = async (list: string[], prefix: string) => {
        const paths: string[] = [];
        const fresh: string[] = [];
        for (const [i, src] of list.entries()) {
          const known = pathBySrc.get(src);
          if (known && !src.startsWith("data:")) {
            paths.push(known);
          } else {
            const path = `${userId}/${prefix}-${Date.now()}-${i}.jpg`;
            await upload(sb, path, src);
            paths.push(path);
            fresh.push(path);
          }
        }
        const signed = await signAll(sb, fresh);
        return { paths, display: list.map((src, i) => signed.get(paths[i]) ?? src) };
      };
      const insp = await store(p.inspiration, "inspiracion");
      const self = await store(p.selfies ?? [], "yo");

      const { data: old } = await sb.from("profiles").select("data").eq("user_id", userId).maybeSingle();
      const { error } = await sb.from("profiles").upsert({
        user_id: userId,
        data: { ...p, inspiration: insp.paths, selfies: self.paths },
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      const before = (old?.data as Partial<Profile>) ?? {};
      const keep = new Set([...insp.paths, ...self.paths]);
      const removed = [...(before.inspiration ?? []), ...(before.selfies ?? [])].filter((x) => !keep.has(x));
      if (removed.length) await sb.storage.from(BUCKET).remove(removed);
      return { ...p, inspiration: insp.display, selfies: self.display };
    },
  };
}

export type Cloud = ReturnType<typeof createCloud>;
