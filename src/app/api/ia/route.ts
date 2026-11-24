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

const MAX_IMAGE_CHARS = 4_000_000; // ~3 MB de imagen en base64

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

  let body: { kind?: string; image?: string };
  try {
    body = await request.json();
  } catch {
    return fail(400, "Pedido inválido.");
  }
  const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(body.image ?? "");
  if (!match || body.image!.length > MAX_IMAGE_CHARS) return fail(400, "La foto no es válida o es muy grande.");
  if (body.kind !== "prenda" && body.kind !== "perfil") return fail(400, "Tipo de análisis inválido.");

  const isGarment = body.kind === "prenda";
  const payload = JSON.stringify({
    contents: [
      {
        parts: [
          { inline_data: { mime_type: match[1], data: match[2] } },
          { text: isGarment ? GARMENT_PROMPT : PROFILE_PROMPT },
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
