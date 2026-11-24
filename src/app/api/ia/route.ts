// Función del servidor que usa Google Gemini para: reconocer una prenda por foto, analizar fotos
// de la persona y elegir el mejor outfit entre varios. La clave solo vive acá (GEMINI_API_KEY).

import { createClient } from "@supabase/supabase-js";
import {
  CHOOSE_SCHEMA,
  GARMENT_PROMPT,
  GARMENT_SCHEMA,
  PROFILE_PROMPT,
  PROFILE_SCHEMA,
  choosePrompt,
  parseChoice,
  parseGarment,
  parseProfile,
  type ChooseRequest,
} from "@/lib/ai-schema";

const MAX_TOTAL_CHARS = 4_000_000; // Vercel acepta hasta 4.5 MB por pedido
const MAX_PROFILE_PHOTOS = 5;

function fail(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

async function userFromToken(token: string | null): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return null;
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.getUser(token);
  return error ? null : (data.user?.id ?? null);
}

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

/** Llama a Gemini probando modelos de respaldo si uno está saturado. Devuelve el JSON o un error listo para mandar. */
async function askGemini(apiKey: string, parts: Part[], schema: object): Promise<{ data: unknown } | { error: Response }> {
  const payload = JSON.stringify({
    contents: [{ parts }],
    generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.2 },
  });
  const models = [
    ...new Set([process.env.GEMINI_MODEL || "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.6-flash"]),
  ];
  let res: Response | null = null;
  for (const model of models) {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: payload,
    });
    if (res.ok || ![404, 500, 503].includes(res.status)) break;
    console.error("Gemini", model, res.status, (await res.text()).slice(0, 300));
  }
  if (!res) return { error: fail(502, "La IA no respondió. Probá de nuevo.") };
  if (res.status === 429) return { error: fail(429, "Se usó todo el cupo gratis de la IA por ahora. Probá en un rato.") };
  if (!res.ok) {
    console.error("Gemini error", res.status, (await res.text().catch(() => "")).slice(0, 500));
    return { error: fail(502, "La IA no respondió. Probá de nuevo.") };
  }
  const json = await res.json();
  const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  try {
    return { data: text ? JSON.parse(text) : null };
  } catch {
    return { data: null };
  }
}

export async function POST(request: Request) {
  // Se acepta también el nombre con minúsculas, tal como quedó cargado en Vercel.
  const apiKey = process.env.GEMINI_API_KEY || process.env.Gemini_API_Key;
  if (!apiKey) return fail(503, "La IA todavía no está configurada.");

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!(await userFromToken(token))) return fail(401, "Iniciá sesión para usar la IA.");

  let body: { kind?: string; image?: string; images?: string[]; choose?: ChooseRequest };
  try {
    body = await request.json();
  } catch {
    return fail(400, "Pedido inválido.");
  }

  // Elegir el mejor outfit (solo texto, sin fotos).
  if (body.kind === "elegir") {
    const c = body.choose;
    if (!c || !Array.isArray(c.options) || c.options.length < 2 || c.options.length > 8) {
      return fail(400, "Mandá entre 2 y 8 opciones.");
    }
    const r = await askGemini(apiKey, [{ text: choosePrompt(c) }], CHOOSE_SCHEMA);
    if ("error" in r) return r.error;
    const choice = parseChoice(r.data, c.options.map((o) => o.id));
    if (!choice) {
      console.error("Respuesta de elección no válida", JSON.stringify(r.data).slice(0, 300));
      return fail(502, "La IA no pudo decidir. Probá de nuevo.");
    }
    return Response.json(choice);
  }

  if (body.kind !== "prenda" && body.kind !== "perfil") return fail(400, "Tipo de análisis inválido.");
  const raw = Array.isArray(body.images) ? body.images : body.image ? [body.image] : [];
  const max = body.kind === "perfil" ? MAX_PROFILE_PHOTOS : 1;
  if (raw.length === 0 || raw.length > max) return fail(400, `Mandá entre 1 y ${max} fotos.`);
  if (raw.reduce((n, x) => n + (typeof x === "string" ? x.length : 0), 0) > MAX_TOTAL_CHARS) {
    return fail(413, "Las fotos son muy pesadas. Probá con menos fotos.");
  }
  const parts: Part[] = [];
  for (const img of raw) {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(typeof img === "string" ? img : "");
    if (!m) return fail(400, "Alguna de las fotos no es válida.");
    parts.push({ inline_data: { mime_type: m[1], data: m[2] } });
  }

  const isGarment = body.kind === "prenda";
  parts.push({
    text: isGarment
      ? GARMENT_PROMPT
      : parts.length > 1
        ? `${PROFILE_PROMPT}\n\nTe paso ${parts.length} fotos de la MISMA persona, con distintos ángulos y luces. Combiná lo que ves en todas para dar una sola respuesta. Si la luz de alguna cambia el color de la piel, confiá más en las que tienen luz natural.`
        : PROFILE_PROMPT,
  });
  const r = await askGemini(apiKey, parts, isGarment ? GARMENT_SCHEMA : PROFILE_SCHEMA);
  if ("error" in r) return r.error;
  const result = isGarment ? parseGarment(r.data) : parseProfile(r.data);
  if (!result) return fail(502, "La IA no entendió la foto. Probá con otra.");
  return Response.json(result);
}
