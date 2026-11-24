# Armario

Armario digital con asesor de estilo. Subís fotos de tu ropa, la app la ordena y te arma outfits según la ocasión, el clima, tu tono de piel, tu silueta y tu estilo.

El plan del proyecto está en [docs/PLAN.md](docs/PLAN.md).

## Qué hace hoy
- **Perfil:** subtono y tono de piel, silueta, altura, estilos favoritos y fotos de looks que te inspiran.
- **Armario:** cargás cada prenda con una foto (el color se detecta solo) y etiquetas de tipo, estilo, formalidad y clima. Se puede filtrar por categoría y color.
- **¿Qué me pongo?:** elegís la ocasión y el clima, y te arma 3 outfits con tu ropa explicando por qué funcionan. "Me lo pongo hoy" anota lo que usaste para no repetirlo enseguida.
- **Copia de seguridad:** se descarga y se restaura desde el perfil.

Todo se guarda en el navegador (IndexedDB). No usa cuentas, IA ni servidores pagos todavía.

## Cómo correrla
```bash
npm install
npm run dev     # http://localhost:3000
npm test        # pruebas del armador de outfits
npm run build   # versión de producción
```
