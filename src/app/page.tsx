"use client";

import Link from "next/link";
import { categoriesFor } from "@/lib/catalog";
import { useArmario } from "@/lib/store";
import { ErrorBox, Loading } from "@/components/ui";

export default function Home() {
  const { ready, garments, profile, error } = useArmario();
  if (!ready) return <Loading />;
  if (error) return <ErrorBox message={error} />;

  const profileDone = Boolean(profile.undertone && profile.bodyType && profile.styles.length > 0);
  const has = (c: string) => garments.some((g) => g.category === c);
  const canDress = (has("top") && has("bottom")) || has("dress");
  const steps = [
    { done: profileDone, label: "Completá tu perfil (tono de piel, cuerpo y estilo)", href: "/perfil" },
    { done: garments.length >= 5, label: "Cargá al menos 5 prendas", href: "/armario/nueva" },
    { done: canDress && has("shoes"), label: "Que haya arriba, abajo y calzado", href: "/armario/nueva" },
  ];
  const allDone = steps.every((s) => s.done);

  return (
    <div>
      <header className="mb-6">
        <p className="text-sm text-muted">{profile.name ? `Hola, ${profile.name}` : "Hola"} 👋</p>
        <h1 className="page-title">¿Qué te ponés hoy?</h1>
      </header>

      <Link href="/outfits" className="card mb-6 block bg-accent p-5 text-accent-ink">
        <span className="text-3xl" aria-hidden>
          ✨
        </span>
        <p className="mt-2 font-display text-xl font-semibold">Armame un outfit</p>
        <p className="text-sm opacity-90">Elegí la ocasión y te armo opciones con tu ropa.</p>
      </Link>

      <Link href="/semana" className="card mb-6 flex items-center gap-4 p-4">
        <span className="text-3xl" aria-hidden>
          📆
        </span>
        <span>
          <span className="block font-semibold">Planificá tu semana</span>
          <span className="block text-sm text-muted">Un outfit por día y qué ropa tener lista.</span>
        </span>
      </Link>

      {!profileDone && (
        <Link href="/perfil" className="card mb-6 flex items-center gap-4 border-accent p-4">
          <span className="text-3xl" aria-hidden>
            🤳
          </span>
          <span>
            <span className="block font-semibold">Subí una foto tuya</span>
            <span className="block text-sm text-muted">
              La IA te dice tu tono de piel, tu silueta y qué colores te quedan mejor.
            </span>
          </span>
        </Link>
      )}

      {!allDone && (
        <section className="card mb-6 p-5">
          <h2 className="mb-3 font-semibold">Para empezar</h2>
          <ol className="space-y-2">
            {steps.map((s) => (
              <li key={s.label}>
                <Link href={s.href} className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                      s.done ? "border-ok bg-ok text-white" : "border-line"
                    }`}
                  >
                    {s.done ? "✓" : ""}
                  </span>
                  <span className={s.done ? "text-muted line-through" : ""}>{s.label}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-semibold">Tu armario</h2>
          <Link href="/armario" className="text-sm text-accent">
            Ver todo ({garments.length})
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {categoriesFor(profile.gender).map((c) => (
            <Link key={c.id} href="/armario" className="card p-3 text-center">
              <span className="text-2xl" aria-hidden>
                {c.emoji}
              </span>
              <p className="text-lg font-semibold">{garments.filter((g) => g.category === c.id).length}</p>
              <p className="text-xs text-muted">{c.plural}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
