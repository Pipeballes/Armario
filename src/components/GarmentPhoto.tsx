import type { Garment } from "@/lib/types";

export default function GarmentPhoto({ garment, className = "" }: { garment: Garment; className?: string }) {
  return (
    // Las fotos son data URLs locales, por eso no se usa next/image.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={garment.photo}
      alt={garment.name}
      loading="lazy"
      className={`aspect-square w-full rounded-xl bg-surface-2 object-cover ${className}`}
    />
  );
}
