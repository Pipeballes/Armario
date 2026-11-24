"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import GarmentForm from "@/components/GarmentForm";
import { useArmario } from "@/lib/store";

export default function NuevaPrendaPage() {
  const router = useRouter();
  const { garments } = useArmario();
  const [saved, setSaved] = useState(0);
  // La app guarda las pantallas al cambiar de sección: al volver acá se arranca con el formulario vacío.
  const [formKey, setFormKey] = useState(0);
  const wasHidden = useRef(false);
  useEffect(() => {
    if (wasHidden.current) {
      wasHidden.current = false;
      setFormKey((k) => k + 1);
      setSaved(0);
    }
    return () => {
      wasHidden.current = true;
    };
  }, []);

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
        key={formKey}
        allowAnother
        onDone={(another) => {
          if (another) {
            setSaved((n) => n + 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
          } else {
            setFormKey((k) => k + 1);
            router.push("/armario");
          }
        }}
      />
    </div>
  );
}
