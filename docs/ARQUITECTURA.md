# Cómo está armada por dentro

## Datos

- **`lib/types.ts`**: los tipos de la app. `Garment` (prenda) y `Profile` (perfil) son los centrales.
- **`lib/store.ts`**: el estado compartido entre pantallas (`useArmario`). Sin sesión guarda en el navegador (`lib/db.ts`, IndexedDB); con sesión, en Supabase (`lib/cloud.ts`). Los cambios del perfil se aplican al instante en pantalla y se guardan en orden para que uno no pise a otro.
- **`lib/cloud.ts`**: lee y escribe prendas, perfil y fotos en Supabase. Las fotos se suben al bucket privado `photos/<usuario>/…` y se muestran con links firmados.
- **`supabase/schema.sql`**: el esquema completo (tablas `profiles`, `garments`, `reminders`, reglas RLS, bucket y tarea programada).

## Catálogo y reglas

- **`lib/catalog.ts`**: categorías, tipos de prenda por categoría y por género (`KINDS`, `kindsFor`, `kindLabelFor`), colores, estilos, ocasiones, climas, deportes, talles US de calzado y qué prendas llevan contador de cantidad (`isCountable`).
- **`lib/outfits.ts`**: el armador de outfits por reglas (formalidad de la ocasión, armonía de colores, estampados, estilo, clima, colores que favorecen según el subtono, ropa usada hace poco, deporte, 👍/👎).
- **`lib/planner.ts`**: la semana (un outfit por día sin repetir, días fijados, "otra opción").
- **`lib/shopping.ts`**: qué prenda conviene comprar (prueba básicos "virtuales" y cuenta cuántos outfits buenos nuevos suman).
- **`lib/placard.ts`**: en qué lugar del placard va cada prenda y en qué orden.

## IA

- **`app/api/ia/route.ts`** (servidor): única puerta a Gemini; la clave nunca llega al navegador. Pide sesión de Supabase. Prueba modelos de respaldo si uno está saturado. Tipos de pedido:
  - `prenda`: tipo, color, estampado, estilo, clima, talle, deporte y cantidad, a partir de hasta 3 fotos.
  - `perfil`: subtono, piel, silueta y rasgos para el avatar, a partir de hasta 15 fotos.
  - `elegir`: ordena outfits y explica por qué.
  - `ajuste`: dónde está la prenda en la foto, cuánto está girada, el color de la tela y dónde está el estampado (para el probador).
- **`lib/ai-schema.ts`**: qué se le pide a la IA (prompts y formatos JSON) y cómo se valida lo que responde. Se usa en el servidor y en las pruebas.
- **`lib/ai.ts`**: las llamadas desde el navegador.

## Probador 3D

- **`components/Avatar3D.tsx`**: el avatar y la ropa, con three.js. Todo es geometría simple (esferas, cápsulas y piezas torneadas) con sombreado tipo dibujito.
- **`lib/avatar.ts`**: medidas del cuerpo según el perfil, color de piel, peinados, anteojos, qué prenda va en cada lugar del cuerpo (`slotOf`) y cómo dibujarla (`lookFrom`).
- **`lib/fit.ts`** + **`lib/print-decal.ts`**: la prenda "digitalizada". La IA ubica la prenda y el estampado en la foto (aunque esté torcida); en el navegador se recorta el estampado, se endereza, se le saca la tela de alrededor y se pega como calcomanía sobre la prenda del color de la tela.

## Agenda, clima y recordatorio

- **`app/api/calendario`** + **`lib/agenda.ts`** + **`lib/ics.ts`**: leen los calendarios compartidos por link (solo iCloud, Google y Outlook) y adivinan la ocasión de cada evento.
- **`lib/weather.ts`**: pronóstico de Open-Meteo con la ubicación redondeada (queda solo en el celular).
- **Recordatorio**: la app arma los mensajes de los próximos 7 días (`lib/reminder-sync.ts`, `lib/reminder.ts`) y los guarda en `reminders`. Supabase, cada hora (`pg_cron`), llama a `app/api/recordatorio` con una clave secreta, y esa ruta manda las notificaciones con Web Push. `public/sw.js` las muestra.

## Pruebas

`npm test` corre las pruebas de `src/lib` (vitest): armador de outfits, semana, compras, agenda, clima, IA (validación de respuestas), catálogo, placard, avatar, recordatorio y la calcomanía del estampado. Además, cada cambio de pantalla se prueba con Playwright en un navegador sin ventana (scripts locales, no incluidos en el repo).
