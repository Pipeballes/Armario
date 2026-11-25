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
  - `ajuste`: dónde está la prenda en la foto, cuánto está girada, el color de la tela, dónde está el estampado y sus detalles (botones, capucha, cordón, elástico, franjas, bolsillos, largo, dibujo de la tela, tipo de tira del calzado), para el probador. Se le dice qué prenda es para que sepa qué buscar.
- **`lib/ai-schema.ts`**: qué se le pide a la IA (prompts y formatos JSON) y cómo se valida lo que responde. Se usa en el servidor y en las pruebas.
- **`lib/ai.ts`**: las llamadas desde el navegador.

## Probador 3D

El avatar se arma con geometría propia (sin modelos externos) para que cargue rápido en el celular, con sombreado tipo dibujito.

- **`lib/skeleton.ts`** (lógica pura, con pruebas): las proporciones. El torso es una lista de cortes ovalados (de la entrepierna al cuello) y brazos y piernas tienen sus articulaciones y su curva de grosor. También:
  - **Brazos**: cuelgan al costado y se abren lo justo para no atravesar la panza ni la cadera, según el cuerpo y la ropa (`armRoom`: un abrigo grueso los separa más).
  - **Articulaciones**: cada bola (hombro, codo, muñeca, cadera, rodilla, tobillo) es un poco más grande que la boca de los tubos que llegan a ella (`jointBalls`), así nunca queda una ranura por la que se vea el interior. La ropa usa las mismas bolas, con el mismo centro y la holgura de la tela.
  - **Ropa**: cada prenda es el cuerpo "inflado" (nunca más finita que la piel) y las capas se respetan: el pantalón, arriba la remera y arriba el abrigo; cada una envuelve a las de abajo, incluidos los muslos (`layerOver`, `legsEnvelope`).
- **`components/avatar/`**: el dibujo.
  - `shapes.ts`: tubos de corte ovalado y piezas torneadas con normales suaves, y parches que se apoyan sobre la tela (bolsillos, tiras, franjas, logos).
  - `Body.tsx` (piel: torso, brazos, manos con sus cinco dedos, piernas y pies) y `Head.tsx` (cara, 17 peinados, anteojos).
  - La ropa, un archivo por grupo: `Tops.tsx` (remera, camisa con tira de botones y bolsillo, chomba, escote en V, hoodie con cordones, musculosa, vestido), `Bottoms.tsx` (cintura con presillas o elástica con cordón, bragueta, bolsillos de jean o cargo, franjas, logo en la pierna), `Outer.tsx` (campera, de jean, de cuero, polar, rompevientos, saco, tapado, inflable, poncho), `Shoes.tsx` (cerrados, abiertos arriba como chatitas y tacos, y abiertos como ojotas, chanclas y sandalias, donde se ven los dedos) y `Accessories.tsx` (todos los accesorios).
  - `parts.tsx` (mangas, bordes, botones, calcomanía del estampado) y `materials.tsx` (sombreado y dibujos de la tela: rayas, cuadros, lunares, flores, camuflado).
- **`components/Avatar3D.tsx`**: la escena (luces, piso, cámara) y el armado del avatar con la ropa puesta. El lado izquierdo del cuerpo es el espejo del derecho.
- **`lib/avatar.ts`**: medidas del cuerpo según el perfil, color de piel, peinados, anteojos y qué prenda va en cada lugar del cuerpo (`slotOf`).
- **`lib/look.ts`**: cómo se ve cada prenda (`lookFrom`). Cada tipo tiene sus detalles de siempre aunque la foto no los muestre (una camisa lleva cuello, tira de botones y puños; un short deportivo, cintura elástica y cordón; una ojota, la tira entre los dedos). Encima va lo que vio la IA: el color real de la tela, el dibujo, el estampado y otros detalles.
- **`lib/fit.ts`** + **`lib/print-decal.ts`**: la prenda "digitalizada". La IA ubica la prenda y el estampado en la foto (aunque esté torcida); en el navegador se recorta el estampado, se endereza, se le saca la tela de alrededor y se pega como calcomanía sobre la prenda del color de la tela.
  - Si la prenda es estampada pero la IA no marcó dónde (o no hay IA), se mira la foto (`analyzePhotoPrint`): se endereza la prenda, se separa la tela del dibujo (sin contar el borde ni el fondo conectado al borde de la foto) y se decide si es un estampado suelto (se recorta y se pega donde está) o un dibujo por toda la tela (aparece en casi toda la prenda: se usa un pedazo de la tela real, repetido en espejo). Nunca se inventan rayas.

## Agenda, clima y recordatorio

- **`app/api/calendario`** + **`lib/agenda.ts`** + **`lib/ics.ts`**: leen los calendarios compartidos por link (solo iCloud, Google y Outlook) y adivinan la ocasión de cada evento.
- **`lib/weather.ts`**: pronóstico de Open-Meteo con la ubicación redondeada (queda solo en el celular).
- **Recordatorio**: la app arma los mensajes de los próximos 7 días (`lib/reminder-sync.ts`, `lib/reminder.ts`) y los guarda en `reminders`. Supabase, cada hora (`pg_cron`), llama a `app/api/recordatorio` con una clave secreta, y esa ruta manda las notificaciones con Web Push. `public/sw.js` las muestra.

## Pruebas

`npm test` corre las pruebas de `src/lib` (vitest): armador de outfits, semana, compras, agenda, clima, IA (validación de respuestas), catálogo, placard, avatar, esqueleto 3D (proporciones, articulaciones, brazos, capas de ropa, tiras), recordatorio y la calcomanía del estampado. Además, cada cambio de pantalla se prueba con Playwright en un navegador sin ventana (scripts locales, no incluidos en el repo).
