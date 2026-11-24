# Armario

Armario digital con asesor de estilo. Subís fotos de tu ropa, la app la ordena y te arma outfits según la ocasión, el clima, tu tono de piel, tu silueta y tu estilo.

El plan del proyecto está en [docs/PLAN.md](docs/PLAN.md).

## Qué hace hoy
- **Perfil:** subtono y tono de piel, silueta, altura, estilos favoritos y fotos de looks que te inspiran.
- **Armario:** cargás cada prenda con una foto (el color se detecta solo) y etiquetas de tipo, estilo, formalidad y clima. Se puede filtrar por categoría y color.
- **¿Qué me pongo?:** elegís la ocasión y el clima, y te arma 3 outfits con tu ropa explicando por qué funcionan. "Me lo pongo hoy" anota lo que usaste para no repetirlo enseguida.
- **Copia de seguridad:** se descarga y se restaura desde el perfil.

- **Cuenta y nube (opcional):** entrás con un link al mail (sin contraseña) y el armario se guarda en Supabase, así lo ves desde cualquier dispositivo. Lo que cargaste sin cuenta se puede subir con un toque.
- **IA (opcional):** con la sesión iniciada, Google Gemini reconoce cada prenda por la foto y puede analizar una foto tuya para sugerir subtono, tono de piel y silueta.

Sin cuenta, todo queda en el navegador (IndexedDB) y la app funciona igual, sin IA.

## Configuración
Copiá `.env.example` a `.env.local` y completá:
- `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: del proyecto de Supabase (son públicas).
- `GEMINI_API_KEY`: clave gratis de aistudio.google.com/apikey. **Es secreta**: solo va en el servidor (en Vercel, como variable de entorno).

La base de datos tiene dos tablas (`profiles` y `garments`) y un bucket privado `photos`, con reglas para que cada usuario vea solo lo suyo.

## Cómo correrla
```bash
npm install
npm run dev     # http://localhost:3000
npm test        # pruebas del armador de outfits
npm run build   # versión de producción
```
