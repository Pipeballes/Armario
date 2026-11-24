"use client";

// Notificaciones del celular (Web Push) y el recordatorio guardado en la nube.

import { getSupabase } from "./supabase";
import { DEFAULT_REMINDER_HOUR, type ReminderMessage } from "./reminder";

export interface ReminderRow {
  enabled: boolean;
  hour: number;
  tz: string;
}

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type PushSupport = "ok" | "instalar" | "no";

/** "instalar": en iPhone las notificaciones solo andan con la app agregada a la pantalla de inicio. */
export function pushSupport(): PushSupport {
  if (typeof window === "undefined" || !VAPID) return "no";
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  if (ios && !standalone) return "instalar";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return ios ? "instalar" : "no";
  return "ok";
}

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (!existing) await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

/** Pide permiso y devuelve la suscripción de este celular. */
export async function subscribePush(): Promise<PushSubscriptionJSON> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Bloqueaste las notificaciones. Activalas en Ajustes del celular → Notificaciones → Armario."
        : "Necesito permiso para mandarte notificaciones.",
    );
  }
  const reg = await registration();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID) }));
  return sub.toJSON();
}

export const localTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Argentina/Buenos_Aires";

export async function getReminder(userId: string): Promise<ReminderRow | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from("reminders").select("enabled, hour, tz").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function enableReminder(userId: string, hour = DEFAULT_REMINDER_HOUR): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("La nube no está configurada.");
  const subscription = await subscribePush();
  const { error } = await sb
    .from("reminders")
    .upsert({ user_id: userId, enabled: true, hour, tz: localTz(), subscription, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function updateReminder(userId: string, patch: Partial<ReminderRow>): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb
    .from("reminders")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) throw error;
}

/** Guarda los mensajes de los próximos días (la nube los manda a la hora elegida). */
export async function saveReminderMessages(userId: string, messages: Record<string, ReminderMessage>): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("reminders").update({ messages }).eq("user_id", userId);
  if (error) throw error;
}

/** Manda una notificación de prueba a este celular ahora. */
export async function testReminder(token: string, message: ReminderMessage): Promise<void> {
  const res = await fetch("/api/recordatorio", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ test: message }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "No se pudo mandar la prueba.");
  }
}
