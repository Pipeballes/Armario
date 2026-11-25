-- Armario: esquema completo de la base de datos (Supabase / Postgres).
-- Sirve para recrear el proyecto desde cero: pegar en el editor SQL de Supabase y ejecutar.
-- Refleja el estado actual de la base (todas las migraciones aplicadas).
-- No incluye secretos: la clave del recordatorio se carga aparte (ver al final).

-- ───────────────────────── Perfil ─────────────────────────
-- Un perfil por persona, guardado como JSON (subtono, silueta, estilos, calendarios, avatar…).
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "perfil propio: ver" on public.profiles for select to authenticated using (user_id = (select auth.uid()));
create policy "perfil propio: crear" on public.profiles for insert to authenticated with check (user_id = (select auth.uid()));
create policy "perfil propio: editar" on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "perfil propio: borrar" on public.profiles for delete to authenticated using (user_id = (select auth.uid()));

-- ───────────────────────── Prendas ─────────────────────────
create table if not exists public.garments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  category text not null check (
    category = any (array['top', 'bottom', 'dress', 'shoes', 'outerwear', 'accessory', 'pijama', 'interior', 'malla'])
  ),
  -- Tipo dentro de la categoría (remera, jean, calzon, medias…) y texto libre si es "otro".
  kind text,
  kind_detail text,
  color text not null,
  pattern text not null default 'liso' check (pattern = any (array['liso', 'estampado'])),
  styles text[] not null default '{}',
  formality smallint not null check (formality between 1 and 5),
  warmth text not null check (warmth = any (array['light', 'medium', 'warm'])),
  size text,
  sport text,
  -- Cuántas iguales hay (medias, ropa interior y mallas).
  quantity smallint not null default 1 check (quantity between 1 and 99),
  -- Fotos en el bucket "photos": adelante (obligatoria), atrás y etiqueta.
  photo_path text not null,
  photo_back_path text,
  photo_label_path text,
  -- Cómo está la prenda en cada foto (lo calcula la IA) para vestir el avatar 3D.
  fit jsonb,
  created_at timestamptz not null default now(),
  last_worn timestamptz
);
create index if not exists garments_user_id_idx on public.garments (user_id);
alter table public.garments enable row level security;
create policy "prendas propias: ver" on public.garments for select to authenticated using (user_id = (select auth.uid()));
create policy "prendas propias: crear" on public.garments for insert to authenticated with check (user_id = (select auth.uid()));
create policy "prendas propias: editar" on public.garments for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "prendas propias: borrar" on public.garments for delete to authenticated using (user_id = (select auth.uid()));

-- ───────────────────────── Fotos ─────────────────────────
-- Bucket privado: cada persona solo ve su carpeta (photos/<user_id>/...). Las fotos se muestran con links firmados.
insert into storage.buckets (id, name, public) values ('photos', 'photos', false) on conflict (id) do nothing;
create policy "fotos propias: ver" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "fotos propias: subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "fotos propias: editar" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "fotos propias: borrar" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ───────────────────────── Recordatorio a la mañana ─────────────────────────
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table if not exists public.reminders (
  user_id uuid primary key references auth.users (id) on delete cascade,
  enabled boolean not null default true,
  hour smallint not null default 8 check (hour between 0 and 23),
  tz text not null default 'America/Argentina/Buenos_Aires',
  subscription jsonb not null,
  -- Mensaje por fecha local ("YYYY-MM-DD" -> {title, body}); lo calcula la app.
  messages jsonb not null default '{}'::jsonb,
  last_sent date,
  updated_at timestamptz not null default now()
);
alter table public.reminders enable row level security;
create policy "recordatorio propio: ver" on public.reminders for select to authenticated using (user_id = (select auth.uid()));
create policy "recordatorio propio: crear" on public.reminders for insert to authenticated with check (user_id = (select auth.uid()));
create policy "recordatorio propio: editar" on public.reminders for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "recordatorio propio: borrar" on public.reminders for delete to authenticated using (user_id = (select auth.uid()));

-- Cada hora: busca a quién le toca el recordatorio y le pide a la app que mande la notificación.
create or replace function public.enviar_recordatorios()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  payload jsonb;
  ids uuid[];
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'subscription', r.subscription,
           'title', coalesce(r.messages -> to_char(now() at time zone r.tz, 'YYYY-MM-DD') ->> 'title', '☀️ ¡Buen día!'),
           'body', coalesce(r.messages -> to_char(now() at time zone r.tz, 'YYYY-MM-DD') ->> 'body', 'Entrá a ver qué te ponés hoy.')
         )), '[]'::jsonb),
         coalesce(array_agg(r.user_id), '{}')
    into payload, ids
    from public.reminders r
   where r.enabled
     and extract(hour from now() at time zone r.tz)::int = r.hour
     and (r.last_sent is null or r.last_sent < (now() at time zone r.tz)::date);

  if jsonb_array_length(payload) = 0 then
    return;
  end if;

  perform net.http_post(
    url := 'https://armario-black-zeta.vercel.app/api/recordatorio',
    body := jsonb_build_object('items', payload),
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-armario-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'recordatorio_secret')
    ),
    timeout_milliseconds := 20000
  );

  update public.reminders r set last_sent = (now() at time zone r.tz)::date where r.user_id = any(ids);
end;
$$;
revoke all on function public.enviar_recordatorios() from public, anon, authenticated;

select cron.schedule('recordatorios-manana', '0 * * * *', 'select public.enviar_recordatorios()');

-- Clave compartida con la app (la misma que RECORDATORIO_SECRET en Vercel). Cargarla una vez, a mano:
--   select vault.create_secret('<la clave>', 'recordatorio_secret');
