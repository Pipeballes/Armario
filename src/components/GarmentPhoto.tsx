import type { Garment } from "@/lib/types";

/**
 * Foto de la prenda. Si tiene foto de atrás, se ve al pasar el mouse por encima.
 * Si hay varias iguales (medias, ropa interior), muestra la cantidad.
 */
export default function GarmentPhoto({ garment, className = "" }: { garment: Garment; className?: string }) {
  const base = `aspect-square w-full rounded-xl bg-surface-2 object-cover ${className}`;
  const qty = garment.quantity && garment.quantity > 1 ? garment.quantity : null;
  const badge = qty && (
    <span
      className="absolute top-1.5 left-1.5 rounded-full bg-accent px-2 text-xs leading-5 font-semibold text-accent-ink shadow"
      aria-label={`${qty} iguales`}
    >
      ×{qty}
    </span>
  );
  if (!garment.photoBack) {
    return (
      <span className="relative block">
        {/* Las fotos son data URLs o links firmados, por eso no se usa next/image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={garment.photo} alt={garment.name} loading="lazy" className={base} />
        {badge}
      </span>
    );
  }
  return (
    <span className="group relative block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={garment.photo} alt={garment.name} loading="lazy" className={`${base} group-hover:opacity-0`} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={garment.photoBack}
        alt={`${garment.name} (atrás)`}
        loading="lazy"
        className={`${base} absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100`}
      />
      <span
        aria-hidden
        className="absolute right-1.5 bottom-1.5 rounded-full bg-black/60 px-1.5 text-[10px] leading-4 text-white"
      >
        ↻
      </span>
      {badge}
    </span>
  );
}
