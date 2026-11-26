"use client";

// Parte de abajo del avatar: pantalón, jean, jogging, short, bermuda, calza, pollera y ropa
// interior. Cada tipo con sus detalles: cintura con presillas y botón o elástica con cordón,
// bragueta, bolsillos (de jean, en diagonal, en la costura del costado, cargo), franjas, raya del
// pantalón, el logo y cómo termina la pierna (ruedo, botamanga doblada, deshilachado, elástico, tajo).
// El largo y el ancho de cada short salen de su foto (o de lo que vio la IA) y de su talle. Cada
// pantalón tiene su corte (la tela cae derecha, no se pega a la rodilla), su tiro y su largo.

import { useCallback, useMemo } from "react";
import * as THREE from "three";
import type { BottomLook } from "@/lib/look";
import {
  bottomInflate,
  bottomLegAxis,
  bottomLegT,
  bottomThighProfile,
  pantCalfT,
  pantLeg,
  clothProfile,
  jointBalls,
  limbProfiles,
  profileAt,
  ringAt,
  shellRings,
  type Ring,
  type Skeleton,
  type V3,
} from "@/lib/skeleton";
import { Geo } from "./Body";
import { Mat, REPEAT, shade, type Fill } from "./materials";
import { Button, Cuff, DecalMat, Line, Piece, PrintDecal, RingBand, lerp3, shellNormal, type Decal } from "./parts";
import {
  axisLathe,
  fringeGeometry,
  limbFrame,
  limbHemPatch,
  limbPatch,
  limbPoint,
  phiAtX,
  ringTube,
  shellPatch,
  shellPoint,
} from "./shapes";
import { Skirt } from "./Tops";


export { pantCalfT };

/**
 * Si el pantalón va por encima de las botas: los sueltos sí; las calzas, los chupín y los jogging
 * (cerrados en el tobillo) van por adentro de la bota.
 */
export function pantsOverBoots(look: BottomLook | null | undefined): boolean {
  return Boolean(look && look.kind === "pants" && !look.tight && !look.cuffs && look.cut !== "chupin");
}

/** Recorta un perfil (k de 0 a 1) entre k0 y k1 y lo vuelve a llevar de 0 a 1. */
function cutProfile(p: [number, number][], k0: number, k1: number): [number, number][] {
  const ks = [k0, ...p.map((q) => q[0]).filter((k) => k > k0 + 1e-6 && k < k1 - 1e-6), k1];
  return ks.map((k) => [(k - k0) / (k1 - k0), profileAt(p, k)]);
}

const dist = (a: V3, b: V3) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);

/**
 * Tajo al costado (shorts de correr): cuánto antes termina la pierna en el costado de afuera, en
 * fracción del muslo (0 si no tiene).
 */
function legNotch(sk: Skeleton, look: BottomLook): number {
  if (look.kind !== "shorts" || look.hem !== "tajo") return 0;
  const l = sk.leg(1);
  return Math.min(0.045 / dist(l.hip, l.knee), bottomLegT(look) * 0.35);
}

/** Dónde termina el short en cada ángulo: con tajo, sube en forma de arco en el costado de afuera (+π/2). */
function notchedEnd(tEnd: number, notch: number) {
  return (theta: number) => {
    const d = Math.abs(Math.atan2(Math.sin(theta - Math.PI / 2), Math.cos(theta - Math.PI / 2)));
    return d < 0.6 ? tEnd - notch * (0.5 + 0.5 * Math.cos((Math.PI * d) / 0.6)) : tEnd;
  };
}

type HemStyle = BottomLook["hem"];

/**
 * Terminación de la pierna: ruedo simple con su costura, botamanga doblada, deshilachado con
 * flecos, elástico, o el ribete del tajo. `R(t)` es el radio de la tela a lo largo del tramo (a→b).
 */
function Hem({
  a,
  b,
  t1,
  R,
  style,
  look,
  end,
}: {
  a: V3;
  b: V3;
  t1: number;
  R: (t: number) => number;
  style: HemStyle;
  look: BottomLook;
  /** Borde de abajo según el ángulo (tajo). */
  end?: (theta: number) => number;
}) {
  const len = dist(a, b);
  const parts = useMemo(() => {
    const f = limbFrame(a, b);
    const dt = (m: number) => Math.min(m / len, t1 * 0.4);
    const ring = (t: number | ((th: number) => number), off: number) =>
      Array.from({ length: 49 }, (_, i) => {
        const th = -Math.PI + (2 * Math.PI * i) / 48;
        const tt = typeof t === "number" ? t : t(th);
        return limbPoint(f, tt, th, R(tt) + off);
      });
    const band = (tA: number, off: number) => limbPatch(f, tA, t1, -Math.PI, Math.PI, (t) => R(t) + off, 40, 3);
    const jean = look.pockets === "jean";
    const stitch = jean ? look.trim : shade(look.color, -0.13);
    switch (style) {
      case "doblado": {
        // Botamanga doblada hacia afuera: se ve el revés de la tela (en el jean, más clarito).
        const tA = t1 - dt(0.034);
        const color = jean ? shade(look.color, 0.1) : shade(look.color, -0.035);
        return {
          bands: [{ geo: band(tA, 0.0045), color }],
          lines: [
            { pts: ring(tA, 0.0045), r: 0.0026, color: shade(color, -0.05) },
            { pts: ring(t1, 0.0045), r: 0.003, color },
            { pts: ring(tA + dt(0.006), 0.0058), r: 0.0006, color: stitch },
          ],
          fringe: null,
        };
      }
      case "deshilachado": {
        // Ruedo cortado: borde crudo y flecos clarito (en el jean, hilos casi blancos).
        const fray = `#${new THREE.Color(look.color).lerp(new THREE.Color("#f4f1ea"), jean ? 0.6 : 0.3).getHexString()}`;
        return {
          bands: [],
          lines: [{ pts: ring(t1, 0.0006), r: 0.0018, color: fray }],
          fringe: { geo: fringeGeometry(f, t1, R(t1)), color: fray },
        };
      }
      case "elastico": {
        // Puño elástico: una banda fruncida (en el bóxer y la calza, el elástico finito de otro color).
        // El puño del jogging es alto (unos 4 cm); el del short, más bajo; el de la calza, finito.
        const tA = t1 - dt(look.tight ? 0.012 : look.kind === "pants" ? 0.04 : look.kind === "shorts" ? 0.02 : 0.012);
        const color = look.tight ? look.trim : shade(look.color, -0.05);
        return {
          bands: [{ geo: band(tA, 0.0016), color }],
          lines: [
            { pts: ring(tA, 0.0016), r: 0.0012, color: shade(color, -0.05) },
            { pts: ring(t1, 0.0016), r: 0.0022, color },
          ],
          fringe: null,
        };
      }
      case "tajo":
        // Ribete que sigue el borde y sube en el tajo del costado.
        return { bands: [], lines: [{ pts: ring(end ?? t1, 0.0012), r: 0.0026, color: look.trim }], fringe: null };
      default:
        // Ruedo simple: el borde y la costura de arriba (pespunte). En el jean el borde es de la misma
        // tela (el hilo naranja va en la costura).
        return {
          bands: [],
          lines: [
            { pts: ring(t1, 0.0012), r: look.tight ? 0.003 : 0.0042, color: jean ? shade(look.color, -0.04) : look.trim },
            { pts: ring(t1 - dt(0.014), 0.0011), r: 0.0007, color: stitch },
          ],
          fringe: null,
        };
    }
  }, [a, b, len, t1, R, style, look, end]);
  return (
    <>
      {parts.bands.map((p, i) => (
        <Geo key={i} geo={p.geo}>
          <Mat color={p.color} double />
        </Geo>
      ))}
      {parts.lines.map((p, i) => (
        <Line key={i} points={p.pts} r={p.r} color={p.color} />
      ))}
      {parts.fringe && (
        <Geo geo={parts.fringe.geo} cast={false}>
          <Mat color={parts.fringe.color} double />
        </Geo>
      )}
    </>
  );
}

/** Pierna del pantalón (la derecha). Sigue la forma de la pierna + holgura; los anchos se abren abajo. */
function PantLeg({ sk, look, fill }: { sk: Skeleton; look: BottomLook; fill: Fill }) {
  // El eje de la tela (en un short ancho o un palazzo, corrido hacia afuera).
  const axis = useMemo(() => bottomLegAxis(sk, look, 1), [sk, look]);
  const prof = useMemo(() => limbProfiles(sk), [sk]);
  const inf = bottomInflate(look);
  const thighT = bottomLegT(look);
  const calfT = pantCalfT(look);
  // El pantalón tiene su corte (la tela cae derecha, no se pega a la rodilla); el short y la bermuda, el suyo.
  const pant = useMemo(() => (look.kind === "pants" ? pantLeg(sk, look) : null), [sk, look]);
  const thigh = useMemo(() => pant?.thigh ?? bottomThighProfile(sk, look), [pant, sk, look]);
  const notch = legNotch(sk, look);
  const thighEnd = useMemo(() => lerp3(axis.hip, axis.knee, thighT), [axis, thighT]);
  const calfEnd = useMemo(() => lerp3(axis.knee, axis.ankle, calfT), [axis, calfT]);
  // Con tajo, la pierna torneada llega hasta donde empieza el tajo y el resto es un tramo recortado.
  const upper = useMemo(() => {
    if (!notch) return axisLathe(axis.hip, thighEnd, thigh);
    return axisLathe(axis.hip, lerp3(axis.hip, axis.knee, thighT - notch), cutProfile(thigh, 0, (thighT - notch) / thighT));
  }, [axis, thighEnd, thigh, notch, thighT]);
  const R = useCallback((t: number) => profileAt(thigh, t / thighT), [thigh, thighT]);
  const end = useMemo(() => (notch ? notchedEnd(thighT, notch) : undefined), [notch, thighT]);
  const notchGeo = useMemo(
    () => (end ? limbHemPatch(limbFrame(axis.hip, axis.knee), thighT - notch, end, R, 48, 4) : null),
    [end, axis, thighT, notch, R],
  );
  // La bermuda sigue abriéndose un poco debajo de la rodilla, con el mismo ancho donde termina el muslo.
  const kneeExtra = thigh[thigh.length - 1][1] - (profileAt(prof.thigh, 1) + inf);
  const lowerProfile = useMemo(() => {
    if (calfT === 0) return null;
    if (pant) return pant.calf;
    const base = clothProfile(prof.calf, inf, 0, calfT);
    const kneeR = base[0][1];
    // Todas las formas arrancan en la rodilla con el mismo ancho que termina el muslo (sin escalón).
    return base.map(([t, r], i): [number, number] => {
      if (look.wide) return [t, r + 0.04 * t * t];
      if (look.cuffs && i === base.length - 1) return [t, profileAt(prof.calf, calfT) + 0.009];
      if (!look.tight && look.kind === "pants") return [t, Math.max(r, kneeR + (sk.legR.ankle + 0.024 - kneeR) * t)];
      if (look.kind === "bermuda") return [t, r + Math.max(0, kneeExtra) + 0.008 * t];
      return [t, r];
    });
  }, [calfT, pant, prof, inf, look.wide, look.cuffs, look.tight, look.kind, sk.legR.ankle, kneeExtra]);
  const kneeAt = axis.knee;
  const lower = useMemo(() => (lowerProfile ? axisLathe(kneeAt, calfEnd, lowerProfile) : null), [lowerProfile, kneeAt, calfEnd]);
  const lowerR = useCallback((t: number) => (lowerProfile ? profileAt(lowerProfile, t / calfT) : 0), [lowerProfile, calfT]);
  // Adentro de la boca de la pierna: un forro oscuro (la sombra de adentro), así se ve que es una
  // pierna abierta y no una pollera.
  const lining = useMemo(() => {
    const inset = (p: [number, number][]) => p.map(([k, r]): [number, number] => [k, Math.max(0.01, r - 0.0014)]);
    if (lowerProfile && calfT > 0) {
      const k0 = 0.65;
      return axisLathe(lerp3(kneeAt, calfEnd, k0), calfEnd, inset(cutProfile(lowerProfile, k0, 1)));
    }
    const tTop = thighT - notch;
    const k0 = 0.45;
    return axisLathe(lerp3(axis.hip, axis.knee, tTop * k0), lerp3(axis.hip, axis.knee, tTop), inset(cutProfile(thigh, k0 * (tTop / thighT), tTop / thighT)));
  }, [lowerProfile, calfT, kneeAt, calfEnd, thighT, notch, axis, thigh]);
  const j = useMemo(() => jointBalls(sk, inf), [sk, inf]);
  // Bolas de la cadera y la rodilla del tamaño de la tela (en un pantalón suelto, más grandes que la pierna).
  const hipR = Math.min(Math.max(j.hip.r, pant ? thigh[0][1] : 0), j.hip.r + 0.01);
  const kneeR = pant ? Math.max(j.knee.r, thigh[thigh.length - 1][1]) : j.knee.r + Math.max(0, look.kind === "bermuda" ? kneeExtra : 0);
  // Quiebre: el pantalón largo (no los ajustados ni los de puño) se arruga un poco al llegar al zapato.
  const breakFolds = useMemo(() => {
    if (!pant || !lowerProfile || calfT < 0.93 || look.cuffs || look.cut === "chupin" || look.cut === "calza") return [];
    const f = limbFrame(axis.knee, axis.ankle);
    return [0.86, 0.93].map((u, k) =>
      Array.from({ length: 13 }, (_, i) => {
        const th = -1.1 + (2.2 * i) / 12;
        const t = (u + 0.012 * Math.sin(th * 3 + k)) * calfT;
        return limbPoint(f, t, th, profileAt(lowerProfile, t / calfT) + 0.0012);
      }),
    );
  }, [pant, lowerProfile, calfT, look.cuffs, look.cut, axis]);
  return (
    <group>
      <mesh position={j.hip.at} castShadow>
        <sphereGeometry args={[hipR, 24, 18]} />
        <Mat color={look.color} pattern={fill} repeat={REPEAT.ball} />
      </mesh>
      <Geo geo={upper}>
        <Mat color={look.color} pattern={fill} repeat={REPEAT.leg} double />
      </Geo>
      <Geo geo={lining} cast={false}>
        <Mat color={shade(look.color, -0.32)} inside />
      </Geo>
      {notchGeo && (
        <Geo geo={notchGeo}>
          <Mat color={look.color} pattern={fill} repeat={REPEAT.leg} double />
        </Geo>
      )}
      {lower && (
        <>
          <mesh position={axis.knee} castShadow>
            <sphereGeometry args={[kneeR, 24, 18]} />
            <Mat color={look.color} pattern={fill} repeat={REPEAT.ball} />
          </mesh>
          <Geo geo={lower}>
            <Mat color={look.color} pattern={fill} repeat={REPEAT.leg} double />
          </Geo>
        </>
      )}
      {/* Terminación del short (y de la bermuda, debajo de la rodilla) */}
      {calfT === 0 && <Hem a={axis.hip} b={axis.knee} t1={thighT} R={R} style={look.hem} look={look} end={end} />}
      {look.kind === "bermuda" && !look.cuffs && (
        <Hem a={axis.knee} b={axis.ankle} t1={calfT} R={lowerR} style={look.hem === "tajo" ? "simple" : look.hem} look={look} />
      )}
      {look.kind === "bermuda" && look.cuffs && lower && (
        <Cuff from={axis.knee} to={calfEnd} r={profileAt(prof.calf, calfT) + 0.009} tube={0.01} color={look.trim} />
      )}
      {/* Botamanga del pantalón: ruedo, puño elástico (jogging, babucha), doblada o deshilachada */}
      {pant && lower && (
        <Hem
          a={axis.knee}
          b={axis.ankle}
          t1={calfT}
          R={lowerR}
          style={look.cuffs ? "elastico" : look.hem === "tajo" ? "simple" : look.hem}
          look={look}
        />
      )}
      {breakFolds.map((pts, i) => (
        <Line key={i} points={pts} r={0.0012} color={shade(look.color, -0.045)} />
      ))}
    </group>
  );
}

// ───────────────────────── Cintura ─────────────────────────

/** Cintura de jean o pantalón: pretina, presillas, botón y bragueta con su costura en J. */
function BeltWaist({ shell, look }: { shell: Ring[]; look: BottomLook }) {
  // Todo se mide desde el borde de arriba (la cintura sube o baja según el tiro).
  const y1 = shell[shell.length - 1].y;
  const y0 = y1 - 0.038;
  const band = useMemo(() => shellPatch(shell, y0, y1, () => [-Math.PI, Math.PI], 0.0014, 48, 2), [shell, y0, y1]);
  const loops = useMemo(
    () => [-2.55, -1.35, -0.55, 0.55, 1.35, 2.55, Math.PI].map((p) => shellPatch(shell, y0 - 0.004, y1 + 0.002, () => [p - 0.045, p + 0.045], 0.0028, 2, 2)),
    [shell, y0, y1],
  );
  const seam = useMemo(() => Array.from({ length: 25 }, (_, i) => shellPoint(shell, y0, -Math.PI + (2 * Math.PI * i) / 24, 0.0022)), [shell, y0]);
  // Bragueta: el borde en el medio y la costura en J del lado izquierdo de quien lo usa.
  const fly = useMemo(() => {
    const edge = [y0, y1 - 0.08, y1 - 0.115].map((y) => shellPoint(shell, y, 0, 0.0018));
    const j: THREE.Vector3[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const y = y0 - 0.002 - t * 0.08;
      const x = t < 0.7 ? 0.026 : 0.026 * Math.cos(((t - 0.7) / 0.3) * (Math.PI / 2));
      j.push(shellPoint(shell, y, phiAtX(shell, y, x), 0.0018));
    }
    return { edge, j };
  }, [shell, y0, y1]);
  const metal = look.pockets === "jean" ? "#b0894f" : shade(look.color, -0.2);
  return (
    <>
      <Piece geo={band} color={shade(look.color, -0.02)} />
      {loops.map((g, i) => (
        <Piece key={i} geo={g} color={shade(look.color, -0.05)} />
      ))}
      <Line points={seam} r={0.0009} color={look.trim} />
      <Button at={shellPoint(shell, y1 - 0.018, 0, 0.003)} normal={shellNormal(shell, y1 - 0.018, 0)} r={0.0065} color={metal} />
      {look.fly && (
        <>
          <Line points={fly.edge} r={0.0011} color={shade(look.color, -0.15)} />
          <Line points={fly.j} r={0.0009} color={look.trim} />
        </>
      )}
    </>
  );
}

/** Cintura elástica: banda ancha con costuras y, si tiene, el cordón con sus puntas. */
function ElasticWaist({ shell, look, cords }: { shell: Ring[]; look: BottomLook; cords: boolean }) {
  const y1 = shell[shell.length - 1].y;
  const y0 = y1 - (look.tight ? 0.045 : 0.052);
  const band = useMemo(() => shellPatch(shell, y0, y1, () => [-Math.PI, Math.PI], 0.0018, 48, 2), [shell, y0, y1]);
  const strings = useMemo(
    () =>
      cords && look.drawstring
        ? [-1, 1].map((s) =>
            Array.from({ length: 6 }, (_, i) => {
              const y = y1 - 0.02 - (0.075 * i) / 5;
              return shellPoint(shell, y, phiAtX(shell, y, s * (0.011 + 0.012 * (i / 5))), 0.0042);
            }),
          )
        : [],
    [shell, cords, look.drawstring, y1],
  );
  // El elástico de la ropa interior y las calzas suele ser de otro color; en el resto, el de la tela
  // (los detalles de color, como las franjas o el ribete, no van en la cintura).
  const bandColor = look.tight || look.legWidth <= 0.003 ? look.trim : shade(look.color, -0.05);
  return (
    <>
      <Piece geo={band} color={bandColor} />
      <RingBand ring={ringAt(shell, y1)} tube={0.0035} color={shade(bandColor, -0.06)} />
      {strings.map((pts, i) => (
        <group key={i}>
          <Line points={pts} r={0.0027} color="#f1f1ee" />
          <mesh position={pts[pts.length - 1]}>
            <capsuleGeometry args={[0.0034, 0.011, 4, 8]} />
            <Mat color="#cfcfcc" />
          </mesh>
        </group>
      ))}
    </>
  );
}

/**
 * Costura del tiro: adelante, desde donde termina la bragueta (o la cintura) hasta la
 * entrepierna, y atrás por el medio. Junto con la "V" entre las piernas, es lo que hace que un
 * short no se vea como una pollera.
 */
function CrotchSeams({ shell, look, crotchY }: { shell: Ring[]; look: BottomLook; crotchY: number }) {
  const lines = useMemo(() => {
    const wt = shell[shell.length - 1].y;
    const frontTop = look.fly ? wt - 0.115 : wt - 0.055;
    const seam = (phi: number, top: number) =>
      Array.from({ length: 8 }, (_, i) => shellPoint(shell, top + (crotchY + 0.004 - top) * (i / 7), phi, 0.0017));
    return [seam(0, frontTop), seam(Math.PI, wt - 0.045)];
  }, [shell, look.fly, crotchY]);
  const color = look.pockets === "jean" ? look.trim : shade(look.color, -0.1);
  return (
    <>
      {lines.map((pts, i) => (
        <Line key={i} points={pts} r={0.0009} color={color} />
      ))}
    </>
  );
}

// ───────────────────────── Bolsillos ─────────────────────────

/**
 * Bolsillos de adelante: los del jean (curvos, con el monedero y remaches), en diagonal (chino,
 * cargo) o en la costura del costado (deportivo, jogging). La boca del bolsillo se marca con una
 * línea oscura (la sombra de la abertura), una clarita (el borde de la tela) y la vista un poco
 * más oscura, para que se lea como un bolsillo de verdad.
 */
function FrontPockets({ shell, look }: { shell: Ring[]; look: BottomLook }) {
  const jean = look.pockets === "jean";
  const side = look.pockets === "side";
  const parts = useMemo(() => {
    const wt = shell[shell.length - 1].y;
    const openings: THREE.Vector3[][] = [];
    const lips: THREE.Vector3[][] = [];
    const facings: THREE.BufferGeometry[] = [];
    const rivets: { at: THREE.Vector3; n: THREE.Vector3 }[] = [];
    const extra: THREE.Vector3[][] = [];
    for (const s of [-1, 1]) {
      // Cada bolsillo es una curva de (x, y): de la cintura hacia el costado.
      const curve = (t: number): [number, number] => {
        if (side) {
          // En la costura del costado: casi vertical, apenas hacia adelante arriba.
          const y = wt - 0.052 - 0.09 * t;
          return [ringAt(shell, y).rx * (0.9 + 0.06 * t), y];
        }
        const y = wt - 0.038 - (jean ? 0.052 : 0.075) * t;
        const rx = ringAt(shell, y).rx;
        return [jean ? 0.062 + (rx * 0.9 - 0.062) * Math.sin((t * Math.PI) / 2) : 0.085 + (rx * 0.94 - 0.085) * t, y];
      };
      const at = (t: number, off: number, dx = 0) => {
        const [x, y] = curve(t);
        return shellPoint(shell, y, phiAtX(shell, y, s * (x + dx)), off);
      };
      const n = 10;
      openings.push(Array.from({ length: n + 1 }, (_, i) => at(i / n, 0.0021)));
      // El borde de la tela, del lado de adelante de la abertura.
      lips.push(Array.from({ length: n + 1 }, (_, i) => at(i / n, 0.0026, side ? -0.006 : -0.005)));
      if (!side) {
        // La vista (la tela del bolsillo que se asoma), entre la abertura y el costado.
        const [, yTop] = curve(0);
        const [, yBot] = curve(1);
        facings.push(
          shellPatch(
            shell,
            yBot,
            yTop,
            (y) => {
              const t = Math.min(1, Math.max(0, (yTop - y) / (yTop - yBot)));
              const a = phiAtX(shell, y, s * curve(t)[0]);
              const b = s * (Math.PI / 2);
              return [Math.min(a, b), Math.max(a, b)];
            },
            0.0015,
            6,
            5,
          ),
        );
      }
      if (jean) {
        // Remaches de cobre en las puntas de la boca del bolsillo.
        for (const t of [0, 1]) {
          const [x, y] = curve(t);
          const phi = phiAtX(shell, y - 0.004, s * (x + (t === 0 ? 0.004 : -0.002)));
          rivets.push({ at: shellPoint(shell, y - 0.004, phi, 0.0028), n: shellNormal(shell, y - 0.004, phi) });
        }
      }
    }
    if (jean) {
      // Monedero, del lado derecho de quien lo usa (−x).
      extra.push(
        [
          [-0.052, wt - 0.042],
          [-0.052, wt - 0.068],
          [-0.088, wt - 0.068],
          [-0.088, wt - 0.042],
        ].map(([x, y]) => shellPoint(shell, y, phiAtX(shell, y, x), 0.0021)),
      );
    }
    return { openings, lips, facings, rivets, extra };
  }, [shell, jean, side]);
  const dark = shade(look.color, -0.22);
  const light = shade(look.color, 0.1);
  return (
    <>
      {parts.facings.map((g, i) => (
        <Piece key={i} geo={g} color={shade(look.color, -0.018)} />
      ))}
      {parts.openings.map((pts, i) => (
        <Line key={i} points={pts} r={0.0016} color={dark} />
      ))}
      {parts.lips.map((pts, i) => (
        <Line key={i} points={pts} r={jean ? 0.0008 : 0.0009} color={jean ? look.trim : light} />
      ))}
      {parts.extra.map((pts, i) => (
        <Line key={i} points={pts} r={0.001} color={look.trim} />
      ))}
      {parts.rivets.map((r, i) => (
        <Button key={i} at={r.at} normal={r.n} r={0.0026} color="#b0894f" />
      ))}
    </>
  );
}

/** Bolsillos de atrás: parches con costura (jean) o una ranura con botón (pantalón, chino). */
function BackPockets({ shell, look }: { shell: Ring[]; look: BottomLook }) {
  const jean = look.pockets === "jean";
  // Desde la cintura: en el jean, debajo del canesú (la costura en V de atrás).
  const wt = shell[shell.length - 1].y;
  const top = wt - (jean ? 0.064 : 0.052);
  const bot = top - 0.068;
  const parts = useMemo(
    () =>
      [-1, 1].map((s) => {
        const xa = s * 0.028;
        const xb = s * 0.102;
        const patch = shellPatch(shell, bot, top, (y) => {
          const a = phiAtX(shell, y, xa, true);
          const b = phiAtX(shell, y, xb, true);
          return [Math.min(a, b), Math.max(a, b)];
        }, 0.0016, 6, 6);
        const outline = [
          [xa, top],
          [xa, bot + 0.014],
          [(xa + xb) / 2, bot],
          [xb, bot + 0.014],
          [xb, top],
        ].map(([x, y]) => shellPoint(shell, y, phiAtX(shell, y, x, true), 0.0024));
        const welt = [0, 1, 2, 3, 4].map((i) => {
          const x = xa + ((xb - xa) * i) / 4;
          return shellPoint(shell, top - 0.013, phiAtX(shell, top - 0.013, x, true), 0.0019);
        });
        // Canesú del jean: la costura en V de atrás, más alta a los costados y más baja en el medio.
        const yoke = [0, 0.004].map((dy) =>
          Array.from({ length: 9 }, (_, i) => {
            const phi = s * (Math.PI / 2 + (Math.PI / 2) * (i / 8));
            const y = wt - 0.042 - 0.016 * (i / 8) - dy;
            return shellPoint(shell, y, phi, 0.0019);
          }),
        );
        return { patch, outline, welt, yoke, mid: (xa + xb) / 2 };
      }),
    [shell, top, bot, wt],
  );
  return (
    <>
      {parts.map((p, i) =>
        jean ? (
          <group key={i}>
            <Piece geo={p.patch} color={shade(look.color, -0.03)} />
            <Line points={p.outline} r={0.0009} color={look.trim} />
            {p.yoke.map((pts, k) => (
              <Line key={k} points={pts} r={0.0007} color={look.trim} />
            ))}
          </group>
        ) : (
          <group key={i}>
            <Line points={p.welt} r={0.0013} color={shade(look.color, -0.18)} />
            <Button
              at={shellPoint(shell, top - 0.024, phiAtX(shell, top - 0.024, p.mid, true), 0.003)}
              normal={shellNormal(shell, top - 0.024, phiAtX(shell, top - 0.024, p.mid, true))}
              r={0.0042}
              color={shade(look.color, -0.2)}
            />
          </group>
        ),
      )}
    </>
  );
}

// ───────────────────────── Sobre las piernas ─────────────────────────

/**
 * Detalles que van sobre las dos piernas (franjas, bolsillos cargo, raya del pantalón). Se arman
 * en su lugar de verdad para cada pierna, sin espejar.
 */
function LegDetails({ sk, look }: { sk: Skeleton; look: BottomLook }) {
  const prof = useMemo(() => limbProfiles(sk), [sk]);
  const pant = useMemo(() => (look.kind === "pants" ? pantLeg(sk, look) : null), [sk, look]);
  const thigh = useMemo(() => pant?.thigh ?? bottomThighProfile(sk, look), [pant, sk, look]);
  const tEnd = bottomLegT(look);
  const calfT = pantCalfT(look);
  const inf = bottomInflate(look);
  const items = useMemo(() => {
    const out: { geo: THREE.BufferGeometry; color: string }[] = [];
    const lines: { pts: THREE.Vector3[]; color: string; r: number }[] = [];
    const buttons: { at: THREE.Vector3; n: THREE.Vector3 }[] = [];
    const thighR = (t: number) => profileAt(thigh, t / tEnd) + 0.0016;
    const calfProfile = pant?.calf ?? clothProfile(prof.calf, inf, 0, Math.max(0.01, calfT));
    const calfR = (t: number) => profileAt(calfProfile, t / calfT) + 0.0016;
    const notch = legNotch(sk, look);
    for (const s of [1, -1] as const) {
      const ax = bottomLegAxis(sk, look, s);
      const fThigh = limbFrame(ax.hip, ax.knee);
      const fCalf = limbFrame(ax.knee, ax.ankle);
      const out90 = s * (Math.PI / 2);
      if (look.sideStripes) {
        const w = 0.016;
        const stripeEnd = (tEnd - notch) * 0.995;
        out.push({ geo: limbPatch(fThigh, 0, stripeEnd, out90 - w / 0.08, out90 + w / 0.08, thighR, 3, 14), color: look.trim });
        if (calfT > 0) {
          out.push({ geo: limbPatch(fCalf, 0, calfT * 0.99, out90 - w / 0.06, out90 + w / 0.06, calfR, 3, 14), color: look.trim });
        }
      } else if (!look.tight) {
        // Costura del costado, de la cadera al ruedo (en el jean, con el hilo naranja).
        const seam = look.pockets === "jean" ? look.trim : shade(look.color, -0.07);
        const tTop = (tEnd - notch) * 0.98;
        const pts = Array.from({ length: 9 }, (_, i) => limbPoint(fThigh, 0.03 + ((tTop - 0.03) * i) / 8, out90, thighR(0.03 + ((tTop - 0.03) * i) / 8) - 0.0004));
        if (calfT > 0) {
          for (let i = 1; i <= 8; i++) {
            const t = (calfT * 0.97 * i) / 8;
            pts.push(limbPoint(fCalf, t, out90, calfR(t) - 0.0004));
          }
        }
        lines.push({ pts, color: seam, r: 0.0007 });
        // Costura de adentro (la entrepierna), del tiro al ruedo: marca que son dos piernas.
        const in90 = -out90;
        const inner = Array.from({ length: 9 }, (_, i) => {
          const t = 0.02 + ((tEnd * 0.98 - 0.02) * i) / 8;
          return limbPoint(fThigh, t, in90, thighR(t) - 0.0004);
        });
        if (calfT > 0) {
          for (let i = 1; i <= 8; i++) {
            const t = (calfT * 0.97 * i) / 8;
            inner.push(limbPoint(fCalf, t, in90, calfR(t) - 0.0004));
          }
        }
        lines.push({ pts: inner, color: look.pockets === "jean" ? look.trim : shade(look.color, -0.09), r: 0.0008 });
      }
      if (look.pockets === "cargo" && tEnd >= 0.35) {
        // Bolsillo cargo al costado del muslo, siempre dentro del largo de la prenda (en un short
        // corto, más chico), con su tapa, el botón y la costura alrededor.
        const t0 = tEnd >= 0.9 ? 0.34 : tEnd * 0.3;
        const t1 = tEnd >= 0.9 ? 0.62 : Math.min(tEnd * 0.86, t0 + 0.3);
        const c = s * (Math.PI / 2 - 0.12);
        const half = Math.min(0.5, 0.032 / thighR(t0));
        const r = (t: number) => thighR(t) + 0.0016;
        const flap0 = t0 - 0.03;
        const flap1 = t0 + 0.035;
        // La misma tela, apenas más oscura (el bolsillo se nota por sus bordes y la sombra de la tapa).
        out.push({ geo: limbPatch(fThigh, t0, t1, c - half, c + half, r, 8, 6), color: shade(look.color, -0.012) });
        out.push({ geo: limbPatch(fThigh, flap0, flap1, c - half * 1.05, c + half * 1.05, (t) => r(t) + 0.0016, 8, 2), color: shade(look.color, -0.03) });
        const edge = [
          [t0 + 0.04, c - half],
          [t1, c - half],
          [t1, c + half],
          [t0 + 0.04, c + half],
        ].map(([t, th]) => limbPoint(fThigh, t, th, r(t) + 0.0012));
        lines.push({ pts: edge, color: shade(look.color, -0.12), r: 0.0012 });
        // Pespunte, un poquito adentro del borde.
        const inset = [
          [t0 + 0.04, c - half * 0.86],
          [t1 - 0.012, c - half * 0.86],
          [t1 - 0.012, c + half * 0.86],
          [t0 + 0.04, c + half * 0.86],
        ].map(([t, th]) => limbPoint(fThigh, t, th, r(t) + 0.0012));
        lines.push({ pts: inset, color: look.trim, r: 0.0006 });
        lines.push({
          pts: Array.from({ length: 9 }, (_, i) => limbPoint(fThigh, flap1, c - half * 1.05 + (half * 2.1 * i) / 8, r(flap1) + 0.0032)),
          color: shade(look.color, -0.2),
          r: 0.0011,
        });
        const tb = (flap0 + flap1) / 2 + 0.01;
        buttons.push({ at: limbPoint(fThigh, tb, c, r(tb) + 0.004), n: limbPoint(fThigh, tb, c, 1).sub(limbPoint(fThigh, tb, 0, 0)) });
      }
      if (look.crease) {
        const pts = [0.06, 0.3, 0.6, 0.98].map((t) => limbPoint(fThigh, t, 0, thighR(t) + 0.0004));
        if (calfT > 0) for (const u of [0.15, 0.5, 0.92]) pts.push(limbPoint(fCalf, u * calfT, 0, calfR(u * calfT) + 0.0004));
        lines.push({ pts, color: shade(look.color, 0.06), r: 0.0009 });
      }
    }
    // Pliegue entre las piernas: donde las dos piernas se juntan (adelante y atrás), desde la
    // entrepierna hasta donde se separan. Marca la "V" de un short o un pantalón.
    if (!look.tight) {
      const ax = bottomLegAxis(sk, look, 1);
      const t0 = Math.max(0.02, (ax.hip[1] - sk.crotchY) / (ax.hip[1] - ax.knee[1]));
      for (const side of [1, -1]) {
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= 12; i++) {
          const t = t0 + ((tEnd * 0.97 - t0) * i) / 12;
          const p = lerp3(ax.hip, ax.knee, t);
          const r = profileAt(thigh, t / tEnd);
          if (Math.abs(p[0]) >= r - 0.002) break;
          const dz = Math.sqrt(r * r - p[0] * p[0]);
          pts.push(new THREE.Vector3(0, p[1], p[2] + side * (dz + 0.0012)));
        }
        if (pts.length >= 3) lines.push({ pts, color: shade(look.color, -0.16), r: 0.002 });
      }
    }
    return { out, lines, buttons };
  }, [sk, look, pant, thigh, tEnd, calfT, prof, inf]);
  return (
    <>
      {items.out.map((p, i) => (
        <Piece key={i} geo={p.geo} color={p.color} />
      ))}
      {items.lines.map((p, i) => (
        <Line key={i} points={p.pts} r={p.r} color={p.color} />
      ))}
      {items.buttons.map((b, i) => (
        <Button key={i} at={b.at} normal={b.n} r={0.0045} color={shade(look.color, -0.2)} />
      ))}
    </>
  );
}

/**
 * Logo o estampado de la parte de abajo, donde lo vio la IA: en el cuerpo (cerca de la cintura)
 * o sobre una pierna (como la pipa de un short deportivo).
 */
function BottomPrint({ sk, look, shell, decal, back }: { sk: Skeleton; look: BottomLook; shell: Ring[]; decal: Decal; back: boolean }) {
  const place = decal.place;
  const l1 = sk.leg(1);
  const tEnd = bottomLegT(look);
  const hemY = look.kind === "shorts" ? l1.hip[1] - tEnd * (l1.hip[1] - l1.knee[1]) : look.kind === "bermuda" ? l1.knee[1] - 0.03 : 0.12;
  const top = shell[shell.length - 1].y;
  const cy = top - place.y * (top - hemY);
  const thigh = useMemo(() => bottomThighProfile(sk, look), [sk, look]);
  const geo = useMemo(() => {
    if (cy > l1.hip[1] - 0.02 || Math.abs(place.x) < 0.15) return null;
    // Pierna: la del lado donde está el logo mirando la foto (de frente, la izquierda de la foto es −x).
    const s = (Math.sign(place.x) * (back ? -1 : 1)) as 1 | -1;
    const l = bottomLegAxis(sk, look, s);
    const f = limbFrame(l.hip, l.knee);
    const tc = Math.min(tEnd * 0.9, Math.max(0.05, (l.hip[1] - cy) / (l.hip[1] - l.knee[1])));
    const R = (t: number) => profileAt(thigh, Math.min(1, t / tEnd)) + 0.0028;
    const w = Math.min(0.12, place.width * 2 * ringAt(shell, 0.95).rx * 0.9);
    const h = Math.min(0.16, w / Math.max(0.2, decal.aspect));
    const legLen = Math.hypot(l.knee[0] - l.hip[0], l.knee[1] - l.hip[1], l.knee[2] - l.hip[2]);
    const dt = h / legLen;
    const t0 = Math.max(0.02, tc - dt / 2);
    const t1 = Math.min(tEnd * 0.97, t0 + dt);
    const half = w / 2 / R(tc);
    const center = back ? Math.PI - s * 0.35 : s * 0.35;
    return limbPatch(f, t0, t1, center - half, center + half, R, 16, 12);
  }, [sk, look, shell, place, decal.aspect, back, cy, tEnd, thigh, l1]);
  if (!geo) {
    // Cerca de la cintura o en el medio: sobre el cuerpo de la prenda.
    return <PrintDecal shell={shell} tex={decal.tex} aspect={decal.aspect} place={place} back={back} widthAt={0.95} />;
  }
  return (
    <Geo geo={geo} cast={false}>
      <DecalMat tex={decal.tex} />
    </Geo>
  );
}

/**
 * Parte de abajo. `shell` es su cuerpo ya calculado (por encima de la remera si va metida).
 * `covered`: la remera tapa la cintura (no se dibujan sus detalles).
 */
export function BottomGarment({
  sk,
  look,
  shell,
  covered = false,
  decalFront,
  decalBack,
  tile,
}: {
  sk: Skeleton;
  look: BottomLook;
  shell: Ring[];
  covered?: boolean;
  decalFront: Decal | null;
  decalBack: Decal | null;
  /** Pedazo de la tela real (estampado por toda la prenda), si hay. */
  tile?: THREE.Texture | null;
}) {
  const fill: Fill = tile ? { kind: "foto", tex: tile } : look.pattern;
  const brief = look.kind === "brief";
  const geo = useMemo(() => ringTube(shell, { segments: 48, capBottom: true }), [shell]);
  const prints = (
    <>
      {decalFront && <BottomPrint sk={sk} look={look} shell={shell} decal={decalFront} back={false} />}
      {decalBack && <BottomPrint sk={sk} look={look} shell={shell} decal={decalBack} back />}
    </>
  );
  if (look.kind === "skirt") {
    return (
      <group>
        <Skirt sk={sk} from={1.02} length={look.length} color={look.color} pattern={fill} />
        {!covered && <RingBand ring={ringAt(shellRings(sk.torso, 0.012, 0.9, 1.02), 1.02)} tube={0.008} color={look.trim} />}
      </group>
    );
  }
  return (
    <group>
      <Geo geo={geo}>
        <Mat color={look.color} pattern={fill} repeat={REPEAT.body} double />
      </Geo>
      {/* Cintura (si la remera la tapa, no se dibuja: asomaría a través de la tela) */}
      {!covered && brief && <RingBand ring={shell[shell.length - 1]} tube={0.005} color={look.trim} />}
      {!covered && !brief && look.waist === "belt" && <BeltWaist shell={shell} look={look} />}
      {!covered && !brief && look.waist === "elastic" && <ElasticWaist shell={shell} look={look} cords />}
      {!covered && !brief && look.waist === "plain" && <RingBand ring={shell[shell.length - 1]} tube={0.008} color={look.trim} />}
      {!covered && look.pockets !== "none" && <FrontPockets shell={shell} look={look} />}
      {!brief && (look.pockets === "jean" || look.pockets === "slant" || look.pockets === "cargo") && <BackPockets shell={shell} look={look} />}
      {!brief && <LegDetails sk={sk} look={look} />}
      {!brief && !look.tight && <CrotchSeams shell={shell} look={look} crotchY={sk.crotchY} />}
      {prints}
      {!brief &&
        ([1, -1] as const).map((side) => (
          <group key={side} scale={[side, 1, 1]}>
            <PantLeg sk={sk} look={look} fill={fill} />
          </group>
        ))}
    </group>
  );
}
