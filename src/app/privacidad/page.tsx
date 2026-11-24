import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacidad · Armario",
  description: "Qué datos guarda Armario, para qué y cómo borrarlos.",
};

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-6 mb-2 font-display text-xl font-semibold">{children}</h2>;
}

export default function PrivacidadPage() {
  return (
    <article className="text-[15px] leading-relaxed">
      <Link href="/perfil" className="mb-3 inline-block text-sm text-accent">
        ← Perfil
      </Link>
      <h1 className="page-title mb-1">Política de privacidad</h1>
      <p className="mb-4 text-sm text-muted">Última actualización: 24 de noviembre de 2026 (fotos del perfil guardadas)</p>

      <p>
        Armario es una app para ordenar tu ropa y armar outfits. Esta página explica, en palabras simples, qué datos
        guarda, para qué los usa, con quién los comparte y cómo podés borrarlos.
      </p>

      <H>Qué datos guarda</H>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>Tu mail</strong>, si creás una cuenta, para mandarte el código de entrada.
        </li>
        <li>
          <strong>Las fotos de tu ropa</strong> y sus datos (tipo, color, estilo, cuándo la usaste).
        </li>
        <li>
          <strong>Tu perfil</strong>: nombre, género, subtono y tono de piel, silueta, altura, estilos, las fotos tuyas que
          subís para el análisis (privadas, podés sacarlas cuando quieras), fotos de inspiración,
          cómo se ve tu avatar, los outfits que marcaste con 👍/👎 y los días que fijaste en el planificador.
        </li>
        <li>
          <strong>Los links de tus calendarios</strong>, si los conectás. Armario solo lee los eventos para sugerirte
          outfits: no los guarda ni los modifica.
        </li>
      </ul>
      <p className="mt-2">
        Sin cuenta, todo queda solo en tu celular. Con cuenta, se guarda en la nube para que lo veas desde cualquier
        dispositivo.
      </p>

      <H>Qué NO guarda</H>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>Tu ubicación exacta</strong>: para el clima se usa una ubicación redondeada (más o menos 1 km), que
          queda solo en tu celular.
        </li>
        <li>Contraseñas: Armario no usa contraseñas, entrás con un código por mail.</li>
      </ul>

      <H>Con quién se comparte</H>
      <p>Armario usa estos servicios para funcionar. No vende tus datos ni los usa para publicidad.</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>Supabase</strong>: guarda tu cuenta, tu ropa, tu perfil y tus fotos, en servidores de San Pablo
          (Brasil). Cada persona solo puede ver lo suyo.
        </li>
        <li>
          <strong>Google Gemini (IA)</strong>: recibe las fotos de ropa y las fotos tuyas que elegís analizar, y una
          descripción en texto de tus outfits cuando le pedís que elija. En el plan gratis, Google puede usar lo que
          recibe para mejorar sus productos. Si no querés, podés completar todo a mano y no usar la IA.
        </li>
        <li>
          <strong>Open-Meteo</strong>: recibe la ubicación redondeada para devolver el pronóstico.
        </li>
        <li>
          <strong>Vercel</strong>: aloja la app.
        </li>
        <li>
          <strong>Gmail</strong>: se usa para mandar el mail con el código de entrada.
        </li>
        <li>
          <strong>iCloud, Google Calendar u Outlook</strong>: Armario lee los calendarios que conectes a través del link
          que compartiste.
        </li>
      </ul>

      <H>Cuánto tiempo se guardan</H>
      <p>
        Mientras tengas la cuenta. Si borrás una prenda, se borra su foto. Los días fijados del planificador que ya
        pasaron se borran solos.
      </p>

      <H>Cómo borrar tus datos</H>
      <ul className="list-disc space-y-1 pl-5">
        <li>Podés borrar cada prenda desde el Armario y desconectar los calendarios desde Perfil.</li>
        <li>
          En Perfil podés descargar una copia de todo (&quot;Copia de seguridad&quot;).
        </li>
        <li>
          Para borrar tu cuenta y todos tus datos, escribí al responsable de la app (abajo) y se borra en un plazo de 30
          días.
        </li>
        <li>Para cortar el acceso a un calendario, desactivá también el link compartido en el iPhone o en Google.</li>
      </ul>

      <H>Tus derechos</H>
      <p>
        Podés pedir ver, corregir o borrar tus datos en cualquier momento. En Argentina, la Ley 25.326 de Protección de
        Datos Personales te da estos derechos, y la Agencia de Acceso a la Información Pública es el organismo de
        control.
      </p>

      <H>Responsable</H>
      <p>
        Armario es un proyecto personal. Para consultas o pedidos sobre tus datos, escribí al mail desde el que te
        llega el código de entrada.
      </p>
    </article>
  );
}
