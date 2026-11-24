// Función del servidor que manda una foto a Google Gemini y devuelve el análisis.
// La clave de Gemini solo vive acá (variable GEMINI_API_KEY), nunca llega al navegador.

import { createClient } from "@supabase/supabase-js";
import {
  GARMENT_PROMPT,
  GARMENT_SCHEMA,
  PROFILE_PROMPT,
  PROFILE_SCHEMA,
  parseGarment,
  parseProfile,
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

export async function POST(request: Request) {
  // Se acepta también el nombre con minúsculas, tal como quedó cargado en Vercel.
  const apiKey = process.env.GEMINI_API_KEY || process.env.Gemini_API_Key;
  if (!apiKey) return fail(503, "La IA todavía no está configurada.");

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!(await userFromToken(token))) return fail(401, "Iniciá sesión para usar la IA.");

  let body: { kind?: string; image?: string; images?: string[] };
  try {
    body = await request.json();
  } catch {
    return fail(400, "Pedido inválido.");
  }
  if (body.kind !== "prenda" && body.kind !== "perfil") return fail(400, "Tipo de análisis inválido.");
  const raw = Array.isArray(body.images) ? body.images : body.image ? [body.image] : [];
  const max = body.kind === "perfil" ? MAX_PROFILE_PHOTOS : 1;
  if (raw.length === 0 || raw.length > max) return fail(400, `Mandá entre 1 y ${max} fotos.`);
  if (raw.reduce((n, x) => n + (typeof x === "string" ? x.length : 0), 0) > MAX_TOTAL_CHARS) {
    return fail(413, "Las fotos son muy pesadas. Probá con menos fotos.");
  }
  const parts: { inline_data: { mime_type: string; data: string } }[] = [];
  for (const img of raw) {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(typeof img === "string" ? img : "");
    if (!m) return fail(400, "Alguna de las fotos no es válida.");
    parts.push({ inline_data: { mime_type: m[1], data: m[2] } });
  }

  const isGarment = body.kind === "prenda";
  const payload = JSON.stringify({
    contents: [
      {
        parts: [
          ...parts,
          {
            text: isGarment
              ? GARMENT_PROMPT
              : parts.length > 1
                ? `${PROFILE_PROMPT}\n\nTe paso ${parts.length} fotos de la MISMA persona, con distintos ángulos y luces. Combiná lo que ves en todas para dar una sola respuesta. Si la luz de alguna cambia el color de la piel, confiá más en las que tienen luz natural.`
                : PROFILE_PROMPT,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: isGarment ? GARMENT_SCHEMA : PROFILE_SCHEMA,
      temperature: 0.2,
    },
  });

  // Se prueba el modelo principal y, si no está disponible, el de respaldo.
  // Si uno está saturado o no disponible para la cuenta, se prueba el siguiente.
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
  if (!res) return fail(502, "La IA no respondió. Probá de nuevo.");

  if (res.status === 429) return fail(429, "Se usó todo el cupo gratis de la IA por ahora. Probá en un rato.");
  if (!res.ok) {
    console.error("Gemini error", res.status, (await res.text().catch(() => "")).slice(0, 500));
    return fail(502, "La IA no respondió. Probá de nuevo.");
  }

  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  const result = isGarment ? parseGarment(parsed) : parseProfile(parsed);
  if (!result) return fail(502, "La IA no entendió la foto. Probá con otra.");
  return Response.json(result);
}
