// Manda las notificaciones de la mañana. La llama Supabase cada hora (con la clave secreta)
// o la app para el botón "Probar ahora" (con la sesión de la persona).

import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { sendNotification, setVapidDetails, type PushSubscription } from "web-push";

interface Item {
  subscription: PushSubscription;
  title: string;
  body: string;
}

function fail(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

function sameSecret(a: string | null, b: string | undefined): boolean {
  if (!a || !b) return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const short = (s: unknown, n: number) => (typeof s === "string" ? s.slice(0, n) : "");

function validSubscription(s: unknown): s is PushSubscription {
  const sub = s as PushSubscription | null;
  return Boolean(
    sub &&
      typeof sub.endpoint === "string" &&
      sub.endpoint.startsWith("https://") &&
      typeof sub.keys?.p256dh === "string" &&
      typeof sub.keys?.auth === "string",
  );
}

async function send(items: Item[]): Promise<{ sent: number; gone: number; failed: number }> {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) throw new Error("Faltan las claves de notificaciones.");
  setVapidDetails("https://armario-black-zeta.vercel.app", pub, priv);
  let sent = 0;
  let gone = 0;
  let failed = 0;
  await Promise.all(
    items.map(async (it) => {
      try {
        await sendNotification(
          it.subscription,
          JSON.stringify({ title: short(it.title, 120), body: short(it.body, 240), url: "/outfits" }),
          { TTL: 4 * 3600, urgency: "normal" },
        );
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // 404/410: ese celular ya no acepta notificaciones (se desinstaló o se sacó el permiso).
        if (status === 404 || status === 410) gone++;
        else {
          failed++;
          console.error("push", status, String((e as Error).message).slice(0, 200));
        }
      }
    }),
  );
  return { sent, gone, failed };
}

export async function POST(req: Request) {
  let body: { items?: unknown; test?: { title?: unknown; body?: unknown } };
  try {
    body = await req.json();
  } catch {
    return fail(400, "Pedido inválido.");
  }

  // 1) Envío programado desde Supabase.
  if (req.headers.has("x-armario-secret")) {
    if (!sameSecret(req.headers.get("x-armario-secret"), process.env.RECORDATORIO_SECRET)) return fail(401, "No autorizado.");
    const items = Array.isArray(body.items) ? body.items.slice(0, 500) : [];
    const valid = items.filter((it): it is Item => validSubscription((it as Item)?.subscription));
    try {
      return Response.json(await send(valid));
    } catch (e) {
      return fail(500, (e as Error).message);
    }
  }

  // 2) "Probar ahora": solo a la suscripción guardada de quien lo pide.
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return fail(401, "Entrá con tu mail para probar.");
  const sb = createClient(url, key, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: user, error: userError } = await sb.auth.getUser(token);
  if (userError || !user.user) return fail(401, "Entrá con tu mail para probar.");
  const { data: row } = await sb.from("reminders").select("subscription").eq("user_id", user.user.id).maybeSingle();
  if (!row || !validSubscription(row.subscription)) return fail(404, "Primero activá el recordatorio.");
  try {
    const r = await send([
      {
        subscription: row.subscription,
        title: short(body.test?.title, 120) || "👕 Armario",
        body: short(body.test?.body, 240) || "Así te va a llegar el recordatorio.",
      },
    ]);
    if (r.gone) return fail(410, "Este celular ya no acepta notificaciones. Desactivá y volvé a activar el recordatorio.");
    if (!r.sent) return fail(502, "No se pudo mandar la notificación. Probá de nuevo.");
    return Response.json(r);
  } catch (e) {
    return fail(500, (e as Error).message);
  }
}
