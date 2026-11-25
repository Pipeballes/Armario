"use client";

// Calzado: zapatillas (con cordones; los botines con tapones), zapatos, mocasines, náuticos,
// chatitas, alpargatas, zuecos, botas, pantuflas, tacos y los abiertos —ojotas con la tira entre
// los dedos, chanclas de tira ancha y sandalias de tiras—, donde se ven los dedos del pie.

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { ShoesLook } from "@/lib/look";
import { limbProfiles, profileAt, type Ring, type Skeleton, type V3 } from "@/lib/skeleton";
import { Foot, Geo, SOLE_Y, footRings } from "./Body";
import { DetailMat, Mat, shade } from "./materials";
import { Cuff, Line } from "./parts";
import { axisLathe, pathTube, ringTube } from "./shapes";

/** Cuánto se levanta el cuerpo con tacos, y cuánto se inclina el pie. */
export const HEEL_LIFT = 0.055;
export const HEEL_PITCH = 0.33;

/** Corte del pie a cierta distancia del talón (eje z del pie): ancho, alto y altura del centro. */
function footAt(rings: Ring[], z: number): Ring {
  if (z <= rings[0].y) return rings[0];
  for (let i = 1; i < rings.length; i++) {
    const a = rings[i - 1];
    const b = rings[i];
    if (z <= b.y) {
      const t = (z - a.y) / (b.y - a.y);
      return { y: z, rx: a.rx + (b.rx - a.rx) * t, rz: a.rz + (b.rz - a.rz) * t, z: a.z + (b.z - a.z) * t };
    }
  }
  return rings[rings.length - 1];
}

/** Punto del contorno del pie a un ángulo θ medido desde abajo (0 = planta, π/2 = +x, π = arriba). */
function footPoint(r: Ring, theta: number, off = 0): THREE.Vector3 {
  return new THREE.Vector3((r.rx + off) * Math.sin(theta), r.z - (r.rz + off) * Math.cos(theta), r.y);
}

/**
 * Banda de tela alrededor del pie, entre dos puntos del largo (`z0` a `z1`) y en cada corte entre
 * los ángulos que diga `range` (θ desde la planta). Sirve para el capellado de un zapato abierto
 * arriba (chatita, taco, mocasín) y para las tiras de chanclas y sandalias.
 */
function footBand(rings: Ring[], z0: number, z1: number, range: (z: number) => [number, number], nz = 16, nt = 24): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= nz; j++) {
    const z = z0 + ((z1 - z0) * j) / nz;
    const r = footAt(rings, z);
    const [a, b] = range(z);
    for (let i = 0; i <= nt; i++) {
      const p = footPoint(r, a + ((b - a) * i) / nt);
      pos.push(p.x, p.y, p.z);
    }
  }
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nt; i++) {
      const a = j * (nt + 1) + i;
      const c = a + nt + 1;
      idx.push(a, c, a + 1, a + 1, c, c + 1);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Cuánto tapa un zapato abierto arriba en cada corte (medio ángulo desde la planta): cerrado
 * adelante (la puntera), abierto en el empeine y el talón.
 */
function lowCut(kind: ShoesLook["kind"]): (z: number) => number {
  const [toeFrom, instep, heel] =
    kind === "loafer" || kind === "boat"
      ? [0.035, 0.76, 0.8]
      : kind === "espadrille"
        ? [0.02, 0.74, 0.82]
        : kind === "clog"
          ? [-0.01, 0.62, 0.22]
          : [0.075, 0.58, 0.8]; // chatita y taco: el empeine bien a la vista
  return (z) => {
    const front = smoothstep(toeFrom - 0.02, toeFrom + 0.01, z);
    const back = 1 - smoothstep(-0.05, -0.03, z);
    const a = instep + (1 - instep) * front;
    return Math.PI * (back ? heel * back + a * (1 - back) : a);
  };
}

const LOW_CUT = new Set<ShoesLook["kind"]>(["flat", "loafer", "boat", "espadrille", "clog"]);

/** Capellado de un zapato abierto arriba, con el borde terminado. */
function LowUpper({ look, extra }: { look: ShoesLook; extra: number }) {
  const rings = useMemo(() => footRings(extra, 0.016), [extra]);
  const cut = useMemo(() => lowCut(look.kind), [look.kind]);
  const z0 = rings[0].y + 0.002;
  const z1 = rings[rings.length - 1].y;
  const geo = useMemo(() => footBand(rings, z0, z1, (z) => [-cut(z), cut(z)], 28, 28), [rings, z0, z1, cut]);
  // Puntera y talón: tapas para cerrar las puntas del tubo.
  const caps = useMemo(() => ringTube(rings.slice(-3), { axis: "z", segments: 28, capTop: true }), [rings]);
  const heelCap = useMemo(() => {
    const r = rings[0];
    return new THREE.SphereGeometry(Math.max(r.rx, r.rz), 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  }, [rings]);
  useEffect(() => () => heelCap.dispose(), [heelCap]);
  const edge = useMemo(() => {
    const pts: THREE.Vector3[][] = [[], []];
    for (let j = 0; j <= 20; j++) {
      const z = z0 + ((z1 - 0.03 - z0) * j) / 20;
      const a = cut(z);
      if (a > Math.PI * 0.97) continue;
      const r = footAt(rings, z);
      pts[0].push(footPoint(r, a, 0.0015));
      pts[1].push(footPoint(r, -a, 0.0015));
    }
    return pts.filter((p) => p.length > 2);
  }, [rings, cut, z0, z1]);
  return (
    <>
      <Geo geo={geo}>
        <Mat color={look.color} double />
      </Geo>
      <Geo geo={caps}>
        <Mat color={look.color} />
      </Geo>
      {look.kind !== "clog" && (
        <mesh geometry={heelCap} position={[0, rings[0].z, rings[0].y + 0.004]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.6, 1]}>
          <Mat color={look.color} double />
        </mesh>
      )}
      {edge.map((p, i) => (
        <Line key={i} points={p} r={look.kind === "boat" ? 0.0022 : 0.0016} color={look.kind === "boat" ? "#b88a55" : shade(look.color, -0.07)} />
      ))}
    </>
  );
}

/**
 * Cuánto se levanta el cuerpo por la suela de un calzado abierto: el pie se apoya arriba de la
 * suela (si no, los dedos quedarían hundidos en ella).
 */
export function soleLift(look: ShoesLook | null | undefined): number {
  if (!look) return 0;
  if (look.kind === "flipflop" || look.kind === "slide") return 2 * 0.011 - 0.002;
  if (look.kind === "sandal") return 2 * 0.008 - 0.002;
  return 0;
}

/** Suela: el contorno del pie un poco más grande, aplanado. `under`: toda debajo del pie. */
function Sole({
  thick,
  color,
  extra = 0.012,
  toe = 0.014,
  lines,
  under = false,
}: {
  thick: number;
  color: string;
  extra?: number;
  toe?: number;
  lines?: string;
  under?: boolean;
}) {
  const geo = useMemo(() => {
    const center = under ? SOLE_Y - thick + 0.0015 : SOLE_Y + thick * 0.6;
    const rings = footRings(extra, toe).map((r) => ({ ...r, rz: thick, z: center }));
    return ringTube(rings, { axis: "z", segments: 32, capBottom: true, capTop: true });
  }, [thick, extra, toe, under]);
  // Alpargatas: las vueltas de la soga de yute.
  const rope = useMemo(() => {
    if (!lines) return [];
    const rings = footRings(extra + 0.001, 0.014);
    return [0.3, 0.7].map((k) =>
      Array.from({ length: 33 }, (_, i) => {
        const th = (i / 32) * Math.PI * 2;
        const z = rings[0].y + (rings[rings.length - 1].y - rings[0].y) * (0.5 - 0.5 * Math.cos(th));
        const r = footAt(rings, z);
        return new THREE.Vector3((r.rx + 0.0008) * Math.sin(th) * (z > 0 ? 1 : 1), SOLE_Y + thick * (0.6 - 1 + 2 * k), z);
      }),
    );
  }, [lines, extra, thick]);
  return (
    <>
      <Geo geo={geo}>
        <Mat color={color} />
      </Geo>
      {rope.map((p, i) => (
        <Line key={i} points={p} r={0.0012} color={lines!} />
      ))}
    </>
  );
}

/** Ojota: suela finita y la tira en Y que sale de entre el dedo gordo y el segundo. */
function FlipFlopStrap({ color }: { color: string }) {
  const rings = useMemo(() => footRings(), []);
  const r = 0.0042;
  const geos = useMemo(() => {
    const top = (x: number, z: number) => {
      const f = footAt(rings, z);
      const k = Math.min(0.995, Math.abs(x) / f.rx);
      return f.z + f.rz * Math.sqrt(1 - k * k);
    };
    const knot = new THREE.Vector3(-0.012, top(-0.012, 0.1) + r, 0.1);
    const post = [new THREE.Vector3(-0.0155, SOLE_Y + 0.001, 0.126), new THREE.Vector3(-0.014, SOLE_Y + 0.03, 0.115), knot];
    const branch = (side: 1 | -1) => {
      const end = footAt(rings, 0.03);
      const pts: THREE.Vector3[] = [knot];
      for (let i = 1; i <= 6; i++) {
        const u = i / 7;
        const z = 0.1 + (0.032 - 0.1) * u;
        const f = footAt(rings, z);
        const x = -0.012 + (side * f.rx * 0.97 + 0.012) * Math.pow(u, 0.85);
        pts.push(new THREE.Vector3(x, top(x, z) + r * 0.9, z));
      }
      pts.push(new THREE.Vector3(side * (end.rx + r * 0.6), end.z - end.rz * 0.25, 0.03));
      pts.push(new THREE.Vector3(side * (end.rx + r * 0.3), SOLE_Y + 0.001, 0.03));
      return pts;
    };
    return [pathTube(post, r * 0.9, 12), pathTube(branch(1), r, 40), pathTube(branch(-1), r, 40)];
  }, [rings]);
  return (
    <>
      {geos.map((g, i) => (
        <Geo key={i} geo={g}>
          <Mat color={color} />
        </Geo>
      ))}
    </>
  );
}

/** Tiras que cruzan el pie (chancla: una ancha; sandalia: dos finitas, más la del tobillo). */
function StrapBands({ color, wide }: { color: string; wide: boolean }) {
  const rings = useMemo(() => footRings(0.0035), []);
  const geos = useMemo(() => {
    const bands: [number, number][] = wide ? [[0.005, 0.072]] : [[0.088, 0.1], [0.022, 0.034]];
    return bands.map(([a, b]) => footBand(rings, a, b, () => [Math.PI * 0.32, Math.PI * 1.68], 6, 24));
  }, [rings, wide]);
  return (
    <>
      {geos.map((g, i) => (
        <Geo key={i} geo={g}>
          <DetailMat color={color} />
        </Geo>
      ))}
      {!wide && (
        <>
          {/* Tira del tobillo y la de atrás que la une a la suela */}
          <mesh position={[0, 0.006, -0.012]} rotation={[Math.PI / 2 + 0.25, 0, 0]} scale={[1, 1.15, 1]}>
            <torusGeometry args={[0.035, 0.0035, 6, 28]} />
            <Mat color={color} />
          </mesh>
          <Line points={[new THREE.Vector3(0, 0.0, -0.047), new THREE.Vector3(0, -0.04, -0.062), new THREE.Vector3(0, SOLE_Y + 0.001, -0.07)]} r={0.0035} color={color} />
        </>
      )}
    </>
  );
}

/** Cordones cruzados sobre el empeine (zapatillas, zapatos, borcegos). */
function Laces({ color, high, count }: { color: string; high: number; count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const z = 0.012 + i * 0.022;
        return (
          <mesh key={i} position={[0, SOLE_Y + high - i * 0.011, z]} rotation={[0, 0, Math.PI / 2]}>
            <capsuleGeometry args={[0.0032, 0.03, 4, 8]} />
            <Mat color={color} />
          </mesh>
        );
      })}
    </>
  );
}

/** Calzado del pie derecho (va en el tobillo; el izquierdo es el espejo). `skin` para los abiertos. */
export function Shoe({ look, skin }: { look: ShoesLook; skin: string }) {
  const closedGeo = useMemo(() => {
    const extra = look.kind === "slipper" ? 0.014 : look.kind === "formal" || look.kind === "heel" ? 0.005 : look.kind === "boot" || look.kind === "tallboot" ? 0.009 : 0.0075;
    const toe = look.kind === "formal" || look.kind === "heel" ? 0.02 : 0.012;
    return ringTube(footRings(extra, toe), { axis: "z", segments: 32, capBottom: true, capTop: true });
  }, [look.kind]);
  const sole = look.trim;
  const boot = look.kind === "boot" || look.kind === "tallboot";

  // ── Abiertos: se ve el pie con sus dedos ──
  if (look.kind === "flipflop" || look.kind === "slide" || look.kind === "sandal") {
    return (
      <group>
        <Foot skin={skin} />
        <Sole thick={look.kind === "sandal" ? 0.008 : 0.011} color={look.kind === "flipflop" ? look.color : sole} extra={0.008} under />
        {look.kind === "flipflop" ? (
          <FlipFlopStrap color={shade(look.color, -0.08)} />
        ) : (
          <StrapBands color={look.color} wide={look.kind === "slide"} />
        )}
      </group>
    );
  }

  // ── Tacos ──
  if (look.kind === "heel") {
    const strappy = look.heelStyle === "strappy";
    const platform = look.heelStyle === "platform";
    return (
      <group>
        {strappy || !platform ? <Foot skin={skin} /> : null}
        {strappy ? (
          <StrapBands color={look.color} wide={false} />
        ) : platform ? (
          <Geo geo={closedGeo}>
            <Mat color={look.color} />
          </Geo>
        ) : (
          <LowUpper look={{ ...look, kind: "flat" }} extra={0.0045} />
        )}
        <Sole thick={platform ? 0.024 : 0.005} color={platform ? sole : shade(look.color, -0.2)} extra={platform ? 0.006 : 0.008} toe={platform ? 0.02 : 0.014} />
        <mesh position={[0, SOLE_Y - 0.032, -0.052]} castShadow>
          <cylinderGeometry args={platform ? [0.02, 0.018, 0.078, 12] : [0.012, 0.005, 0.078, 12]} />
          <Mat color={shade(look.color, -0.2)} />
        </mesh>
      </group>
    );
  }

  // ── Abiertos arriba: chatitas, mocasines, náuticos, alpargatas, zuecos ──
  if (LOW_CUT.has(look.kind)) {
    return (
      <group>
        <Foot skin={skin} />
        <LowUpper look={look} extra={look.kind === "clog" ? 0.009 : 0.0055} />
        <Sole
          thick={look.kind === "clog" ? 0.02 : look.kind === "espadrille" ? 0.016 : look.kind === "boat" ? 0.01 : 0.006}
          color={look.kind === "boat" || look.kind === "espadrille" || look.kind === "clog" ? sole : shade(look.color, -0.22)}
          lines={look.kind === "espadrille" ? shade(sole, -0.18) : undefined}
        />
        {/* Mocasín: la tira de adelante; náutico: el moñito del cordón */}
        {look.kind === "loafer" && (
          <Geo geo={footBand(footRings(0.0072), 0.024, 0.04, () => [Math.PI * 0.66, Math.PI * 1.34], 4, 16)}>
            <DetailMat color={shade(look.color, 0.06)} />
          </Geo>
        )}
        {look.kind === "boat" &&
          [-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.008, SOLE_Y + 0.066, 0.034]} rotation={[0.3, 0, s * 0.6]}>
              <torusGeometry args={[0.006, 0.0018, 6, 12]} />
              <Mat color="#b88a55" />
            </mesh>
          ))}
        {(look.kind === "loafer" || look.kind === "flat") && (
          <mesh position={[0, SOLE_Y + 0.008, -0.05]} castShadow>
            <boxGeometry args={[0.046, look.kind === "loafer" ? 0.016 : 0.008, 0.03]} />
            <Mat color={shade(look.color, -0.22)} />
          </mesh>
        )}
      </group>
    );
  }

  // ── Cerrados: zapatillas, zapatos, botas, pantuflas ──
  return (
    <group>
      <Geo geo={closedGeo}>
        <Mat color={look.color} />
      </Geo>
      <Sole thick={look.kind === "sneaker" ? 0.0095 : boot ? 0.011 : look.kind === "slipper" ? 0.008 : 0.005} color={sole} />
      {/* Boca del calzado alrededor del tobillo */}
      {!boot && (
        <mesh position={[0, -0.012, -0.02]} rotation={[Math.PI / 2 + 0.2, 0, 0]} scale={[1, 1.2, 1]}>
          <torusGeometry args={[0.037, 0.007, 8, 28]} />
          <Mat color={shade(look.color, -0.07)} />
        </mesh>
      )}
      {look.laces && <Laces color={look.kind === "sneaker" ? "#fafafa" : shade(look.color, -0.25)} high={look.kind === "formal" ? 0.074 : boot ? 0.09 : 0.088} count={look.kind === "formal" ? 2 : 3} />}
      {/* Tapones de los botines de fútbol */}
      {look.studs &&
        [
          [-0.02, 0.1],
          [0.022, 0.1],
          [-0.024, 0.05],
          [0.026, 0.05],
          [-0.014, -0.045],
          [0.014, -0.045],
        ].map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x, SOLE_Y - 0.006, z]}>
            <cylinderGeometry args={[0.0055, 0.0045, 0.01, 10]} />
            <Mat color={shade(sole, -0.2)} />
          </mesh>
        ))}
      {look.kind === "formal" && (
        <mesh position={[0, SOLE_Y + 0.008, -0.05]} castShadow>
          <boxGeometry args={[0.05, 0.016, 0.03]} />
          <Mat color={sole} />
        </mesh>
      )}
    </group>
  );
}

/**
 * Caña de la bota (la derecha). Va sobre el eje real de la pantorrilla —no sobre el pie— y sigue su
 * forma con holgura, así nunca la atraviesa, aunque la pierna esté un poco inclinada.
 */
export function BootShaft({
  sk,
  look,
  underHem,
  around,
}: {
  sk: Skeleton;
  look: ShoesLook;
  underHem?: number;
  /** Si el pantalón va adentro de la bota: su radio en cada punto (t de rodilla a tobillo), para envolverlo. */
  around?: (t: number) => number;
}) {
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
      profile.push([sN, Math.max(profileAt(prof.calf, t) + room + 0.012 * (1 - sN) ** 3, around ? around(t) + 0.004 : 0)]);
    }
    const b: V3 = [bottom.x, bottom.y, bottom.z];
    const tp: V3 = [topV.x, topV.y, topV.z];
    return { geo: axisLathe(b, tp, profile), top: tp, topR: profile[n][1] };
  }, [l, prof, tTop, room, around]);
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
