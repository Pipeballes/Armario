"use client";

// Accesorios: gorra, gorro, sombrero, bufanda, cinturón, reloj, pulsera, collar, aros, corbata,
// moño, mochila, cartera, sobre, riñonera, guantes, vincha, tiradores y hebillas. Los anteojos de
// sol los dibuja la cabeza. Cada uno va apoyado sobre lo que tenga puesto (la remera o el abrigo).

import { RoundedBox } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import type { AccessoryLook } from "@/lib/look";
import { HEAD_R, HEAD_Y, limbProfiles, profileAt, ringAt, type Ring, type Skeleton } from "@/lib/skeleton";
import { Geo, Hand, Limb, handQuaternion } from "./Body";
import { Mat, shade } from "./materials";
import { Line, Piece } from "./parts";
import { limbFrame, limbPoint, phiAtX, ringTube, shellPatch, shellPoint } from "./shapes";

export interface AccessoryContext {
  sk: Skeleton;
  /** Lo de más afuera del torso (abrigo, o si no la remera), para apoyar collares, corbatas y tiras. */
  outer: Ring[];
  /** El cuerpo del pantalón (para el cinturón), si hay. */
  waist: Ring[] | null;
  /** Radio del puño de la manga si llega hasta la muñeca (camisa), o 0: el reloj va por encima. */
  wristCover: number;
}

/** Altura de la "cresta" del hombro (donde la prenda tiene cierto ancho), para pasar tiras por arriba. */
function crest(shell: Ring[], x: number): { y: number; z: number } {
  for (let i = shell.length - 1; i > 0; i--) {
    const hi = shell[i];
    const lo = shell[i - 1];
    if (lo.rx >= x && hi.rx < x) {
      const t = (x - hi.rx) / (lo.rx - hi.rx);
      return { y: hi.y + (lo.y - hi.y) * t, z: hi.z + (lo.z - hi.z) * t };
    }
  }
  const top = shell[shell.length - 1];
  return { y: top.y, z: top.z };
}

/** Cinturón: la tira alrededor de la cintura del pantalón, con la hebilla adelante. */
function Belt({ waist, look }: { waist: Ring[]; look: AccessoryLook }) {
  // A la altura de la cintura del pantalón (más arriba con tiro alto, más abajo con tiro bajo).
  const cy = waist[waist.length - 1].y - 0.02;
  const geo = useMemo(() => {
    const a = ringAt(waist, cy - 0.013);
    const b = ringAt(waist, cy + 0.013);
    const grow = (r: Ring, y: number) => ({ ...r, y, rx: r.rx + 0.0035, rz: r.rz + 0.0035 });
    return ringTube([grow(a, cy - 0.013), grow(b, cy + 0.013)], { segments: 48, sub: 1 });
  }, [waist, cy]);
  const front = ringAt(waist, cy);
  const z = front.z + front.rz + 0.008;
  return (
    <group>
      <Geo geo={geo}>
        <Mat color={look.color} double />
      </Geo>
      {/* Hebilla: el marco de metal y la punta del cinturón que pasa por adentro */}
      <mesh position={[0, cy, z]}>
        <boxGeometry args={[0.04, 0.034, 0.004]} />
        <Mat color={look.trim} />
      </mesh>
      <mesh position={[0, cy, z + 0.0012]}>
        <boxGeometry args={[0.028, 0.022, 0.004]} />
        <Mat color={look.color} />
      </mesh>
      <mesh position={[0.005, cy, z + 0.003]}>
        <boxGeometry args={[0.003, 0.024, 0.003]} />
        <Mat color={look.trim} />
      </mesh>
    </group>
  );
}

/** Reloj o pulsera en la muñeca izquierda (+x). */
function Wrist({ sk, look, cover, watch }: { sk: Skeleton; look: AccessoryLook; cover: number; watch: boolean }) {
  const a = sk.arm(1);
  // En la muñeca, justo arriba de la mano (debajo de donde terminan casi todas las mangas).
  const t = watch ? 0.955 : 0.975;
  const { pos, q, out, r } = useMemo(() => {
    const f = limbFrame(a.elbow, a.wrist);
    const prof = limbProfiles(sk);
    const rad = Math.max(profileAt(prof.forearm, t) + 0.0035, cover + 0.003);
    const p = f.a.clone().lerp(f.b, t);
    return {
      pos: p,
      q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), f.d),
      // Del lado del dorso de la mano (hacia afuera, +x).
      out: limbPoint(f, t, Math.PI / 2, rad + 0.003),
      r: rad,
    };
  }, [a, sk, t, cover]);
  return (
    <group>
      <mesh position={pos} quaternion={q} scale={[1, 0.88, 1]}>
        <torusGeometry args={[r, watch ? 0.0045 : 0.0028, 8, 28]} />
        <Mat color={watch ? look.color : look.trim} />
      </mesh>
      {watch && (
        <group position={out} rotation={[0, 0, -Math.PI / 2]}>
          <mesh>
            <cylinderGeometry args={[0.016, 0.016, 0.006, 20]} />
            <Mat color={look.trim} />
          </mesh>
          <mesh position={[0, 0.0032, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.002, 20]} />
            <Mat color="#1f2328" />
          </mesh>
        </group>
      )}
    </group>
  );
}

/** Collar: cadenita alrededor del cuello que baja en V al pecho, con un dije. */
function Necklace({ outer, look }: { outer: Ring[]; look: AccessoryLook }) {
  const pts = useMemo(
    () =>
      Array.from({ length: 33 }, (_, i) => {
        const phi = -Math.PI + (2 * Math.PI * i) / 32;
        const y = 1.462 - 0.1 * Math.pow(Math.cos(phi / 2), 6);
        return shellPoint(outer, Math.min(y, outer[outer.length - 1].y - 0.004), phi, 0.004);
      }),
    [outer],
  );
  return (
    <>
      <Line points={pts} r={0.0018} color={look.color} />
      <mesh position={[pts[16].x, pts[16].y - 0.008, pts[16].z + 0.002]}>
        <sphereGeometry args={[0.007, 12, 10]} />
        <Mat color={look.color} />
      </mesh>
    </>
  );
}

/** Corbata: el nudo bajo el cuello y la hoja que baja por el pecho, terminada en punta. */
function Tie({ outer, look }: { outer: Ring[]; look: AccessoryLook }) {
  const top = outer[outer.length - 1].y - 0.022;
  const geo = useMemo(
    () =>
      shellPatch(
        outer,
        0.99,
        top,
        (y) => {
          const k = (y - 0.99) / (top - 0.99);
          // Angosta arriba, más ancha abajo y en punta al final.
          const w = k < 0.08 ? (0.044 * k) / 0.08 : 0.044 - 0.024 * ((k - 0.08) / 0.92);
          return [phiAtX(outer, y, -w / 2), phiAtX(outer, y, w / 2)];
        },
        0.0055,
        6,
        16,
      ),
    [outer, top],
  );
  const knot = shellPoint(outer, top + 0.006, 0, 0.009);
  return (
    <>
      <Piece geo={geo} color={look.color} />
      <mesh position={knot} rotation={[0.2, 0, 0]}>
        <cylinderGeometry args={[0.014, 0.009, 0.022, 10]} />
        <Mat color={shade(look.color, -0.06)} />
      </mesh>
    </>
  );
}

/** Moño: dos alas y el nudo, adelante del cuello. */
function BowTie({ outer, look }: { outer: Ring[]; look: AccessoryLook }) {
  const at = shellPoint(outer, outer[outer.length - 1].y - 0.016, 0, 0.01);
  return (
    <group position={at}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.019, 0, 0]} rotation={[0, 0, (s * Math.PI) / 2]}>
          <coneGeometry args={[0.016, 0.034, 4]} />
          <Mat color={look.color} />
        </mesh>
      ))}
      <mesh>
        <sphereGeometry args={[0.008, 10, 8]} />
        <Mat color={shade(look.color, -0.08)} />
      </mesh>
    </group>
  );
}

/** Tira que pasa por arriba del hombro: del pecho (adelante) a la espalda, apoyada en la prenda. */
function shoulderPath(outer: Ring[], x: number, yFront: number, yBack: number, xBack: number): THREE.Vector3[] {
  const c = crest(outer, x + 0.012);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 5; i++) {
    const y = yFront + (c.y - 0.03 - yFront) * (i / 5);
    pts.push(shellPoint(outer, y, phiAtX(outer, y, x), 0.005));
  }
  pts.push(new THREE.Vector3(x + 0.004, c.y + 0.008, c.z));
  for (let i = 5; i >= 0; i--) {
    const y = yBack + (c.y - 0.03 - yBack) * (i / 5);
    const xx = xBack + (x - xBack) * (i / 5);
    pts.push(shellPoint(outer, y, phiAtX(outer, y, xx, true), 0.005));
  }
  return pts;
}

/** Tiradores: dos tiras de la cintura, por arriba de los hombros, que se cruzan en la espalda. */
function Suspenders({ outer, look }: { outer: Ring[]; look: AccessoryLook }) {
  const paths = useMemo(() => [-1, 1].map((s) => shoulderPath(outer, s * 0.085, 1.0, 1.0, -s * 0.03)), [outer]);
  return (
    <>
      {paths.map((p, i) => (
        <group key={i}>
          <Line points={p} r={0.006} color={look.color} />
          <mesh position={p[0]}>
            <boxGeometry args={[0.016, 0.02, 0.006]} />
            <Mat color={look.trim} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** Mochila en la espalda, con las dos tiras por arriba de los hombros. */
function Backpack({ outer, look }: { outer: Ring[]; look: AccessoryLook }) {
  const r = ringAt(outer, 1.22);
  const backZ = r.z - r.rz;
  const straps = useMemo(
    () =>
      [-1, 1].map((s) => {
        const front = shoulderPath(outer, s * 0.1, 1.2, 1.38, s * 0.075).reverse();
        const side = ringAt(outer, 1.1);
        front.push(new THREE.Vector3(s * (side.rx * 0.95), 1.1, side.z - side.rz * 0.35));
        front.push(new THREE.Vector3(s * 0.11, 1.07, backZ - 0.03));
        return front;
      }),
    [outer, backZ],
  );
  return (
    <group>
      <RoundedBox args={[0.27, 0.36, 0.11]} radius={0.03} smoothness={4} position={[0, 1.22, backZ - 0.062]} castShadow>
        <Mat color={look.color} />
      </RoundedBox>
      <RoundedBox args={[0.19, 0.14, 0.04]} radius={0.015} smoothness={3} position={[0, 1.13, backZ - 0.125]}>
        <Mat color={shade(look.color, -0.06)} />
      </RoundedBox>
      {straps.map((p, i) => (
        <Line key={i} points={p} r={0.008} color={shade(look.color, -0.1)} />
      ))}
    </group>
  );
}

/** Cartera o bolso cruzado: la tira del hombro derecho a la cadera izquierda y el bolso al costado. */
function CrossBag({ outer, look, small }: { outer: Ring[]; look: AccessoryLook; small: boolean }) {
  const strap = useMemo(() => {
    const c = crest(outer, 0.11);
    const front: THREE.Vector3[] = [];
    const back: THREE.Vector3[] = [];
    for (let i = 0; i <= 8; i++) {
      const k = i / 8;
      const y = c.y - 0.02 + (0.98 - (c.y - 0.02)) * k;
      const x = -0.1 + (0.2 + 0.1) * k;
      front.push(shellPoint(outer, y, phiAtX(outer, y, Math.min(x, ringAt(outer, y).rx * 0.95)), 0.006));
      back.push(shellPoint(outer, y, phiAtX(outer, y, Math.min(x, ringAt(outer, y).rx * 0.95), true), 0.006));
    }
    return { front, back: [new THREE.Vector3(-0.106, c.y + 0.008, c.z), ...back] };
  }, [outer]);
  const end = strap.front[strap.front.length - 1];
  const size: [number, number, number] = small ? [0.15, 0.11, 0.05] : [0.22, 0.16, 0.07];
  return (
    <group>
      <Line points={strap.front} r={0.0045} color={shade(look.color, -0.1)} />
      <Line points={strap.back} r={0.0045} color={shade(look.color, -0.1)} />
      <RoundedBox args={size} radius={0.012} smoothness={3} position={[end.x + 0.03, end.y - size[1] / 2 + 0.01, end.z + 0.01]} rotation={[0, 0.9, 0]} castShadow>
        <Mat color={look.color} />
      </RoundedBox>
    </group>
  );
}

/** Riñonera: la tira alrededor de la cintura y la bolsita adelante. */
function WaistBag({ outer, look }: { outer: Ring[]; look: AccessoryLook }) {
  const y = 0.99;
  const geo = useMemo(() => {
    const r = ringAt(outer, y);
    const grow = (yy: number) => ({ y: yy, rx: r.rx + 0.004, rz: r.rz + 0.004, z: r.z });
    return ringTube([grow(y - 0.01), grow(y + 0.01)], { segments: 48, sub: 1 });
  }, [outer]);
  const front = ringAt(outer, y);
  return (
    <group>
      <Geo geo={geo}>
        <Mat color={shade(look.color, -0.12)} double />
      </Geo>
      <RoundedBox args={[0.2, 0.09, 0.06]} radius={0.025} smoothness={4} position={[0, y - 0.01, front.z + front.rz + 0.03]} castShadow>
        <Mat color={look.color} />
      </RoundedBox>
    </group>
  );
}

/** Guantes: una mano un poco más grande del color del guante, con su puño. */
function Gloves({ sk, look }: { sk: Skeleton; look: AccessoryLook }) {
  const a = sk.arm(1);
  const q = useMemo(() => handQuaternion(a.elbow, a.wrist), [a.elbow, a.wrist]);
  return (
    <>
      {([1, -1] as const).map((s) => (
        <group key={s} scale={[s, 1, 1]}>
          <group position={a.wrist} quaternion={q} scale={1.07}>
            <Hand skin={look.color} />
          </group>
          <mesh position={a.wrist} quaternion={q}>
            <cylinderGeometry args={[0.031, 0.029, 0.03, 16, 1, true]} />
            <Mat color={shade(look.color, -0.06)} double />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** Sobre (cartera de mano), en la mano izquierda. */
function Clutch({ sk, look }: { sk: Skeleton; look: AccessoryLook }) {
  const a = sk.arm(1);
  const q = useMemo(() => handQuaternion(a.elbow, a.wrist), [a.elbow, a.wrist]);
  return (
    <group position={a.wrist} quaternion={q}>
      <RoundedBox args={[0.018, 0.1, 0.17]} radius={0.006} smoothness={3} position={[-0.02, -0.07, 0.02]} castShadow>
        <Mat color={look.color} />
      </RoundedBox>
    </group>
  );
}

export function Accessory({ look, ctx }: { look: AccessoryLook; ctx: AccessoryContext }) {
  const c = look.color;
  switch (look.kind) {
    case "cap":
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
    case "beanie":
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
    case "hat":
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
    case "scarf":
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
    case "belt":
      return ctx.waist ? <Belt waist={ctx.waist} look={look} /> : null;
    case "watch":
    case "bracelet":
      return <Wrist sk={ctx.sk} look={look} cover={ctx.wristCover} watch={look.kind === "watch"} />;
    case "necklace":
      return <Necklace outer={ctx.outer} look={look} />;
    case "earrings":
      return (
        <>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * HEAD_R * 0.99, HEAD_Y - 0.042, 0.006]} rotation={[0, Math.PI / 2, 0]}>
              <torusGeometry args={[0.009, 0.0017, 6, 16]} />
              <Mat color={c} />
            </mesh>
          ))}
        </>
      );
    case "tie":
      return <Tie outer={ctx.outer} look={look} />;
    case "bowtie":
      return <BowTie outer={ctx.outer} look={look} />;
    case "backpack":
      return <Backpack outer={ctx.outer} look={look} />;
    case "bag":
      return <CrossBag outer={ctx.outer} look={look} small={false} />;
    case "clutch":
      return <Clutch sk={ctx.sk} look={look} />;
    case "waistbag":
      return <WaistBag outer={ctx.outer} look={look} />;
    case "gloves":
      return <Gloves sk={ctx.sk} look={look} />;
    case "suspenders":
      return <Suspenders outer={ctx.outer} look={look} />;
    case "headband":
      return (
        <mesh position={[0, HEAD_Y + 0.012, -0.012]} rotation={[-0.38, 0, 0]} scale={[1.02, 1.06, 1]}>
          <torusGeometry args={[HEAD_R * 1.02, 0.0075, 8, 40, Math.PI]} />
          <Mat color={c} />
        </mesh>
      );
    case "hairclip":
      return (
        // Hebilla sobre el pelo, al costado (por fuera del peinado).
        <group position={[0.118, HEAD_Y + 0.09, 0.06]} rotation={[0.2, 0.75, 0.55]}>
          <mesh>
            <boxGeometry args={[0.05, 0.014, 0.01]} />
            <Mat color={c} />
          </mesh>
          <mesh position={[0, 0, 0.005]}>
            <sphereGeometry args={[0.009, 10, 8]} />
            <Mat color={shade(c, 0.12)} />
          </mesh>
        </group>
      );
    default:
      return null;
  }
}
