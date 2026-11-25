# Armario

Armario digital con asesor de estilo. Subís fotos de tu ropa, la app la ordena en un placard digital y te dice qué ponerte según la ocasión, tu agenda, el clima, tu tono de piel, tu silueta y tu estilo. Tiene un probador 3D con un avatar parecido a vos.

- **App publicada:** https://armario-black-zeta.vercel.app (se instala en el celular desde Safari → Compartir → Agregar a inicio).
- **Plan y etapas:** [docs/PLAN.md](docs/PLAN.md) · **Cómo está armada por dentro:** [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)

## Qué hace

| Sección | Qué podés hacer |
|---|---|
| **Inicio** | Atajos a "Armame un outfit" y a la semana, pasos para empezar y el placard en chico. |
| **Armario** | Un placard digital: barral con perchas (abrigos, camisas, vestidos), estantes (arriba y abajo), cajones (ropa interior, medias, pijamas, mallas), organizador de accesorios y zapatero. Filtro por color. |
| **Agregar prenda** | Hasta 3 fotos (adelante, atrás y etiqueta). La IA completa tipo, color, lisa/estampada, estilo, clima, talle (en calzado, talle US) y si es deportiva. Tipos de prenda según el género. Contador "¿cuántas tenés iguales?" para medias y ropa interior. Limpieza automática del fondo. |
| **¿Qué me pongo?** | Outfits para una ocasión (o un evento de tu calendario) con el clima del momento, explicando por qué funcionan. 👍/👎 para que aprenda, "que la IA elija el mejor" y "probar en 3D". |
| **Mi semana** | Un outfit por día según agenda y pronóstico, sin repetir ropa, con días fijados y la lista de ropa para tener lista. |
| **Probador 3D** | Avatar caricatura con tu altura, silueta, piel, peinado, anteojos y expresión. Se viste con tu ropa (color, tipo de prenda y el estampado real recortado de la foto). Vistas de frente, costado, espalda, cara y "cómo te ven". |
| **Perfil** | Género, fotos tuyas analizadas por la IA (subtono, piel, silueta y rasgos del avatar), estilos, inspiración, calendarios (iPhone, Google, feriados), recordatorio a la mañana y copia de seguridad. |

Sin cuenta, todo queda en el navegador (IndexedDB) y la app funciona igual, sin IA. Con cuenta (código de 6 números por mail, sin contraseña) se guarda en la nube y se habilita la IA.

## Herramientas (todo en planes gratis)

- **Next.js 16** (App Router, Cache Components) + **React 19** + **Tailwind 4**, instalable como PWA.
- **Supabase**: cuentas por mail, base de datos Postgres con reglas por usuario (RLS), fotos en un bucket privado, `pg_cron` + `pg_net` para el recordatorio.
- **Google Gemini** (desde el servidor): reconoce prendas, analiza fotos de la persona, elige outfits y ubica la prenda y el estampado en cada foto.
- **three.js** con **@react-three/fiber** y **drei** para el probador 3D.
- **Open-Meteo** (clima), **node-ical** (calendarios), **web-push** (notificaciones).
- **Vercel** para publicar.

## Configuración

1. Copiá `.env.example` a `.env.local` y completá las variables (cada una está explicada ahí).
2. Creá un proyecto de Supabase y ejecutá [`supabase/schema.sql`](supabase/schema.sql) en el editor SQL: crea tablas, reglas de acceso, el bucket de fotos y la tarea del recordatorio.
3. En Vercel cargá las mismas variables. `GEMINI_API_KEY`, `VAPID_PRIVATE_KEY` y `RECORDATORIO_SECRET` son secretas: nunca con `NEXT_PUBLIC_`.

## Cómo correrla

```bash
npm install
npm run dev        # http://localhost:3000
npm run check      # tipos + lint + pruebas
npm test           # solo las pruebas (vitest)
npm run build      # versión de producción
```

## Estructura

```
src/
  app/                 páginas (inicio, armario, outfits, semana, probador, perfil, privacidad)
    api/ia             IA (Gemini): prendas, perfil, elegir outfit y ajuste de fotos
    api/calendario     lee calendarios ICS (iCloud, Google, Outlook)
    api/recordatorio   manda las notificaciones de la mañana (Web Push)
  components/          piezas de pantalla (formulario de prenda, placard, avatar 3D…)
  lib/                 lógica sin pantalla, con pruebas (*.test.ts)
supabase/schema.sql    esquema completo de la base de datos
docs/                  plan y arquitectura
public/sw.js           service worker (sin conexión y notificaciones)
```
