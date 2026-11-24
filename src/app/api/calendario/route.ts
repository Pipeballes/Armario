// Lee el calendario del usuario (link .ics de iCloud, Google u Outlook) y devuelve los próximos eventos.

import { createClient } from "@supabase/supabase-js";
import { calendarMeta, normalizeCalendarUrl } from "@/lib/agenda";
import { eventsFromIcs } from "@/lib/ics";

const MAX_BYTES = 3_000_000;
const DAYS = 8;

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
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!(await userFromToken(token))) return fail(401, "Iniciá sesión para conectar tu calendario.");

  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return fail(400, "Pedido inválido.");
  }
  const url = normalizeCalendarUrl(body.url ?? "");
  if (!url) return fail(400, "Ese link no es de un calendario de iPhone (iCloud), Google u Outlook.");

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { accept: "text/calendar, */*" },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch {
    return fail(502, "No pude abrir el calendario. Revisá el link y tu conexión.");
  }
  // Si el link redirige, el destino también tiene que ser un calendario conocido.
  if (!normalizeCalendarUrl(res.url)) return fail(400, "El link llevó a un sitio que no es un calendario.");
  if (res.status >= 400 && res.status < 500) {
    return fail(
      404,
      "Ese link no funciona: puede estar mal copiado o el calendario ya no está compartido. Activá de nuevo «Calendario público» en el iPhone, copiá el link y pegalo otra vez.",
    );
  }
  if (!res.ok) return fail(502, "El calendario no respondió. Probá en un rato.");

  const text = await res.text();
  if (text.length > MAX_BYTES) return fail(413, "El calendario es demasiado grande.");
  if (!text.includes("BEGIN:VCALENDAR")) return fail(400, "Ese link no devolvió un calendario.");

  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + DAYS * 86_400_000);
  try {
    const events = eventsFromIcs(text, from, to).slice(0, 60);
    return Response.json({ events, calendar: calendarMeta(text) });
  } catch (e) {
    console.error("Error leyendo calendario", e);
    return fail(502, "No pude leer ese calendario.");
  }
}
