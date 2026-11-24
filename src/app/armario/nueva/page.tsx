"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import GarmentForm from "@/components/GarmentForm";
import { useArmario } from "@/lib/store";

export default function NuevaPrendaPage() {
  const router = useRouter();
  const { garments } = useArmario();
  const [saved, setSaved] = useState(0);

  return (
    <div>
      <Link href="/armario" className="mb-4 inline-block text-sm text-accent">
        ← Volver al armario
      </Link>
      <h1 className="page-title mb-1">Agregar prenda</h1>
      <p className="mb-6 text-sm text-muted">
        {saved > 0
          ? `¡Listo! Llevás ${saved} cargada${saved === 1 ? "" : "s"} ahora (${garments.length} en total). Seguí con la próxima.`
          : "Sacale una foto y completá lo básico. Toma menos de un minuto."}
      </p>
      <GarmentForm
        allowAnother
        onDone={(another) => {
          if (another) {
            setSaved((n) => n + 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
          } else {
            router.push("/armario");
          }
        }}
      />
    </div>
  );
}
