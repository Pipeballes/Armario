"use client";

// Materiales del avatar: sombreado tipo dibujo animado (3 tonos) y los dibujos de la tela
// (rayas, cuadros, lunares, flores, camuflado) hechos en el momento, con los colores de la prenda.

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { FabricPattern } from "@/lib/look";

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

/** Cuántas veces se repite el dibujo en cada pieza (alrededor, a lo largo), según su tamaño. */
export const REPEAT = {
  body: [9, 6],
  sleeve: [3, 3],
  leg: [3.5, 4],
  ball: [5, 3],
  skirt: [10, 5],
} as const satisfies Record<string, readonly [number, number]>;

function drawPattern(ctx: CanvasRenderingContext2D, size: number, color: string, p: FabricPattern) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = p.color;
  ctx.strokeStyle = p.color;
  const s = size;
  switch (p.kind) {
    case "rayas":
      for (let y = 0; y < s; y += s / 4) ctx.fillRect(0, y, s, s / 10);
      break;
    case "rayas-verticales":
      for (let x = 0; x < s; x += s / 4) ctx.fillRect(x, 0, s / 10, s);
      break;
    case "cuadros": {
      // Escocés: franjas anchas semitransparentes en las dos direcciones y una línea fina.
      ctx.globalAlpha = 0.45;
      for (let i = 0; i < 2; i++) {
        ctx.fillRect(i * (s / 2), 0, s / 5, s);
        ctx.fillRect(0, i * (s / 2), s, s / 5);
      }
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = s / 64;
      for (let i = 0; i < 2; i++) {
        const c = i * (s / 2) + s / 3;
        ctx.beginPath();
        ctx.moveTo(c, 0);
        ctx.lineTo(c, s);
        ctx.moveTo(0, c);
        ctx.lineTo(s, c);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "lunares":
      for (const [x, y] of [
        [0.25, 0.25],
        [0.75, 0.75],
      ]) {
        ctx.beginPath();
        ctx.arc(x * s, y * s, s / 11, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case "flores":
      for (const [x, y] of [
        [0.27, 0.3],
        [0.75, 0.72],
      ]) {
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(x * s + Math.cos(a) * s * 0.07, y * s + Math.sin(a) * s * 0.07, s * 0.055, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x * s, y * s, s * 0.035, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = p.color;
      }
      break;
    case "camuflado": {
      // Manchas en dos tonos (el del dibujo y uno intermedio), siempre iguales para que no "bailen".
      const mid = new THREE.Color(color).lerp(new THREE.Color(p.color), 0.5);
      const blobs: [number, number, number, boolean][] = [
        [0.2, 0.25, 0.16, true],
        [0.7, 0.2, 0.13, false],
        [0.5, 0.6, 0.18, true],
        [0.15, 0.8, 0.12, false],
        [0.85, 0.75, 0.15, true],
        [0.95, 0.4, 0.1, false],
      ];
      for (const [x, y, r, dark] of blobs) {
        ctx.fillStyle = dark ? p.color : `#${mid.getHexString()}`;
        for (const [dx, dy] of [
          [0, 0],
          [-1, 0],
          [0, -1],
          [-1, -1],
        ]) {
          ctx.beginPath();
          ctx.ellipse((x + dx) * s, (y + dy) * s, r * s, r * s * 0.7, x * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
  }
}

/** Pedazo de la tela real de la foto (estampado por toda la prenda). */
export interface PhotoFill {
  kind: "foto";
  tex: THREE.Texture;
}

/** Lo que va sobre la tela: un dibujo hecho acá, un pedazo de la tela de la foto, o nada (lisa). */
export type Fill = FabricPattern | PhotoFill | null | undefined;

const patternCache = new Map<string, HTMLCanvasElement>();

/** Textura con el dibujo de la tela (o null si es lisa). */
function usePatternTexture(color: string, fill: Fill, repeat: readonly [number, number]) {
  const photo = fill?.kind === "foto" ? fill.tex : null;
  const pattern = fill && fill.kind !== "foto" ? fill : null;
  const key = pattern ? `${color}|${pattern.kind}|${pattern.color}` : photo ? `foto|${photo.uuid}` : "";
  const tex = useMemo(() => {
    if (photo) {
      // La tela real repetida en espejo, así no se notan las uniones entre pedazos.
      const t = photo.clone();
      t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
      t.repeat.set(repeat[0] * 0.8, repeat[1] * 0.8);
      t.needsUpdate = true;
      return t;
    }
    if (!pattern || typeof document === "undefined") return null;
    let canvas = patternCache.get(key);
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.width = canvas.height = 128;
      drawPattern(canvas.getContext("2d")!, 128, color, pattern);
      patternCache.set(key, canvas);
    }
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
    // pattern y photo van dentro de key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, repeat[0], repeat[1]]);
  useEffect(() => () => tex?.dispose(), [tex]);
  return tex;
}

/** Material base de todo el avatar (piel y ropa). */
export function Mat({
  color,
  pattern,
  repeat = REPEAT.body,
  double = false,
  detail = false,
}: {
  color: string;
  pattern?: Fill;
  repeat?: readonly [number, number];
  double?: boolean;
  /** Pegado sobre otra superficie (bolsillo, tira, franja): se dibuja delante, sin parpadeo. */
  detail?: boolean;
}) {
  const map = usePatternTexture(color, pattern, repeat);
  return (
    <meshToonMaterial
      // Si la textura llega después (la tela de la foto se arma en segundo plano), el material se
      // rehace: three.js no agrega la textura a un material ya armado sin ella.
      key={map ? `m${map.uuid}` : "liso"}
      color={map ? "#ffffff" : color}
      map={map ?? undefined}
      gradientMap={getToonGradient()}
      side={double || detail ? THREE.DoubleSide : THREE.FrontSide}
      polygonOffset={detail}
      polygonOffsetFactor={detail ? -1 : 0}
      polygonOffsetUnits={detail ? -1 : 0}
    />
  );
}

/** Material de un detalle pegado sobre otra superficie (bolsillos, tiras, franjas): sin parpadeo. */
export function DetailMat({ color }: { color: string }) {
  return <Mat color={color} detail />;
}

/** Aclara (+) u oscurece (−) un color, para detalles como costuras, suelas o puños. */
export function shade(color: string, amount: number): string {
  const c = new THREE.Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amount)));
  return `#${c.getHexString()}`;
}
