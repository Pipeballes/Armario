"use client";

// Materiales del avatar: sombreado tipo dibujo animado (3 tonos) y rayas para prendas estampadas sin foto.

import { useEffect, useMemo } from "react";
import * as THREE from "three";

/** Degradé de 3 tonos para el sombreado tipo dibujo animado. */
let toonGradient: THREE.DataTexture | null = null;
export function getToonGradient(): THREE.DataTexture {
  if (!toonGradient) {
    toonGradient = new THREE.DataTexture(new Uint8Array([125, 200, 255]), 3, 1, THREE.RedFormat);
    toonGradient.minFilter = THREE.NearestFilter;
    toonGradient.magFilter = THREE.NearestFilter;
    toonGradient.needsUpdate = true;
  }
  return toonGradient;
}

/** Textura rayada para las prendas estampadas cuando no hay foto. */
function useStripes(color: string, striped: boolean) {
  const tex = useMemo(() => {
    if (!striped || typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    for (let y = 0; y < 64; y += 16) ctx.fillRect(0, y, 64, 6);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(6, 8);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [color, striped]);
  useEffect(() => () => tex?.dispose(), [tex]);
  return tex;
}

/** Material base de todo el avatar (piel y ropa). */
export function Mat({ color, striped = false, double = false }: { color: string; striped?: boolean; double?: boolean }) {
  const map = useStripes(color, striped);
  return (
    <meshToonMaterial
      color={map ? "#ffffff" : color}
      map={map ?? undefined}
      gradientMap={getToonGradient()}
      side={double ? THREE.DoubleSide : THREE.FrontSide}
    />
  );
}

/** Aclara (+) u oscurece (−) un color, para detalles como costuras, suelas o puños. */
export function shade(color: string, amount: number): string {
  const c = new THREE.Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amount)));
  return `#${c.getHexString()}`;
}
