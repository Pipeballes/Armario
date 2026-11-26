"use client";

// Piezas que comparten varias prendas: bordes, mangas, botones, parches pegados a la tela y la
// calcomanía del estampado recortado de la foto.

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import type { PrintRef } from "@/lib/look";
import { analyzePhotoPrint, buildPrintDecal } from "@/lib/print-decal";
import { clothProfile, jointBalls, limbProfiles, profileAt, ringAt, type Ring, type Skeleton, type V3 } from "@/lib/skeleton";
import type { GarmentFit } from "@/lib/types";
import { Geo } from "./Body";
import { Mat, REPEAT, getToonGradient, type Fill } from "./materials";
import { axisLathe, limbFrame, limbPoint, pathTube, shellPoint } from "./shapes";

export const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Anillo (borde de manga, cintura, cuello) que sigue un óvalo a cierta altura. */
export function RingBand({ ring, tube, color, y }: { ring: Ring; tube: number; color: string; y?: number }) {
  const R = (ring.rx + ring.rz) / 2;
  return (
    <mesh position={[0, y ?? ring.y, ring.z]} rotation={[Math.PI / 2, 0, 0]} scale={[ring.rx / R, ring.rz / R, 1]} castShadow>
      <torusGeometry args={[R, tube, 8, 40]} />
      <Mat color={color} />
    </mesh>
  );
}

/** Borde redondo de una manga o una botamanga, perpendicular al brazo o la pierna. */
export function Cuff({ from, to, r, tube, color }: { from: V3; to: V3; r: number; tube: number; color: string }) {
  const q = useMemo(() => {
    const d = new THREE.Vector3(...to).sub(new THREE.Vector3(...from)).normalize();
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
  }, [from, to]);
  return (
    <mesh position={to} quaternion={q} castShadow>
      <torusGeometry args={[r, tube, 8, 24]} />
      <Mat color={color} />
    </mesh>
  );
}

/** Un parche pegado a la tela (bolsillo, tira, franja), con el dibujo de la tela si tiene. */
export function Piece({
  geo,
  color,
  pattern,
  repeat = [3, 3],
}: {
  geo: THREE.BufferGeometry;
  color: string;
  pattern?: Fill;
  /** Repeticiones del dibujo a lo ancho y a lo alto (que coincidan con el tamaño del dibujo en la prenda). */
  repeat?: readonly [number, number];
}) {
  return (
    <Geo geo={geo} cast={false}>
      <Mat color={color} pattern={pattern} repeat={repeat} detail />
    </Geo>
  );
}

/** Botón chato, apoyado sobre la tela y mirando hacia afuera (en la dirección `normal`). */
export function Button({ at, normal, r = 0.0055, color }: { at: THREE.Vector3; normal: THREE.Vector3; r?: number; color: string }) {
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal.clone().normalize()), [normal]);
  return (
    <mesh position={at} quaternion={q}>
      <cylinderGeometry args={[r, r, 0.0024, 12]} />
      <Mat color={color} />
    </mesh>
  );
}

/** Dirección hacia afuera del óvalo en ese punto (para orientar botones y parches). */
export function shellNormal(shell: Ring[], y: number, phi: number): THREE.Vector3 {
  const r = ringAt(shell, y);
  return new THREE.Vector3(Math.sin(phi) / r.rx, 0, Math.cos(phi) / r.rz).normalize();
}

/** Botones en fila al frente, de `y0` (arriba) a `y1` (abajo), sobre la prenda. */
export function ButtonRow({ shell, y0, y1, count, x = 0, color, r }: { shell: Ring[]; y0: number; y1: number; count: number; x?: number; color: string; r?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const y = count === 1 ? y0 : y0 + ((y1 - y0) * i) / (count - 1);
        const phi = Math.asin(Math.max(-0.9, Math.min(0.9, x / ringAt(shell, y).rx)));
        return <Button key={i} at={shellPoint(shell, y, phi, 0.003)} normal={shellNormal(shell, y, phi)} color={color} r={r} />;
      })}
    </>
  );
}

/** Costura o cordón que sigue la tela por varios puntos (ya separados de la superficie). */
export function Line({ points, r = 0.0014, color }: { points: THREE.Vector3[]; r?: number; color: string }) {
  const geo = useMemo(() => pathTube(points, r, Math.max(8, points.length * 4)), [points, r]);
  return (
    <Geo geo={geo} cast={false}>
      <Mat color={color} />
    </Geo>
  );
}

// ───────────────────────── Mangas ─────────────────────────

export type CuffStyle = "plain" | "ribbed" | "shirt";

/** Manga de un lado (el derecho; el izquierdo se dibuja en espejo). Sigue la forma del brazo + holgura. */
export function Sleeve({
  sk,
  length,
  inflate,
  color,
  pattern,
  trim,
  cuff = "plain",
  buttonColor,
  shortT = 0.52,
  open = 0.007,
  stitch,
}: {
  sk: Skeleton;
  length: "short" | "long";
  inflate: number;
  color: string;
  pattern?: Fill;
  trim: string;
  cuff?: CuffStyle;
  buttonColor?: string;
  /** Manga corta: hasta dónde baja por el brazo (0 = hombro, 1 = codo). */
  shortT?: number;
  /** Manga corta: cuánto más ancha que el brazo es su boca (se va abriendo de a poco). */
  open?: number;
  /** Color de la costura del ruedo de la manga (las remeras la tienen; si no se pasa, no se dibuja). */
  stitch?: string;
}) {
  const a = useMemo(() => sk.arm(1), [sk]);
  const prof = useMemo(() => limbProfiles(sk), [sk]);
  const j = useMemo(() => jointBalls(sk, inflate), [sk, inflate]);
  // La manga de camisa termina en un puño un poco más arriba de la muñeca.
  const wristT = cuff === "shirt" ? 0.88 : 0.93;
  const ribbed = cuff === "ribbed";
  const shortEnd = useMemo(() => lerp3(a.shoulder, a.elbow, shortT), [a, shortT]);
  // La manga corta se va abriendo hacia la boca (más en una oversize).
  const shortProfile = useMemo((): [number, number][] => {
    const ts = new Set<number>([0, shortT, ...prof.upperArm.map((p) => p[0]).filter((t) => t > 0 && t < shortT)]);
    for (let i = 1; i < 5; i++) ts.add((shortT * i) / 5);
    return [...ts]
      .sort((x, y) => x - y)
      .map((t) => [t / shortT, profileAt(prof.upperArm, t) + inflate + open * (t / shortT) ** 1.4]);
  }, [prof, inflate, open, shortT]);
  const wristEnd = useMemo(() => lerp3(a.elbow, a.wrist, wristT), [a, wristT]);
  const upper = useMemo(
    () =>
      length === "short" ? axisLathe(a.shoulder, shortEnd, shortProfile) : axisLathe(a.shoulder, a.elbow, clothProfile(prof.upperArm, inflate)),
    [length, a, shortEnd, prof, inflate, shortProfile],
  );
  const lower = useMemo(
    () =>
      length === "long"
        ? axisLathe(
            a.elbow,
            wristEnd,
            clothProfile(prof.forearm, inflate, 0, wristT, ribbed ? undefined : profileAt(prof.forearm, wristT) + inflate + 0.004),
          )
        : null,
    [length, a, wristEnd, prof, inflate, ribbed, wristT],
  );
  const shortR = profileAt(prof.upperArm, shortT) + inflate + open;
  // Costura del ruedo de la manga, a un centímetro y medio del borde.
  const hemSeam = useMemo(() => {
    if (length !== "short" || !stitch) return null;
    const f = limbFrame(a.shoulder, a.elbow);
    const len = Math.hypot(a.elbow[0] - a.shoulder[0], a.elbow[1] - a.shoulder[1], a.elbow[2] - a.shoulder[2]);
    const t = shortT - 0.015 / len;
    const r = profileAt(shortProfile, t / shortT) + 0.0012;
    return Array.from({ length: 33 }, (_, i) => limbPoint(f, t, (2 * Math.PI * i) / 32, r));
  }, [length, stitch, a, shortT, shortProfile]);
  const cuffR = profileAt(prof.forearm, wristT) + inflate + (ribbed ? 0 : 0.004);
  // Puño de camisa: una banda de unos 4 cm que llega a la muñeca, con su botón.
  const shirtCuff = useMemo(() => {
    if (length !== "long" || cuff !== "shirt") return null;
    const end = lerp3(a.elbow, a.wrist, 0.985);
    return { geo: axisLathe(wristEnd, end, [[0, cuffR + 0.0015], [1, cuffR + 0.001]], { capA: false, capB: false }), end };
  }, [length, cuff, a, wristEnd, cuffR]);
  const cuffButton = useMemo(() => {
    if (!shirtCuff) return null;
    const f = limbFrame(a.elbow, a.wrist);
    const p = limbPoint(f, (wristT + 0.985) / 2, Math.PI * 0.6, cuffR + 0.003);
    const n = limbPoint(f, (wristT + 0.985) / 2, Math.PI * 0.6, 1).sub(limbPoint(f, (wristT + 0.985) / 2, 0, 0));
    return { p, n };
  }, [shirtCuff, a, wristT, cuffR]);
  return (
    <group>
      {/* Hombro de la prenda: envuelve al hombro de la piel (mismo centro) y tapa la boca de la manga */}
      <mesh position={j.shoulder.at} castShadow>
        <sphereGeometry args={[j.shoulder.r, 24, 18]} />
        <Mat color={color} pattern={pattern} repeat={REPEAT.ball} />
      </mesh>
      <Geo geo={upper}>
        <Mat color={color} pattern={pattern} repeat={REPEAT.sleeve} double />
      </Geo>
      {length === "short" ? (
        <>
          <Cuff from={a.shoulder} to={shortEnd} r={shortR} tube={0.0035} color={trim} />
          {hemSeam && stitch && <Line points={hemSeam} r={0.0006} color={stitch} />}
        </>
      ) : (
        <>
          <mesh position={j.elbow.at} castShadow>
            <sphereGeometry args={[j.elbow.r, 24, 18]} />
            <Mat color={color} pattern={pattern} repeat={REPEAT.ball} />
          </mesh>
          {lower && (
            <Geo geo={lower}>
              <Mat color={color} pattern={pattern} repeat={REPEAT.sleeve} double />
            </Geo>
          )}
          {shirtCuff ? (
            <>
              <Geo geo={shirtCuff.geo}>
                <Mat color={color} double />
              </Geo>
              <Cuff from={a.elbow} to={wristEnd} r={cuffR + 0.0015} tube={0.0018} color={trim} />
              <Cuff from={a.elbow} to={shirtCuff.end} r={cuffR + 0.001} tube={0.0022} color={trim} />
              {cuffButton && buttonColor && <Button at={cuffButton.p} normal={cuffButton.n} r={0.004} color={buttonColor} />}
            </>
          ) : (
            <Cuff from={a.elbow} to={wristEnd} r={cuffR} tube={ribbed ? 0.008 : 0.004} color={trim} />
          )}
        </>
      )}
    </group>
  );
}

// ───────────────────────── Estampado ─────────────────────────

/** Estampado suelto listo para pegar: la imagen, su proporción y dónde va sobre la prenda. */
export interface Decal {
  tex: THREE.Texture;
  aspect: number;
  place: NonNullable<GarmentFit["print"]>;
}

/** El estampado de un lado de la prenda: suelto (calcomanía) o por toda la tela (pedazo de tela real). */
export type GarmentPrint = { decal: Decal; tile?: undefined } | { tile: THREE.Texture; decal?: undefined } | null;

const canvasTexture = (c: HTMLCanvasElement) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
};

/**
 * Estampado de un lado (adelante o atrás) de la prenda. Si la IA marcó dónde está, se recorta de
 * ahí; si no, se mira la foto: un dibujo suelto se recorta y se pega donde está, y un dibujo por
 * toda la tela se dibuja con un pedazo de la tela real. Nunca se inventan rayas.
 */
export function useGarmentPrint(ref: PrintRef | undefined, back: boolean): GarmentPrint {
  const src = back ? ref?.back : ref?.front;
  const fit = back ? ref?.fitBack : ref?.fitFront;
  const [state, setState] = useState<{ key: string; print: NonNullable<GarmentPrint> } | null>(null);
  const key = ref && src ? `${src}|${JSON.stringify(fit ?? null)}|${ref.estampado}|${ref.allover}|${ref.body}` : "";
  useEffect(() => {
    if (!key || !ref || !src) return;
    let alive = true;
    let made: THREE.Texture | null = null;
    const done = (print: NonNullable<GarmentPrint>, tex: THREE.Texture) => {
      made = tex;
      if (alive) setState({ key, print });
      else tex.dispose();
    };
    (async () => {
      if (fit?.print && !ref.allover) {
        const r = await buildPrintDecal(src, fit);
        if (r) {
          const tex = canvasTexture(r.canvas);
          return done({ decal: { tex, aspect: r.aspect, place: fit.print } }, tex);
        }
      }
      if (!ref.estampado && !ref.allover) return;
      const r = await analyzePhotoPrint(src, fit, { body: ref.body, allover: ref.allover });
      if (!r) return;
      const tex = canvasTexture(r.kind === "single" ? r.canvas : r.tile);
      if (r.kind === "single") done({ decal: { tex, aspect: r.aspect, place: { box: [0, 0, 1, 1], ...r.place } } }, tex);
      else done({ tile: tex }, tex);
    })().catch(() => {});
    return () => {
      alive = false;
      made?.dispose();
    };
    // ref, src y fit van dentro de key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state && state.key === key ? state.print : null;
}

/**
 * Geometría de la calcomanía sobre el cuerpo de una prenda: una grilla que copia su curva, en el
 * lugar y del tamaño que dijo la IA (x de −1 a 1 sobre el ancho; y de 0 = arriba a 1 = ruedo).
 * `widthAt` es la altura donde se mide el ancho de la prenda (el pecho en una remera).
 */
export function decalGeometry(
  shell: Ring[],
  place: NonNullable<GarmentFit["print"]>,
  aspect: number,
  back: boolean,
  widthAt = 1.26,
  range?: [number, number],
): THREE.BufferGeometry {
  const top = (range?.[1] ?? shell[shell.length - 1].y) - 0.02;
  const bottom = (range?.[0] ?? shell[0].y) + 0.02;
  const chest = ringAt(shell, widthAt);
  let w = place.width * 2 * chest.rx * 0.9;
  let h = w / Math.max(0.2, aspect);
  const maxH = (top - bottom) * 0.85;
  if (h > maxH) {
    w *= maxH / h;
    h = maxH;
  }
  const side = back ? -1 : 1;
  const cx = place.x * chest.rx * 0.8 * side;
  const cy = top - place.y * (top - bottom);
  const y0 = Math.max(bottom, Math.min(cy - h / 2, top - h));
  const nx = 24;
  const ny = 16;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= ny; j++) {
    const y = y0 + (j / ny) * h;
    const ring = ringAt(shell, y);
    for (let i = 0; i <= nx; i++) {
      const u = i / nx;
      // Mirando la prenda de frente (o de espaldas), la textura va de izquierda a derecha.
      const x = cx + (u - 0.5) * w * side;
      const xc = Math.max(-ring.rx * 0.98, Math.min(ring.rx * 0.98, x));
      const phi = Math.asin(xc / ring.rx);
      const z = ring.z + side * (ring.rz * Math.cos(phi) + 0.0025);
      pos.push(xc, y, z);
      uv.push(u, j / ny);
    }
  }
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      const b = a + nx + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** Material de la calcomanía: la imagen recortada, sin fondo, pegada encima de la tela. */
export function DecalMat({ tex }: { tex: THREE.Texture }) {
  return (
    <meshToonMaterial
      map={tex}
      gradientMap={getToonGradient()}
      transparent
      alphaTest={0.08}
      side={THREE.DoubleSide}
      polygonOffset
      polygonOffsetFactor={-2}
    />
  );
}

export function PrintDecal({
  shell,
  tex,
  aspect,
  place,
  back = false,
  widthAt,
  range,
}: {
  shell: Ring[];
  tex: THREE.Texture;
  aspect: number;
  place: NonNullable<GarmentFit["print"]>;
  back?: boolean;
  widthAt?: number;
  range?: [number, number];
}) {
  const geo = useMemo(() => decalGeometry(shell, place, aspect, back, widthAt, range), [shell, place, aspect, back, widthAt, range]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} renderOrder={2}>
      <DecalMat tex={tex} />
    </mesh>
  );
}
