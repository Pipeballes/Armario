"use client";

// La ropa del avatar: parte de arriba (remera, camisa, buzo, polera, musculosa, corpiño, malla, vestido),
// abrigo (campera, saco, tapado, chaleco, inflable), parte de abajo (pantalón, short, bermuda, pollera,
// ropa interior), calzado (zapatillas, zapatos, botas, sandalias, tacos, pantuflas) y accesorios.
// Cada prenda sigue la forma del cuerpo (el esqueleto) un poco "inflada", así nunca atraviesa la piel.

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import type { AccessoryLook, BottomLook, OuterLook, ShoesLook, TopLook } from "@/lib/avatar";
import { buildPrintDecal } from "@/lib/print-decal";
import {
  HEAD_R,
  HEAD_Y,
  bottomInflate,
  bottomShell,
  clothProfile,
  jointBalls,
  limbProfiles,
  outerFit,
  profileAt,
  ringAt,
  shellRings,
  skirtRings,
  sleeveInflate,
  strapPath,
  topCoversShoulders,
  topHemTube,
  type Ring,
  type Skeleton,
  type SkirtLength,
  type V3,
} from "@/lib/skeleton";
import type { GarmentFit } from "@/lib/types";
import { Foot, Geo, Limb, SOLE_Y, footRings } from "./Body";
import { Mat, getToonGradient, shade } from "./materials";
import { axisLathe, ringTube } from "./shapes";

const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Anillo (borde de manga, cintura, cuello) que sigue un óvalo a cierta altura. */
function RingBand({ ring, tube, color, y }: { ring: Ring; tube: number; color: string; y?: number }) {
  const R = (ring.rx + ring.rz) / 2;
  return (
    <mesh position={[0, y ?? ring.y, ring.z]} rotation={[Math.PI / 2, 0, 0]} scale={[ring.rx / R, ring.rz / R, 1]} castShadow>
      <torusGeometry args={[R, tube, 8, 40]} />
      <Mat color={color} />
    </mesh>
  );
}

/** Borde redondo de una manga o una botamanga, perpendicular al brazo o la pierna. */
function Cuff({ from, to, r, tube, color }: { from: V3; to: V3; r: number; tube: number; color: string }) {
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

// ───────────────────────── Mangas ─────────────────────────

/** Manga de un lado (el derecho; el izquierdo se dibuja en espejo). Sigue la forma del brazo + holgura. */
function Sleeve({
  sk,
  length,
  inflate,
  color,
  striped,
  ribbed,
}: {
  sk: Skeleton;
  length: "short" | "long";
  inflate: number;
  color: string;
  striped: boolean;
  ribbed: boolean;
}) {
  const a = useMemo(() => sk.arm(1), [sk]);
  const prof = useMemo(() => limbProfiles(sk), [sk]);
  const j = useMemo(() => jointBalls(sk, inflate), [sk, inflate]);
  const shortT = 0.52;
  const wristT = 0.93;
  const shortEnd = useMemo(() => lerp3(a.shoulder, a.elbow, shortT), [a]);
  const wristEnd = useMemo(() => lerp3(a.elbow, a.wrist, wristT), [a]);
  const upper = useMemo(
    () =>
      length === "short"
        ? axisLathe(a.shoulder, shortEnd, clothProfile(prof.upperArm, inflate, 0, shortT, profileAt(prof.upperArm, shortT) + inflate + 0.007))
        : axisLathe(a.shoulder, a.elbow, clothProfile(prof.upperArm, inflate)),
    [length, a, shortEnd, prof, inflate],
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
    [length, a, wristEnd, prof, inflate, ribbed],
  );
  const band = shade(color, -0.05);
  const shortR = profileAt(prof.upperArm, shortT) + inflate + 0.007;
  const cuffR = profileAt(prof.forearm, wristT) + inflate + (ribbed ? 0 : 0.004);
  return (
    <group>
      {/* Hombro de la prenda: envuelve al hombro de la piel (mismo centro) y tapa la boca de la manga */}
      <mesh position={j.shoulder.at} castShadow>
        <sphereGeometry args={[j.shoulder.r, 24, 18]} />
        <Mat color={color} striped={striped} />
      </mesh>
      <Geo geo={upper}>
        <Mat color={color} striped={striped} double />
      </Geo>
      {length === "short" ? (
        <Cuff from={a.shoulder} to={shortEnd} r={shortR} tube={0.0035} color={band} />
      ) : (
        <>
          <mesh position={j.elbow.at} castShadow>
            <sphereGeometry args={[j.elbow.r, 24, 18]} />
            <Mat color={color} striped={striped} />
          </mesh>
          {lower && (
            <Geo geo={lower}>
              <Mat color={color} striped={striped} double />
            </Geo>
          )}
          <Cuff from={a.elbow} to={wristEnd} r={cuffR} tube={ribbed ? 0.008 : 0.004} color={band} />
        </>
      )}
    </group>
  );
}

// ───────────────────────── Estampado ─────────────────────────

/** Calcomanía del estampado (recortado de la foto, derecho y sin la tela de alrededor). */
export function usePrintDecal(src: string | undefined, fit: GarmentFit | undefined): { tex: THREE.Texture; aspect: number } | null {
  const [state, setState] = useState<{ key: string; tex: THREE.Texture; aspect: number } | null>(null);
  const key = src && fit?.print ? `${src}|${JSON.stringify(fit)}` : "";
  useEffect(() => {
    if (!key || !src || !fit) return;
    let alive = true;
    let made: THREE.Texture | null = null;
    buildPrintDecal(src, fit)
      .then((r) => {
        if (!r) return;
        const t = new THREE.CanvasTexture(r.canvas);
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        made = t;
        if (alive) setState({ key, tex: t, aspect: r.aspect });
        else t.dispose();
      })
      .catch(() => {});
    return () => {
      alive = false;
      made?.dispose();
    };
    // src y fit van dentro de key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state && state.key === key ? state : null;
}

/**
 * Geometría de la calcomanía: una grilla que copia la curva de la prenda, en el lugar y del tamaño
 * que dijo la IA (x de −1 a 1 sobre el ancho del cuerpo; y de 0 = cuello a 1 = ruedo).
 */
export function decalGeometry(
  shell: Ring[],
  place: NonNullable<GarmentFit["print"]>,
  aspect: number,
  back: boolean,
): THREE.BufferGeometry {
  const top = shell[shell.length - 1].y - 0.02;
  const bottom = shell[0].y + 0.02;
  const chest = ringAt(shell, 1.26);
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

function PrintDecal({
  shell,
  tex,
  aspect,
  place,
  back = false,
}: {
  shell: Ring[];
  tex: THREE.Texture;
  aspect: number;
  place: NonNullable<GarmentFit["print"]>;
  back?: boolean;
}) {
  const geo = useMemo(() => decalGeometry(shell, place, aspect, back), [shell, place, aspect, back]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} renderOrder={2}>
      <meshToonMaterial
        map={tex}
        gradientMap={getToonGradient()}
        transparent
        alphaTest={0.08}
        side={THREE.DoubleSide}
        polygonOffset
        polygonOffsetFactor={-2}
      />
    </mesh>
  );
}

// ───────────────────────── Parte de arriba ─────────────────────────

function Collar({ ring, color }: { ring: Ring; color: string }) {
  // Cuello camisero: una banda alrededor del cuello, abierta adelante, con las dos puntas hacia abajo.
  const R = ring.rx + 0.006;
  return (
    <group position={[0, ring.y - 0.004, ring.z]}>
      <mesh scale={[1, 1, (ring.rz + 0.006) / R]} castShadow>
        <cylinderGeometry args={[R + 0.008, R, 0.034, 32, 1, true, 0.42, Math.PI * 2 - 0.84]} />
        <Mat color={color} double />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[s * 0.034, -0.012, ring.rz + 0.004]}
          rotation={[0.25, s * 0.35, s * 0.55]}
          castShadow
        >
          <boxGeometry args={[0.036, 0.04, 0.004]} />
          <Mat color={color} />
        </mesh>
      ))}
    </group>
  );
}

function Hood({ ring, color }: { ring: Ring; color: string }) {
  // Capucha bajada, apoyada en la espalda, con los dos cordones colgando adelante.
  return (
    <group>
      <mesh position={[0, ring.y + 0.02, ring.z - ring.rz * 0.85]} scale={[1, 0.62, 0.72]} castShadow>
        <sphereGeometry args={[0.115, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
        <Mat color={color} double />
      </mesh>
      <RingBand ring={{ ...ring, rx: ring.rx + 0.012, rz: ring.rz + 0.012 }} tube={0.012} color={shade(color, -0.04)} />
      {[-1, 1].map((s) => (
        <Limb key={s} a={[s * 0.028, ring.y - 0.005, ring.z + ring.rz + 0.008]} b={[s * 0.032, ring.y - 0.13, ring.z + ring.rz + 0.026]} r={0.0035}>
          <Mat color="#f2f2f2" />
        </Limb>
      ))}
    </group>
  );
}

/**
 * Tira de una musculosa, corpiño o malla (la derecha): sale del borde de adelante de la prenda,
 * pasa por arriba del hombro pegada al cuerpo y baja por la espalda. Sigue la curva del cuerpo
 * (una tira recta se hundiría adentro del hombro).
 */
function Strap({ sk, ring, r, color }: { sk: Skeleton; ring: Ring; r: number; color: string }) {
  const geo = useMemo(() => {
    const pts = strapPath(sk, ring, r).map((p) => new THREE.Vector3(...p));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, r, 8, false);
  }, [sk, ring, r]);
  return (
    <Geo geo={geo}>
      <Mat color={color} />
    </Geo>
  );
}

/**
 * Bolsillo canguro: un parche curvo que sigue la panza (uno plano sobresaldría por las puntas
 * y atravesaría la campera de encima), con el borde de arriba marcado.
 */
function KangarooPocket({ ring, color }: { ring: Ring; color: string }) {
  const R = ring.rx + 0.005;
  const half = Math.asin(Math.min(0.95, 0.1 / R));
  const s: V3 = [1, 1, (ring.rz + 0.005) / R];
  const edge = useMemo(() => {
    const pts = Array.from({ length: 13 }, (_, i) => {
      const t = -half + (2 * half * i) / 12;
      return new THREE.Vector3(R * Math.sin(t), 0.05, R * Math.cos(t));
    });
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.003, 6, false);
  }, [R, half]);
  return (
    <group position={[0, ring.y, ring.z]} scale={s}>
      <mesh castShadow>
        <cylinderGeometry args={[R, R, 0.1, 24, 1, true, -half, half * 2]} />
        <Mat color={color} double />
      </mesh>
      <Geo geo={edge}>
        <Mat color={shade(color, -0.08)} />
      </Geo>
    </group>
  );
}

/**
 * Parte de arriba. `shell` es su cuerpo ya calculado (topShell), por encima de lo que vaya abajo.
 */
export function TopGarment({
  sk,
  look,
  shell,
  color,
  showSleeves,
  decalFront,
  decalBack,
}: {
  sk: Skeleton;
  look: TopLook;
  shell: Ring[];
  color: string;
  showSleeves: boolean;
  decalFront: { tex: THREE.Texture; aspect: number } | null;
  decalBack: { tex: THREE.Texture; aspect: number } | null;
}) {
  const geo = useMemo(
    () => ringTube(shell, { segments: 48, capBottom: look.cut === "swimsuit" }),
    [shell, look.cut],
  );
  const topRing = shell[shell.length - 1];
  const band = shade(color, -0.05);
  const straps = look.neck === "straps" || look.cut === "bra" || look.cut === "swimsuit";
  const pocketRing = ringAt(shell, 1.0);
  return (
    <group>
      <Geo geo={geo}>
        <Mat color={color} striped={look.striped} double />
      </Geo>
      {decalFront && look.print?.fitFront?.print && (
        <PrintDecal shell={shell} tex={decalFront.tex} aspect={decalFront.aspect} place={look.print.fitFront.print} />
      )}
      {decalBack && look.print?.fitBack?.print && (
        <PrintDecal shell={shell} tex={decalBack.tex} aspect={decalBack.aspect} place={look.print.fitBack.print} back />
      )}
      {/* Ruedo: con elástico en buzos y sweaters */}
      {look.cut !== "swimsuit" && look.dress === "none" && (
        <RingBand ring={shell[0]} tube={topHemTube(look)} color={band} />
      )}
      {/* Cuello */}
      {!straps && look.neck === "round" && <RingBand ring={topRing} tube={0.007} color={band} />}
      {!straps && look.neck === "collar" && <Collar ring={topRing} color={color} />}
      {!straps && look.neck === "turtle" && (
        <Geo
          geo={axisLathe([0, topRing.y - 0.01, topRing.z], [0, 1.555, -0.008], [
            [0, topRing.rx + 0.004],
            [0.4, sk.neck.r + 0.016],
            [1, sk.neck.r + 0.014],
          ])}
        >
          <Mat color={color} double />
        </Geo>
      )}
      {!straps && look.neck === "hood" && <Hood ring={topRing} color={color} />}
      {/* Tiras (musculosa, corpiño, malla) que pasan por arriba de los hombros */}
      {straps &&
        ([1, -1] as const).map((side) => (
          <group key={side} scale={[side, 1, 1]}>
            <Strap
              sk={sk}
              ring={topRing}
              r={look.cut === "normal" || look.cut === "crop" ? 0.011 : 0.0072}
              color={color}
            />
          </group>
        ))}
      {/* Botones al frente (camisa, chomba) */}
      {look.buttons > 0 && (
        <>
          {Array.from({ length: look.buttons }, (_, i) => {
            const y = topRing.y - 0.05 - i * (look.buttons === 2 ? 0.035 : 0.105);
            const r = ringAt(shell, y);
            return (
              <mesh key={i} position={[0, y, r.z + r.rz + 0.003]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.0065, 0.0065, 0.003, 12]} />
                <Mat color={shade(color, look.buttons === 2 ? -0.15 : 0.15)} />
              </mesh>
            );
          })}
        </>
      )}
      {/* Bolsillo canguro */}
      {look.pocket && <KangarooPocket ring={pocketRing} color={shade(color, -0.03)} />}
      {/* Mangas */}
      {showSleeves && topCoversShoulders(look) && (
        <>
          {([1, -1] as const).map((side) => (
            <group key={side} scale={[side, 1, 1]}>
              <Sleeve
                sk={sk}
                length={look.sleeves === "long" ? "long" : "short"}
                inflate={sleeveInflate(look)}
                color={color}
                striped={look.striped}
                ribbed={look.ribbed}
              />
            </group>
          ))}
        </>
      )}
    </group>
  );
}

// ───────────────────────── Pollera (y la de los vestidos) ─────────────────────────

export function Skirt({ sk, from, length, color, striped }: { sk: Skeleton; from: number; length: SkirtLength; color: string; striped: boolean }) {
  const geo = useMemo(() => ringTube(skirtRings(sk.torso, from, length), { segments: 48 }), [sk.torso, from, length]);
  return (
    <Geo geo={geo}>
      <Mat color={color} striped={striped} double />
    </Geo>
  );
}

// ───────────────────────── Parte de abajo ─────────────────────────

/** Hasta dónde baja la pierna del pantalón por la pantorrilla (0 = rodilla, 1 = tobillo; 0 si no llega). */
export function pantCalfT(look: BottomLook): number {
  if (look.kind === "bermuda") return 0.08;
  if (look.kind === "pants") return look.cuffs ? 0.94 : 0.965;
  return 0;
}

/**
 * Si el pantalón va por encima de las botas: los sueltos sí; las calzas, los chupín y los jogging
 * (cerrados en el tobillo) van por adentro de la bota.
 */
export function pantsOverBoots(look: BottomLook | null | undefined): boolean {
  return Boolean(look && look.kind === "pants" && !look.tight && !look.cuffs);
}

/** Pierna del pantalón (la derecha). Sigue la forma de la pierna + holgura; los anchos se abren abajo. */
function PantLeg({ sk, look }: { sk: Skeleton; look: BottomLook }) {
  const l = useMemo(() => sk.leg(1), [sk]);
  const prof = useMemo(() => limbProfiles(sk), [sk]);
  const inf = bottomInflate(look);
  const thighT = look.kind === "shorts" ? 0.55 : 1;
  const calfT = pantCalfT(look);
  const thighEnd = useMemo(() => lerp3(l.hip, l.knee, thighT), [l, thighT]);
  const calfEnd = useMemo(() => lerp3(l.knee, l.ankle, calfT), [l, calfT]);
  const openR = (t: number) => profileAt(prof.thigh, t) + inf + 0.01;
  const upper = useMemo(
    () => axisLathe(l.hip, thighEnd, clothProfile(prof.thigh, inf, 0, thighT, thighT < 1 ? openR(thighT) : undefined)),
    // openR depende de prof e inf, que ya están en la lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [l, thighEnd, prof, inf, thighT],
  );
  const lower = useMemo(() => {
    if (calfT === 0) return null;
    const base = clothProfile(prof.calf, inf, 0, calfT);
    const kneeR = base[0][1];
    // Todas las formas arrancan en la rodilla con el mismo ancho que termina el muslo (sin escalón).
    // Pierna ancha: se va abriendo desde la rodilla. Con puño: se cierra en el tobillo.
    // Recta (no ajustada): cae derecha de la rodilla al tobillo, apenas más angosta abajo.
    const shaped = base.map(([t, r], i): [number, number] => {
      if (look.wide) return [t, r + 0.04 * t * t];
      if (look.cuffs && i === base.length - 1) return [t, profileAt(prof.calf, calfT) + 0.009];
      if (!look.tight && look.kind === "pants") return [t, Math.max(r, kneeR + (sk.legR.ankle + 0.024 - kneeR) * t)];
      if (look.kind === "bermuda") return [t, r + 0.008 * t];
      return [t, r];
    });
    return axisLathe(l.knee, calfEnd, shaped);
  }, [calfT, prof, inf, look.wide, look.cuffs, look.tight, look.kind, l, calfEnd, sk.legR.ankle]);
  const j = useMemo(() => jointBalls(sk, inf), [sk, inf]);
  const band = shade(look.color, -0.06);
  const hemR = lower ? undefined : openR(thighT);
  return (
    <group>
      <mesh position={j.hip.at} castShadow>
        <sphereGeometry args={[j.hip.r, 24, 18]} />
        <Mat color={look.color} striped={look.striped} />
      </mesh>
      <Geo geo={upper}>
        <Mat color={look.color} striped={look.striped} double />
      </Geo>
      {lower && (
        <>
          <mesh position={j.knee.at} castShadow>
            <sphereGeometry args={[j.knee.r, 24, 18]} />
            <Mat color={look.color} striped={look.striped} />
          </mesh>
          <Geo geo={lower}>
            <Mat color={look.color} striped={look.striped} double />
          </Geo>
        </>
      )}
      {hemR !== undefined && <Cuff from={l.hip} to={thighEnd} r={hemR} tube={0.005} color={band} />}
      {look.cuffs && lower && (
        <Cuff from={l.knee} to={calfEnd} r={profileAt(prof.calf, calfT) + 0.009} tube={0.01} color={band} />
      )}
    </group>
  );
}

export function BottomGarment({ sk, look, covered = false }: { sk: Skeleton; look: BottomLook; covered?: boolean }) {
  const brief = look.kind === "brief";
  const shell = useMemo(() => bottomShell(sk, look), [sk, look]);
  const geo = useMemo(() => ringTube(shell, { segments: 48, capBottom: true }), [shell]);
  if (look.kind === "skirt") {
    return (
      <group>
        <Skirt sk={sk} from={1.02} length={look.length} color={look.color} striped={look.striped} />
        {!covered && (
          <RingBand ring={ringAt(shellRings(sk.torso, 0.012, 0.9, 1.02), 1.02)} tube={0.008} color={shade(look.color, -0.06)} />
        )}
      </group>
    );
  }
  const topRing = shell[shell.length - 1];
  const front = ringAt(shell, 0.95);
  return (
    <group>
      <Geo geo={geo}>
        <Mat color={look.color} striped={look.striped} double />
      </Geo>
      {/* Cintura (si la remera la tapa, no se dibuja: asomaría a través de la tela) */}
      {!covered && <RingBand ring={topRing} tube={brief ? 0.005 : 0.009} color={shade(look.color, brief ? 0.1 : -0.06)} />}
      {/* Bragueta */}
      {!covered && !brief && !look.tight && !look.cuffs && (
        <Limb a={[0, 0.995, front.z + front.rz + 0.004]} b={[0, 0.9, ringAt(shell, 0.9).z + ringAt(shell, 0.9).rz + 0.002]} r={0.0022}>
          <Mat color={shade(look.color, -0.12)} />
        </Limb>
      )}
      {!brief &&
        ([1, -1] as const).map((side) => (
          <group key={side} scale={[side, 1, 1]}>
            <PantLeg sk={sk} look={look} />
          </group>
        ))}
    </group>
  );
}

// ───────────────────────── Abrigo ─────────────────────────

/** Abrigo. `shell` es su cuerpo ya calculado (outerShell), por encima de toda la ropa de abajo. */
export function OuterGarment({ sk, look, shell }: { sk: Skeleton; look: OuterLook; shell: Ring[] }) {
  const { sleeve } = outerFit(look.kind);
  const geo = useMemo(() => ringTube(shell, { segments: 48 }), [shell]);
  const topRing = shell[shell.length - 1];
  const dark = shade(look.color, -0.12);
  const quilts = look.kind === "puffer" ? [0.95, 1.05, 1.15, 1.25, 1.35] : [];
  return (
    <group>
      <Geo geo={geo}>
        <Mat color={look.color} striped={look.striped} double />
      </Geo>
      <RingBand ring={shell[0]} tube={0.006} color={dark} />
      {/* Cuello alto (o solapas en el saco) */}
      {look.kind === "blazer" ? (
        [-1, 1].map((s) => {
          const r = ringAt(shell, 1.32);
          return (
            <mesh key={s} position={[s * 0.042, 1.33, r.z + r.rz + 0.003]} rotation={[0.08, 0, -s * 0.38]} castShadow>
              <boxGeometry args={[0.032, 0.17, 0.005]} />
              <Mat color={shade(look.color, 0.06)} />
            </mesh>
          );
        })
      ) : (
        <Geo
          geo={axisLathe([0, topRing.y - 0.012, topRing.z], [0, topRing.y + 0.04, topRing.z - 0.004], [
            [0, topRing.rx + 0.004],
            [1, sk.neck.r + 0.03],
          ])}
        >
          <Mat color={look.color} double />
        </Geo>
      )}
      {/* Cierre o botones al frente */}
      {look.kind === "blazer" || look.kind === "coat"
        ? [1.1, 1.0, 0.9].slice(0, look.kind === "blazer" ? 2 : 3).flatMap((y, i) => {
            const r = ringAt(shell, y);
            const xs = look.kind === "coat" ? [-0.04, 0.04] : [0];
            return xs.map((x) => (
              <mesh key={`${i}${x}`} position={[x, y, r.z + r.rz * Math.cos(Math.asin(Math.min(0.9, x / r.rx))) + 0.004]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.009, 0.009, 0.004, 14]} />
                <Mat color={dark} />
              </mesh>
            ));
          })
        : (() => {
            const a = ringAt(shell, shell[0].y + 0.01);
            const b = ringAt(shell, topRing.y);
            return (
              <Limb a={[0, shell[0].y + 0.01, a.z + a.rz + 0.003]} b={[0, topRing.y, b.z + b.rz + 0.003]} r={0.0028}>
                <Mat color={dark} />
              </Limb>
            );
          })()}
      {/* Costuras del inflable */}
      {quilts.map((y) => (
        <RingBand key={y} ring={ringAt(shell, y)} tube={0.006} color={dark} />
      ))}
      {look.hood && <Hood ring={topRing} color={look.color} />}
      {look.kind !== "vest" &&
        ([1, -1] as const).map((side) => (
          <group key={side} scale={[side, 1, 1]}>
            <Sleeve sk={sk} length="long" inflate={sleeve} color={look.color} striped={look.striped} ribbed={look.kind === "puffer"} />
          </group>
        ))}
    </group>
  );
}

// ───────────────────────── Calzado ─────────────────────────

/** Cuánto se levanta el cuerpo con tacos, y cuánto se inclina el pie. */
export const HEEL_LIFT = 0.055;
export const HEEL_PITCH = 0.33;

/** Calzado del pie derecho (va en el tobillo; el izquierdo es el espejo). */
export function Shoe({ look, skin }: { look: ShoesLook; skin: string }) {
  const upperGeo = useMemo(() => {
    const extra = look.kind === "slipper" ? 0.014 : look.kind === "formal" || look.kind === "heel" ? 0.005 : 0.0075;
    const toe = look.kind === "formal" || look.kind === "heel" ? 0.02 : 0.012;
    return ringTube(footRings(extra, toe), { axis: "z", segments: 32, capBottom: true, capTop: true });
  }, [look.kind]);
  const soleGeo = useMemo(() => {
    const thick = look.kind === "sneaker" ? 0.0095 : look.kind === "boot" || look.kind === "tallboot" ? 0.01 : 0.005;
    const rings = footRings(0.012, 0.014).map((r) => ({ ...r, rz: thick, z: SOLE_Y + thick * 0.6 }));
    return ringTube(rings, { axis: "z", segments: 32, capBottom: true, capTop: true });
  }, [look.kind]);
  const boot = look.kind === "boot" || look.kind === "tallboot";
  const soleColor =
    look.kind === "sneaker" ? "#f4f2ee" : look.kind === "boot" || look.kind === "tallboot" ? "#2b2622" : shade(look.color, -0.25);

  if (look.kind === "sandal") {
    // Sandalia u ojota: se ve el pie, con suela y tiras.
    return (
      <group>
        <Foot skin={skin} />
        <Geo geo={soleGeo}>
          <Mat color={look.color} />
        </Geo>
        {[0.02, 0.1].map((z) => (
          <mesh key={z} position={[0, SOLE_Y + 0.01, z]} rotation={[0, Math.PI / 2, 0]} scale={[1, 1.15, 1]}>
            <torusGeometry args={[0.042, 0.005, 8, 24, Math.PI]} />
            <Mat color={look.color} />
          </mesh>
        ))}
      </group>
    );
  }
  return (
    <group>
      <Geo geo={upperGeo}>
        <Mat color={look.color} />
      </Geo>
      <Geo geo={soleGeo}>
        <Mat color={soleColor} />
      </Geo>
      {/* Boca del calzado alrededor del tobillo */}
      {!boot && (
        <mesh position={[0, -0.012, -0.02]} rotation={[Math.PI / 2 + 0.2, 0, 0]} scale={[1, 1.2, 1]}>
          <torusGeometry args={[0.037, 0.007, 8, 28]} />
          <Mat color={shade(look.color, -0.15)} />
        </mesh>
      )}
      {/* Cordones de las zapatillas */}
      {look.kind === "sneaker" &&
        [0.012, 0.035, 0.058].map((z, i) => (
          <mesh key={z} position={[0, SOLE_Y + 0.088 - i * 0.012, z]} rotation={[0, 0, Math.PI / 2]}>
            <capsuleGeometry args={[0.0035, 0.034, 4, 8]} />
            <Mat color="#fafafa" />
          </mesh>
        ))}
      {/* Taco */}
      {look.kind === "heel" && (
        <mesh position={[0, SOLE_Y - 0.032, -0.052]} castShadow>
          <cylinderGeometry args={[0.012, 0.005, 0.078, 12]} />
          <Mat color={shade(look.color, -0.2)} />
        </mesh>
      )}
      {look.kind === "formal" && (
        <mesh position={[0, SOLE_Y + 0.008, -0.05]} castShadow>
          <boxGeometry args={[0.05, 0.016, 0.03]} />
          <Mat color={soleColor} />
        </mesh>
      )}
    </group>
  );
}

/**
 * Caña de la bota (la derecha). Va sobre el eje real de la pantorrilla —no sobre el pie— y sigue su
 * forma con holgura, así nunca la atraviesa, aunque la pierna esté un poco inclinada.
 */
export function BootShaft({ sk, look, underHem }: { sk: Skeleton; look: ShoesLook; underHem?: number }) {
  const tall = look.kind === "tallboot";
  const l = useMemo(() => sk.leg(1), [sk]);
  const prof = useMemo(() => limbProfiles(sk), [sk]);
  // Hasta dónde sube, medido desde la rodilla (0) al tobillo (1): la alta, hasta debajo de la rodilla.
  // Con un pantalón suelto encima, solo se ve debajo de la botamanga: la caña termina adentro de ella.
  const tTop = underHem !== undefined ? Math.max(tall ? 0.17 : 0.62, underHem - 0.06) : tall ? 0.17 : 0.62;
  const room = tall ? 0.016 : 0.018;
  const { geo, top, topR } = useMemo(() => {
    const k = new THREE.Vector3(...l.knee);
    const an = new THREE.Vector3(...l.ankle);
    const leg = an.clone().sub(k);
    // Abajo sigue un poco más allá del tobillo (adentro del calzado), sobre el mismo eje.
    const bottom = an.clone().add(leg.clone().setLength(0.045));
    const topV = k.clone().add(leg.clone().multiplyScalar(tTop));
    const n = 10;
    const profile: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const sN = i / n;
      const p = bottom.clone().lerp(topV, sN);
      const t = Math.min(1, Math.max(0, p.clone().sub(k).dot(leg) / leg.lengthSq()));
      profile.push([sN, profileAt(prof.calf, t) + room + 0.012 * (1 - sN) ** 3]);
    }
    const b: V3 = [bottom.x, bottom.y, bottom.z];
    const tp: V3 = [topV.x, topV.y, topV.z];
    return { geo: axisLathe(b, tp, profile), top: tp, topR: profile[n][1] };
  }, [l, prof, tTop, room]);
  return (
    <group>
      <Geo geo={geo}>
        <Mat color={look.color} double />
      </Geo>
      {/* Borde de arriba de la caña (queda tapado si va adentro del pantalón) */}
      {underHem === undefined && <Cuff from={l.ankle} to={top} r={topR} tube={0.004} color={shade(look.color, -0.12)} />}
    </group>
  );
}

// ───────────────────────── Accesorios ─────────────────────────

export function Accessory({ look }: { look: AccessoryLook }) {
  const c = look.color;
  if (look.kind === "cap")
    return (
      <group position={[0, HEAD_Y + 0.025, -0.004]}>
        <mesh scale={[1.04, 0.82, 1.06]} castShadow>
          <sphereGeometry args={[HEAD_R * 1.04, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <Mat color={c} double />
        </mesh>
        <mesh position={[0, HEAD_R * 0.86, 0]}>
          <sphereGeometry args={[0.011, 10, 8]} />
          <Mat color={shade(c, -0.1)} />
        </mesh>
        {/* Visera */}
        <mesh position={[0, 0.004, HEAD_R * 0.98]} rotation={[0.2, 0, 0]} scale={[1, 1, 0.9]} castShadow>
          <cylinderGeometry args={[0.095, 0.095, 0.01, 28, 1, false, -Math.PI / 2, Math.PI]} />
          <Mat color={shade(c, -0.04)} />
        </mesh>
      </group>
    );
  if (look.kind === "beanie")
    return (
      <group position={[0, HEAD_Y + 0.03, -0.004]}>
        <mesh scale={[1.06, 0.92, 1.06]} castShadow>
          <sphereGeometry args={[HEAD_R * 1.04, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
          <Mat color={c} double />
        </mesh>
        <mesh position={[0, -0.006, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1.02, 1]}>
          <torusGeometry args={[HEAD_R * 1.06, 0.016, 10, 40]} />
          <Mat color={shade(c, -0.06)} />
        </mesh>
      </group>
    );
  if (look.kind === "hat")
    return (
      <group position={[0, HEAD_Y + 0.115, -0.004]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.11, 0.138, 0.11, 28]} />
          <Mat color={c} />
        </mesh>
        <mesh position={[0, -0.05, 0]} rotation={[-0.06, 0, 0]} castShadow>
          <cylinderGeometry args={[0.24, 0.24, 0.01, 40]} />
          <Mat color={c} />
        </mesh>
        <mesh position={[0, -0.035, 0]}>
          <cylinderGeometry args={[0.137, 0.137, 0.022, 28]} />
          <Mat color={shade(c, -0.15)} />
        </mesh>
      </group>
    );
  if (look.kind === "scarf")
    return (
      <group>
        <mesh position={[0, 1.5, -0.008]} rotation={[Math.PI / 2 - 0.12, 0, 0]} scale={[1, 0.86, 1]} castShadow>
          <torusGeometry args={[0.088, 0.036, 14, 36]} />
          <Mat color={c} />
        </mesh>
        {/* Las dos puntas colgando adelante */}
        <Limb a={[0.045, 1.49, 0.085]} b={[0.07, 1.22, 0.135]} r={0.026}>
          <Mat color={c} />
        </Limb>
        <Limb a={[-0.02, 1.49, 0.088]} b={[-0.035, 1.27, 0.13]} r={0.024}>
          <Mat color={shade(c, -0.05)} />
        </Limb>
      </group>
    );
  return null;
}

