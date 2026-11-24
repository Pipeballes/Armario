import type { Garment } from "@/lib/types";

/** Foto de la prenda. Si tiene foto de atrás, se ve al pasar el mouse por encima. */
export default function GarmentPhoto({ garment, className = "" }: { garment: Garment; className?: string }) {
  const base = `aspect-square w-full rounded-xl bg-surface-2 object-cover ${className}`;
  if (!garment.photoBack) {
    // Las fotos son data URLs o links firmados, por eso no se usa next/image.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={garment.photo} alt={garment.name} loading="lazy" className={base} />;
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
    </span>
  );
}
