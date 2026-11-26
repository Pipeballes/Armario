# Armario: plan del proyecto

## La idea
Un armario digital con asesor de estilo. Subís fotos de tu ropa, la app la ordena y te dice qué ponerte en cada ocasión según tu cuerpo, tu tono de piel y tu estilo. También te deja planificar el día o la semana para tener la ropa lista.

Primero es para uso personal. Se construye pensando en que más adelante la usen otras personas (cada una con su cuenta), así no hay que rehacerla.

## Regla principal: costo cero al empezar
- No se paga nada hasta decidir si se vende.
- La IA se conecta como una pieza que se puede cambiar: hoy una opción gratis, mañana Claude si conviene.
- La app tiene que funcionar también **sin IA**: con carga manual de etiquetas y reglas de combinación de colores.

## Herramientas
| Parte | Herramienta | Costo |
|---|---|---|
| Web instalable en el celular (PWA) | Next.js | Gratis |
| Publicación | Vercel (plan gratis) | Gratis |
| Cuentas, base de datos y fotos | Supabase (plan gratis) | Gratis |
| IA para analizar fotos | Google Gemini (plan gratis) para empezar; Claude más adelante | Gratis / por uso |

> Nota: la suscripción de Claude (el chat) **no** incluye uso de la API, así que la app no la puede usar. Por eso se arranca con el plan gratis de Gemini.
>
> Nota de privacidad: en el plan gratis, Google puede usar lo que se envía para mejorar sus productos. Para las fotos del cuerpo se puede elegir no usar IA y cargar los datos a mano.

## Etapas

### Etapa 1: Perfil
- Subir 1 o 2 fotos propias (opcional) para que la IA sugiera tipo de cuerpo, tono de piel y paleta de colores.
- Alternativa sin IA: un cuestionario corto (tono de piel, tipo de cuerpo, altura).
- Elegir estilos que gustan y subir fotos de looks de inspiración.

### Etapa 2: Armario
- Foto de cada prenda. La IA detecta tipo, color, estilo y formalidad (o se cargan a mano).
- Vista por categorías: partes de arriba, de abajo, calzado, abrigos y accesorios.
- Filtros por color, estilo y ocasión.

### Etapa 3: "¿Qué me pongo?"
- Elegir la ocasión: trabajo, cita, casual, salida de noche, evento formal, deporte.
- La app arma de 2 a 3 outfits **con la ropa propia** y explica por qué combinan y por qué te quedan bien.

### Etapa 4: Planificador y mejoras ✅
- [x] Planificar la semana: un outfit por día según agenda y clima, sin repetir, con días fijados y la lista de ropa para tener lista.
- [x] Tener en cuenta el clima (automático).
- [x] Marcar 👍 / 👎 para que aprenda.
- [x] Sugerir qué prenda conviene comprar para sumar combinaciones.
- [x] Que la IA elija el mejor outfit y explique por qué.
- [x] Fondo limpio en las fotos de ropa.
- [x] Avatar con anteojos, más peinados y expresiones.
- [x] Política de privacidad.

## Próximos pasos
1. [x] Base de la app: estructura, diseño y armario guardado en el navegador (sin cuentas todavía).
2. [x] Carga de prendas con etiquetas manuales y motor de outfits por reglas.
3. [x] Conectar Supabase (cuentas y fotos en la nube).
4. [x] Conectar la IA gratis (Gemini) para clasificar fotos y analizar el perfil.
5. [x] Publicar en Vercel e instalarla en el celular.

## Hecho además
- [x] Conexión con varios calendarios del iPhone (iCloud) o de Google por link compartido, cada uno con su nombre y color: en "¿Qué me pongo?" aparecen los próximos eventos y se arma el outfit para cada uno.
- [x] Clima automático con Open-Meteo (ubicación del celular o ciudad), para ahora o para la hora del evento, con aviso de lluvia.
- [x] Probador 3D: avatar tipo maniquí con altura, silueta y tono de piel del perfil; se viste con la ropa del armario (colores y tipo de prenda); vistas de frente, costado, espalda y "cómo te ven" (otra persona a unos 2 m); se gira con el dedo.
- [x] Entrada con código de 6 números por mail (enviado desde Gmail como "Armario").
- [x] Recordatorio a la mañana con notificación: evento del día, clima y qué ponerse.
- [x] Pregunta de género: tipos de prenda, nombres ("calzoncillo" / "bombacha"), íconos y avatar según el género.
- [x] Prendas con 3 fotos (adelante, atrás y etiqueta), talle obligatorio (US en calzado), deporte y tipo de prenda.
- [x] Pijama, ropa interior y malla, con secciones por parte y contador de prendas iguales.
- [x] Armario como placard digital (barral, estantes, cajones, organizador y zapatero).
- [x] Avatar con 17 peinados y 13 anteojos (recetados y de sol) con color de armazón.
- [x] Prenda "digitalizada" en el probador: color de la tela y el estampado recortado de la foto, aunque esté torcida.

## Para más adelante (si se vende)
- Probarla en uno mismo y mostrar el antes y el después.
- Videos simples del tipo "una app me vistió una semana".
- Evaluar pasar a Claude u otra IA paga y a una app de tienda.
