"use client";

import { colorById } from "@/lib/catalog";
import type { ReactNode } from "react";

export function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className="chip" aria-pressed={pressed} onClick={onClick}>
      {children}
    </button>
  );
}

export function Swatch({ colorId, size = 16 }: { colorId: string; size?: number }) {
  const c = colorById(colorId);
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full border border-black/15"
      style={{ width: size, height: size, background: c.hex }}
    />
  );
}

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <span className="label">{title}</span>
      {hint && <p className="-mt-1 mb-2 text-sm text-muted">{hint}</p>}
      {children}
    </section>
  );
}

export function Loading() {
  return <p className="py-10 text-center text-muted">Abriendo tu armario…</p>;
}

export function ErrorBox({ message }: { message: string }) {
  return <p className="card border-danger p-4 text-danger">{message}</p>;
}
