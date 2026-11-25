"use client";

// El cuerpo del avatar (la piel): torso, cuello, hombros, brazos, manos con sus dedos, piernas y pies.
// Cada lado se arma una vez (el derecho) y el izquierdo es su espejo, así quedan simétricos.

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { jointBalls, limbProfiles, type Ring, type Skeleton, type V3 } from "@/lib/skeleton";
import { Mat, shade } from "./materials";
import { axisLathe, basisQuaternion, ringTube } from "./shapes";

/** Muestra una geometría ya armada y la libera cuando deja de usarse. */
export function Geo({ geo, children, cast = true }: { geo: THREE.BufferGeometry; children: React.ReactNode; cast?: boolean }) {
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} castShadow={cast}>
      {children}
    </mesh>
  );
}

/** Cápsula entre dos puntos (patillas de anteojos, cordones, tiras). */
export function Limb({ a, b, r, children }: { a: V3; b: V3; r: number; children: React.ReactNode }) {
  const { position, quaternion, length } = useMemo(() => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const dir = vb.clone().sub(va);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return { position: va.clone().add(vb).multiplyScalar(0.5), quaternion: q, length: dir.length() };
  }, [a, b]);
  return (
    <mesh position={position} quaternion={quaternion} castShadow>
      <capsuleGeometry args={[r, Math.max(0.001, length), 6, 16]} />
      {children}
    </mesh>
  );
}

export function Ball({ at, r, color, scale }: { at: V3; r: number; color: string; scale?: V3 }) {
  return (
    <mesh position={at} scale={scale} castShadow>
      <sphereGeometry args={[r, 24, 18]} />
      <Mat color={color} />
    </mesh>
  );
}

// ───────────────────────── Mano ─────────────────────────
// Ejes de la mano (la derecha): −y va hacia la punta de los dedos, +x hacia afuera (dorso),
// −x hacia el cuerpo (palma) y +z hacia adelante (lado del pulgar).

interface FingerDef {
  /** Posición del nudillo sobre el ancho de la mano. */
  z: number;
  /** Altura del nudillo (el dedo mayor sale un poco más abajo). */
  y: number;
  /** Largo de las tres falanges. */
  len: [number, number, number];
  r: number;
  /** Cuánto se abre hacia los costados. */
  splay: number;
}

// Dedos gorditos y juntos, como en un dibujo animado.
const FINGERS: FingerDef[] = [
  { z: 0.0232, y: -0.079, len: [0.022, 0.0145, 0.0125], r: 0.0092, splay: 0.035 }, // índice
  { z: 0.0078, y: -0.081, len: [0.0245, 0.016, 0.0135], r: 0.0095, splay: 0.01 }, // mayor
  { z: -0.0078, y: -0.0795, len: [0.023, 0.015, 0.0128], r: 0.009, splay: -0.015 }, // anular
  { z: -0.0222, y: -0.0755, len: [0.018, 0.0125, 0.011], r: 0.0081, splay: -0.04 }, // meñique
];
/** Curva natural de los dedos con la mano relajada (en cada falange, hacia la palma). */
const CURL: [number, number, number] = [0.24, 0.34, 0.26];

function Phalanx({ len, r, skin, nail, children }: { len: number; r: number; skin: string; nail?: string; children?: React.ReactNode }) {
  return (
    <>
      <mesh position={[0, -len / 2, 0]} castShadow>
        <capsuleGeometry args={[r, len, 6, 16]} />
        <Mat color={skin} />
      </mesh>
      {nail && (
        // Uña: del lado del dorso, cerca de la punta.
        <mesh position={[r * 0.72, -len * 0.62, 0]} scale={[0.32, 0.85, 0.78]}>
          <sphereGeometry args={[r * 0.95, 12, 10]} />
          <Mat color={nail} />
        </mesh>
      )}
      <group position={[0, -len, 0]}>{children}</group>
    </>
  );
}

function Finger({ f, skin, nail }: { f: FingerDef; skin: string; nail: string }) {
  const [l1, l2, l3] = f.len;
  return (
    <group position={[0.001, f.y, f.z]} rotation={[-f.splay, 0, -CURL[0]]}>
      <Phalanx len={l1} r={f.r} skin={skin}>
        <group rotation={[0, 0, -CURL[1]]}>
          <Phalanx len={l2} r={f.r * 0.93} skin={skin}>
            <group rotation={[0, 0, -CURL[2]]}>
              <Phalanx len={l3} r={f.r * 0.86} skin={skin} nail={nail} />
            </group>
          </Phalanx>
        </group>
      </Phalanx>
    </group>
  );
}

/**
 * Cortes de la palma, de los nudillos (abajo) a la muñeca (arriba): `rx` es medio grosor (de la
 * palma al dorso) y `rz` medio ancho (del meñique al pulgar).
 */
const PALM: Ring[] = [
  { y: -0.09, rx: 0.006, rz: 0.017, z: 0 },
  { y: -0.086, rx: 0.0115, rz: 0.029, z: 0 },
  { y: -0.078, rx: 0.0145, rz: 0.0335, z: 0 },
  { y: -0.056, rx: 0.016, rz: 0.0335, z: 0.001 },
  { y: -0.032, rx: 0.0155, rz: 0.0305, z: 0.002 },
  { y: -0.013, rx: 0.0135, rz: 0.0245, z: 0.001 },
  { y: -0.002, rx: 0.011, rz: 0.019, z: 0 },
];

/** Mano derecha completa: palma, cuatro dedos de tres falanges y el pulgar de dos. */
export function Hand({ skin }: { skin: string }) {
  const nail = shade(skin, 0.1);
  const palmGeo = useMemo(() => ringTube(PALM, { segments: 28, sub: 3, capBottom: true, capTop: true }), []);
  return (
    <group scale={1.08}>
      {/* Palma y dorso: angosta en la muñeca, se ensancha hasta los nudillos */}
      <Geo geo={palmGeo}>
        <Mat color={skin} />
      </Geo>
      {/* Base del pulgar (la parte carnosa de la palma) */}
      <mesh position={[-0.007, -0.036, 0.02]} scale={[0.75, 1.2, 0.95]} castShadow>
        <sphereGeometry args={[0.018, 16, 12]} />
        <Mat color={skin} />
      </mesh>
      {/* Nudillos */}
      {FINGERS.map((f, i) => (
        <mesh key={i} position={[0.004, f.y + 0.004, f.z]} castShadow>
          <sphereGeometry args={[f.r * 1.08, 12, 10]} />
          <Mat color={skin} />
        </mesh>
      ))}
      {FINGERS.map((f, i) => (
        <Finger key={i} f={f} skin={skin} nail={nail} />
      ))}
      {/* Pulgar: sale de adelante, apunta hacia abajo y hacia adelante, un poco hacia la palma */}
      <group position={[-0.005, -0.03, 0.029]} rotation={[-0.58, 0, -0.3]}>
        <Phalanx len={0.022} r={0.0112} skin={skin}>
          <group rotation={[0, 0, -0.2]}>
            <Phalanx len={0.018} r={0.0102} skin={skin} nail={nail} />
          </group>
        </Phalanx>
      </group>
    </group>
  );
}

// ───────────────────────── Pie ─────────────────────────
// Ejes del pie (el derecho): origen en el tobillo, +z hacia la punta, la planta a 8,5 cm abajo.

export const SOLE_Y = -0.085;

/** Forma del pie: cortes de atrás (talón) hacia adelante (dedos). En cada corte: ancho y alto. */
export function footRings(extra = 0, toeExtra = 0): Ring[] {
  // { y: posición de atrás a adelante, rx: medio ancho, rz: medio alto, z: altura del centro }
  const raw: [number, number, number][] = [
    [-0.07, 0.017, 0.016],
    [-0.058, 0.029, 0.03],
    // Empeine alto junto al tobillo: a esa altura el pie es tan ancho como el tobillo y se funde
    // con la pierna (si no, la articulación sobresale como una pulsera).
    [-0.035, 0.034, 0.046],
    [-0.008, 0.036, 0.056],
    [0.025, 0.037, 0.044],
    [0.07, 0.042, 0.029],
    [0.105, 0.045, 0.023],
    [0.128, 0.043, 0.019],
    [0.142, 0.035, 0.014],
  ];
  const rings = raw.map(([z, rx, ry], i) => {
    const toe = i >= raw.length - 2 ? toeExtra : 0;
    const height = ry + extra;
    return { y: z + (i === raw.length - 1 ? toe : 0), rx: rx + extra, rz: height, z: SOLE_Y + height - extra * 0.3 };
  });
  // Punta redondeada (para el calzado; descalzo, la tapan los dedos).
  if (extra > 0) {
    const last = rings[rings.length - 1];
    rings.push({ y: last.y + 0.009, rx: last.rx * 0.62, rz: last.rz * 0.7, z: SOLE_Y + last.rz * 0.7 - extra * 0.3 });
  }
  return rings;
}

const TOES: { x: number; z: number; r: number }[] = [
  { x: -0.023, z: 0.148, r: 0.0138 }, // dedo gordo (del lado de adentro)
  { x: -0.007, z: 0.147, r: 0.0104 },
  { x: 0.007, z: 0.142, r: 0.0096 },
  { x: 0.019, z: 0.135, r: 0.0088 },
  { x: 0.0295, z: 0.125, r: 0.0078 },
];

/** Pie derecho descalzo: talón, planta, empeine y cinco dedos con uñas. */
export function Foot({ skin }: { skin: string }) {
  const geo = useMemo(() => ringTube(footRings(), { axis: "z", segments: 32, capBottom: true, capTop: true }), []);
  const nail = shade(skin, 0.1);
  return (
    <group>
      <Geo geo={geo}>
        <Mat color={skin} />
      </Geo>
      {TOES.map((t, i) => (
        <group key={i} position={[t.x, SOLE_Y + t.r * 0.85, t.z]}>
          <mesh scale={[1, 0.8, 1.2]} castShadow>
            <sphereGeometry args={[t.r, 14, 10]} />
            <Mat color={skin} />
          </mesh>
          <mesh position={[0, t.r * 0.55, t.r * 0.45]} scale={[0.75, 0.3, 0.75]}>
            <sphereGeometry args={[t.r * 0.8, 10, 8]} />
            <Mat color={nail} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ───────────────────────── Brazo y pierna ─────────────────────────

/** Orientación de la mano: sigue al antebrazo (un poco más vertical), con la palma hacia el cuerpo. */
export function handQuaternion(elbow: V3, wrist: V3): THREE.Quaternion {
  const fore = new THREE.Vector3(...wrist).sub(new THREE.Vector3(...elbow)).normalize();
  const down = fore.clone().lerp(new THREE.Vector3(0, -1, 0), 0.35).normalize();
  return basisQuaternion(down, new THREE.Vector3(1, 0, 0));
}

function Arm({ sk, skin }: { sk: Skeleton; skin: string }) {
  const a = useMemo(() => sk.arm(1), [sk]);
  const prof = useMemo(() => limbProfiles(sk), [sk]);
  const upper = useMemo(() => axisLathe(a.shoulder, a.elbow, prof.upperArm), [a, prof]);
  const fore = useMemo(() => axisLathe(a.elbow, a.wrist, prof.forearm, { flatten: 0.86 }), [a, prof]);
  const q = useMemo(() => handQuaternion(a.elbow, a.wrist), [a.elbow, a.wrist]);
  const j = useMemo(() => jointBalls(sk), [sk]);
  return (
    <group>
      {/* Hombro (deltoides): tapa la boca del brazo; la manga de la remera lo envuelve con el mismo centro */}
      <Ball at={j.shoulder.at} r={j.shoulder.r} color={skin} />
      <Geo geo={upper}>
        <Mat color={skin} />
      </Geo>
      <Ball at={j.elbow.at} r={j.elbow.r} color={skin} />
      <Geo geo={fore}>
        <Mat color={skin} />
      </Geo>
      <Ball at={j.wrist.at} r={j.wrist.r} color={skin} scale={[1, 1, 0.9]} />
      <group position={a.wrist} quaternion={q}>
        <Hand skin={skin} />
      </group>
    </group>
  );
}

function Leg({ sk, skin, barefoot }: { sk: Skeleton; skin: string; barefoot: boolean }) {
  const l = useMemo(() => sk.leg(1), [sk]);
  const r = sk.legR;
  const prof = useMemo(() => limbProfiles(sk), [sk]);
  const thigh = useMemo(() => axisLathe(l.hip, l.knee, prof.thigh), [l, prof]);
  const calf = useMemo(() => axisLathe(l.knee, l.ankle, prof.calf), [l, prof]);
  const j = useMemo(() => jointBalls(sk), [sk]);
  return (
    <group>
      <Ball at={j.hip.at} r={j.hip.r} color={skin} />
      <Geo geo={thigh}>
        <Mat color={skin} />
      </Geo>
      <Ball at={j.knee.at} r={j.knee.r} color={skin} />
      {/* Rótula */}
      <Ball at={[l.knee[0], l.knee[1] + 0.012, l.knee[2] + r.knee * 0.72]} r={0.024} color={skin} scale={[1, 1.15, 0.7]} />
      <Geo geo={calf}>
        <Mat color={skin} />
      </Geo>
      <Ball at={j.ankle.at} r={j.ankle.r} color={skin} />
      {barefoot && (
        <group position={l.ankle} rotation={[0, 0.1, 0]}>
          <Foot skin={skin} />
        </group>
      )}
    </group>
  );
}

/** Todo el cuerpo (la piel). Los pies se dibujan solo si no hay calzado que los tape. */
export default function BodySkin({ sk, skin, barefoot }: { sk: Skeleton; skin: string; barefoot: boolean }) {
  const torso = useMemo(() => ringTube(sk.torso, { segments: 48, capBottom: true, capTop: true }), [sk.torso]);
  const neck = useMemo(
    () =>
      axisLathe([0, sk.neck.bottom, -0.012], [0, sk.neck.top, -0.006], [
        [0, sk.neck.r * 1.6],
        [0.18, sk.neck.r * 1.25],
        [0.42, sk.neck.r * 1.06],
        [1, sk.neck.r],
      ]),
    [sk.neck],
  );
  return (
    <group>
      <Geo geo={torso}>
        <Mat color={skin} />
      </Geo>
      <Geo geo={neck}>
        <Mat color={skin} />
      </Geo>
      {([1, -1] as const).map((side) => (
        <group key={side} scale={[side, 1, 1]}>
          <Arm sk={sk} skin={skin} />
          <Leg sk={sk} skin={skin} barefoot={barefoot} />
        </group>
      ))}
    </group>
  );
}
