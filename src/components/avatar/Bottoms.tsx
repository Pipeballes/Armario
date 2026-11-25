"use client";

// Parte de abajo del avatar: pantalón, jean, jogging, short, bermuda, calza, pollera y ropa
// interior. Cada tipo con sus detalles: cintura con presillas y botón o elástica con cordón,
// bragueta, bolsillos (de jean, en diagonal, cargo), franjas, raya del pantalón y el logo.

import { useMemo } from "react";
import * as THREE from "three";
import type { BottomLook } from "@/lib/look";
import {
  bottomInflate,
  clothProfile,
  jointBalls,
  limbProfiles,
  profileAt,
  ringAt,
  shellRings,
  type Ring,
  type Skeleton,
} from "@/lib/skeleton";
import { Geo } from "./Body";
import { Mat, REPEAT, shade, type Fill } from "./materials";
import { Button, Cuff, DecalMat, Line, Piece, PrintDecal, RingBand, lerp3, shellNormal, type Decal } from "./parts";
import { axisLathe, limbFrame, limbPatch, limbPoint, phiAtX, ringTube, shellPatch, shellPoint } from "./shapes";
import { Skirt } from "./Tops";


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

/** Hasta dónde baja la pierna por el muslo (0 = cadera, 1 = rodilla). */
const thighEndT = (look: BottomLook) => (look.kind === "shorts" ? look.legT : 1);

/** Radio con el que termina la pierna de un short (más abierto en los deportivos). */
function hemRadius(sk: Skeleton, look: BottomLook) {
  const prof = limbProfiles(sk);
  const inf = bottomInflate(look);
  const t = thighEndT(look);
  const open = look.tight ? 0.002 : look.waist === "elastic" ? 0.016 : 0.01;
  return profileAt(prof.thigh, t) + inf + open;
}

/** Curva de la tela del muslo (para apoyar franjas, bolsillos y logos encima). */
function thighClothProfile(sk: Skeleton, look: BottomLook): [number, number][] {
  const prof = limbProfiles(sk);
  const t = thighEndT(look);
  return clothProfile(prof.thigh, bottomInflate(look), 0, t, t < 1 ? hemRadius(sk, look) : undefined);
}

/** Pierna del pantalón (la derecha). Sigue la forma de la pierna + holgura; los anchos se abren abajo. */
function PantLeg({ sk, look, fill }: { sk: Skeleton; look: BottomLook; fill: Fill }) {
  const l = useMemo(() => sk.leg(1), [sk]);
  const prof = useMemo(() => limbProfiles(sk), [sk]);
  const inf = bottomInflate(look);
  const thighT = thighEndT(look);
  const calfT = pantCalfT(look);
  const thighEnd = useMemo(() => lerp3(l.hip, l.knee, thighT), [l, thighT]);
  const calfEnd = useMemo(() => lerp3(l.knee, l.ankle, calfT), [l, calfT]);
  const upper = useMemo(() => axisLathe(l.hip, thighEnd, thighClothProfile(sk, look)), [l, thighEnd, sk, look]);
  const lower = useMemo(() => {
    if (calfT === 0) return null;
    const base = clothProfile(prof.calf, inf, 0, calfT);
    const kneeR = base[0][1];
    // Todas las formas arrancan en la rodilla con el mismo ancho que termina el muslo (sin escalón).
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
  const hemR = lower ? undefined : hemRadius(sk, look);
  return (
    <group>
      <mesh position={j.hip.at} castShadow>
        <sphereGeometry args={[j.hip.r, 24, 18]} />
        <Mat color={look.color} pattern={fill} repeat={REPEAT.ball} />
      </mesh>
      <Geo geo={upper}>
        <Mat color={look.color} pattern={fill} repeat={REPEAT.leg} double />
      </Geo>
      {lower && (
        <>
          <mesh position={j.knee.at} castShadow>
            <sphereGeometry args={[j.knee.r, 24, 18]} />
            <Mat color={look.color} pattern={fill} repeat={REPEAT.ball} />
          </mesh>
          <Geo geo={lower}>
            <Mat color={look.color} pattern={fill} repeat={REPEAT.leg} double />
          </Geo>
        </>
      )}
      {/* Ruedo del short (en el bóxer y la calza corta, un elástico finito) */}
      {hemR !== undefined && <Cuff from={l.hip} to={thighEnd} r={hemR} tube={look.tight ? 0.003 : 0.0045} color={look.trim} />}
      {look.cuffs && lower && <Cuff from={l.knee} to={calfEnd} r={profileAt(prof.calf, calfT) + 0.009} tube={0.01} color={look.trim} />}
    </group>
  );
}

// ───────────────────────── Cintura ─────────────────────────

/** Cintura de jean o pantalón: pretina, presillas, botón y bragueta con su costura en J. */
function BeltWaist({ shell, look }: { shell: Ring[]; look: BottomLook }) {
  const y0 = 0.982;
  const y1 = 1.02;
  const band = useMemo(() => shellPatch(shell, y0, y1, () => [-Math.PI, Math.PI], 0.0014, 48, 2), [shell]);
  const loops = useMemo(
    () => [-2.55, -1.35, -0.55, 0.55, 1.35, 2.55, Math.PI].map((p) => shellPatch(shell, y0 - 0.004, y1 + 0.002, () => [p - 0.045, p + 0.045], 0.0028, 2, 2)),
    [shell],
  );
  const seam = useMemo(() => Array.from({ length: 25 }, (_, i) => shellPoint(shell, y0, -Math.PI + (2 * Math.PI * i) / 24, 0.0022)), [shell]);
  // Bragueta: el borde en el medio y la costura en J del lado izquierdo de quien lo usa.
  const fly = useMemo(() => {
    const edge = [y0, 0.94, 0.905].map((y) => shellPoint(shell, y, 0, 0.0018));
    const j: THREE.Vector3[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const y = y0 - 0.002 - t * 0.08;
      const x = t < 0.7 ? 0.026 : 0.026 * Math.cos(((t - 0.7) / 0.3) * (Math.PI / 2));
      j.push(shellPoint(shell, y, phiAtX(shell, y, x), 0.0018));
    }
    return { edge, j };
  }, [shell]);
  const metal = look.pockets === "jean" ? "#b0894f" : shade(look.color, -0.2);
  return (
    <>
      <Piece geo={band} color={shade(look.color, -0.02)} />
      {loops.map((g, i) => (
        <Piece key={i} geo={g} color={shade(look.color, -0.05)} />
      ))}
      <Line points={seam} r={0.0009} color={look.trim} />
      <Button at={shellPoint(shell, 1.002, 0, 0.003)} normal={shellNormal(shell, 1.002, 0)} r={0.0065} color={metal} />
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
  const y0 = look.tight ? 0.975 : 0.968;
  const y1 = 1.02;
  const band = useMemo(() => shellPatch(shell, y0, y1, () => [-Math.PI, Math.PI], 0.0018, 48, 2), [shell, y0]);
  const strings = useMemo(
    () =>
      cords && look.drawstring
        ? [-1, 1].map((s) =>
            Array.from({ length: 6 }, (_, i) => {
              const y = 1.0 - (0.075 * i) / 5;
              return shellPoint(shell, y, phiAtX(shell, y, s * (0.011 + 0.012 * (i / 5))), 0.0042);
            }),
          )
        : [],
    [shell, cords, look.drawstring],
  );
  const bandColor = look.trim;
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

// ───────────────────────── Bolsillos ─────────────────────────

/** Bolsillos de adelante: los del jean (curvos, con el monedero) o los de costado en diagonal. */
function FrontPockets({ shell, look }: { shell: Ring[]; look: BottomLook }) {
  const lines = useMemo(() => {
    const out: THREE.Vector3[][] = [];
    for (const s of [-1, 1]) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const y = 0.982 - (look.pockets === "jean" ? 0.05 : 0.055) * t;
        const rx = ringAt(shell, y).rx;
        // Jean: curva que baja hacia el costado. Diagonal: línea recta.
        const x = look.pockets === "jean" ? 0.062 + (rx * 0.9 - 0.062) * Math.sin((t * Math.PI) / 2) : 0.088 + (rx * 0.93 - 0.088) * t;
        pts.push(shellPoint(shell, y, phiAtX(shell, y, s * x), 0.0019));
      }
      out.push(pts);
    }
    if (look.pockets === "jean") {
      // Monedero, del lado derecho de quien lo usa (−x).
      const box = [
        [-0.052, 0.978],
        [-0.052, 0.952],
        [-0.088, 0.952],
        [-0.088, 0.978],
      ].map(([x, y]) => shellPoint(shell, y, phiAtX(shell, y, x), 0.0019));
      out.push(box);
    }
    return out;
  }, [shell, look.pockets]);
  return (
    <>
      {lines.map((pts, i) => (
        <Line key={i} points={pts} r={look.pockets === "jean" ? 0.001 : 0.0011} color={look.pockets === "jean" ? look.trim : shade(look.color, -0.14)} />
      ))}
    </>
  );
}

/** Bolsillos de atrás: parches con costura (jean) o una ranura con botón (pantalón, chino). */
function BackPockets({ shell, look }: { shell: Ring[]; look: BottomLook }) {
  const jean = look.pockets === "jean";
  const parts = useMemo(
    () =>
      [-1, 1].map((s) => {
        const xa = s * 0.028;
        const xb = s * 0.102;
        const patch = shellPatch(shell, 0.9, 0.968, (y) => {
          const a = phiAtX(shell, y, xa, true);
          const b = phiAtX(shell, y, xb, true);
          return [Math.min(a, b), Math.max(a, b)];
        }, 0.0016, 6, 6);
        const outline = [
          [xa, 0.968],
          [xa, 0.912],
          [(xa + xb) / 2, 0.898],
          [xb, 0.912],
          [xb, 0.968],
        ].map(([x, y]) => shellPoint(shell, y, phiAtX(shell, y, x, true), 0.0024));
        const welt = [0, 1, 2, 3, 4].map((i) => {
          const x = xa + ((xb - xa) * i) / 4;
          return shellPoint(shell, 0.955, phiAtX(shell, 0.955, x, true), 0.0019);
        });
        return { patch, outline, welt, mid: (xa + xb) / 2 };
      }),
    [shell],
  );
  return (
    <>
      {parts.map((p, i) =>
        jean ? (
          <group key={i}>
            <Piece geo={p.patch} color={shade(look.color, -0.03)} />
            <Line points={p.outline} r={0.0009} color={look.trim} />
          </group>
        ) : (
          <group key={i}>
            <Line points={p.welt} r={0.0013} color={shade(look.color, -0.18)} />
            <Button
              at={shellPoint(shell, 0.944, phiAtX(shell, 0.944, p.mid, true), 0.003)}
              normal={shellNormal(shell, 0.944, phiAtX(shell, 0.944, p.mid, true))}
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
  const thigh = useMemo(() => thighClothProfile(sk, look), [sk, look]);
  const tEnd = thighEndT(look);
  const calfT = pantCalfT(look);
  const inf = bottomInflate(look);
  const items = useMemo(() => {
    const out: { geo: THREE.BufferGeometry; color: string }[] = [];
    const lines: { pts: THREE.Vector3[]; color: string; r: number }[] = [];
    const buttons: { at: THREE.Vector3; n: THREE.Vector3 }[] = [];
    const thighR = (t: number) => profileAt(thigh, t / tEnd) + 0.0016;
    for (const s of [1, -1] as const) {
      const l = sk.leg(s);
      const fThigh = limbFrame(l.hip, l.knee);
      const out90 = s * (Math.PI / 2);
      if (look.sideStripes) {
        const w = 0.016;
        out.push({ geo: limbPatch(fThigh, 0, tEnd * 0.995, out90 - w / 0.08, out90 + w / 0.08, thighR, 3, 14), color: look.trim });
        if (calfT > 0) {
          const fCalf = limbFrame(l.knee, l.ankle);
          const calfR = (t: number) => profileAt(clothProfile(prof.calf, inf, 0, calfT), t / calfT) + 0.0016;
          out.push({ geo: limbPatch(fCalf, 0, calfT * 0.99, out90 - w / 0.06, out90 + w / 0.06, calfR, 3, 14), color: look.trim });
        }
      }
      if (look.pockets === "cargo" && tEnd > 0.6) {
        const c = s * (Math.PI / 2 - 0.12);
        const r = (t: number) => thighR(t) + 0.0016;
        out.push({ geo: limbPatch(fThigh, 0.34, 0.62, c - 0.5, c + 0.5, r, 8, 6), color: shade(look.color, -0.04) });
        out.push({ geo: limbPatch(fThigh, 0.31, 0.37, c - 0.52, c + 0.52, (t) => r(t) + 0.0016, 8, 2), color: shade(look.color, -0.08) });
        buttons.push({ at: limbPoint(fThigh, 0.355, c, r(0.355) + 0.004), n: limbPoint(fThigh, 0.355, c, 1).sub(limbPoint(fThigh, 0.355, 0, 0)) });
      }
      if (look.crease) {
        const pts = [0.06, 0.3, 0.6, 0.98].map((t) => limbPoint(fThigh, t, 0, thighR(t) + 0.0004));
        if (calfT > 0) {
          const fCalf = limbFrame(l.knee, l.ankle);
          const calf = clothProfile(prof.calf, inf, 0, calfT);
          for (const t of [0.15, 0.5, 0.92]) {
            const r = Math.max(profileAt(calf, t / calfT), sk.legR.knee + inf) + 0.002;
            pts.push(limbPoint(fCalf, t * calfT, 0, Math.max(r, sk.legR.ankle + 0.026)));
          }
        }
        lines.push({ pts, color: shade(look.color, 0.06), r: 0.0009 });
      }
    }
    return { out, lines, buttons };
  }, [sk, look, thigh, tEnd, calfT, prof, inf]);
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
  const tEnd = thighEndT(look);
  const hemY = look.kind === "shorts" ? l1.hip[1] - tEnd * (l1.hip[1] - l1.knee[1]) : look.kind === "bermuda" ? l1.knee[1] - 0.03 : 0.12;
  const top = shell[shell.length - 1].y;
  const cy = top - place.y * (top - hemY);
  const thigh = useMemo(() => thighClothProfile(sk, look), [sk, look]);
  const geo = useMemo(() => {
    if (cy > l1.hip[1] - 0.02 || Math.abs(place.x) < 0.15) return null;
    // Pierna: la del lado donde está el logo mirando la foto (de frente, la izquierda de la foto es −x).
    const s = (Math.sign(place.x) * (back ? -1 : 1)) as 1 | -1;
    const l = sk.leg(s);
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
  }, [sk, shell, place, decal.aspect, back, cy, tEnd, thigh, l1]);
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
      {!covered && (look.pockets === "jean" || look.pockets === "slant") && <FrontPockets shell={shell} look={look} />}
      {!brief && (look.pockets === "jean" || look.pockets === "slant") && <BackPockets shell={shell} look={look} />}
      {!brief && <LegDetails sk={sk} look={look} />}
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
