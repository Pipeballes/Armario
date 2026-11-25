// Generadores de geometría para el avatar: piezas de corte ovalado (torso, pies) y piezas torneadas
// que siguen un eje (brazos, piernas, mangas). Todo con curvas suaves, sin uniones a la vista.

import * as THREE from "three";
import type { Ring, V3 } from "@/lib/skeleton";

/** Interpolación suave (Catmull-Rom) de una lista de números; `sub` puntos nuevos entre cada par. */
export function smooth(values: number[], sub: number): number[] {
  if (values.length < 2 || sub < 1) return values.slice();
  const out: number[] = [];
  const at = (i: number) => values[Math.max(0, Math.min(values.length - 1, i))];
  for (let i = 0; i < values.length - 1; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    for (let k = 0; k < sub; k++) {
      const t = k / sub;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push(0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3));
    }
  }
  out.push(values[values.length - 1]);
  return out;
}

/** Une las normales de la costura (primera y última columna) para que no se vea una línea. */
function weldSeam(geo: THREE.BufferGeometry, rows: number, cols: number) {
  const n = geo.attributes.normal as THREE.BufferAttribute;
  for (let r = 0; r < rows; r++) {
    const a = r * (cols + 1);
    const b = a + cols;
    const x = n.getX(a) + n.getX(b);
    const y = n.getY(a) + n.getY(b);
    const z = n.getZ(a) + n.getZ(b);
    const len = Math.hypot(x, y, z) || 1;
    n.setXYZ(a, x / len, y / len, z / len);
    n.setXYZ(b, x / len, y / len, z / len);
  }
  n.needsUpdate = true;
}

export interface TubeOptions {
  segments?: number;
  /** Puntos intermedios entre cada corte (más = más suave). */
  sub?: number;
  capBottom?: boolean;
  capTop?: boolean;
  /** Eje del tubo: "y" (torso, de abajo arriba) o "z" (pie, de atrás adelante). */
  axis?: "y" | "z";
}

/**
 * Tubo de corte ovalado a partir de cortes (anillos). En el eje y, cada anillo es (y, rx, rz, z);
 * en el eje z se reinterpretan como (z, rx, ry, y) para piezas acostadas como el pie.
 * La textura va alrededor (u) y a lo largo (v).
 */
export function ringTube(rings: Ring[], opts: TubeOptions = {}): THREE.BufferGeometry {
  const segs = opts.segments ?? 48;
  const sub = opts.sub ?? 4;
  const axisZ = opts.axis === "z";
  const ys = smooth(rings.map((r) => r.y), sub);
  const rxs = smooth(rings.map((r) => r.rx), sub);
  const rzs = smooth(rings.map((r) => r.rz), sub);
  const zs = smooth(rings.map((r) => r.z), sub);
  const rows = ys.length;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= segs; c++) {
      const phi = (c / segs) * Math.PI * 2;
      const a = Math.sin(phi) * Math.max(0.0005, rxs[r]);
      const b = Math.cos(phi) * Math.max(0.0005, rzs[r]);
      if (axisZ) pos.push(a, b + zs[r], ys[r]);
      else pos.push(a, ys[r], b + zs[r]);
      uv.push(c / segs, r / (rows - 1));
    }
  }
  for (let r = 0; r < rows - 1; r++)
    for (let c = 0; c < segs; c++) {
      const i0 = r * (segs + 1) + c;
      const i1 = i0 + segs + 1;
      // Caras hacia afuera (el orden de los vértices define de qué lado se ve la cara).
      if (axisZ) idx.push(i0, i1, i0 + 1, i0 + 1, i1, i1 + 1);
      else idx.push(i0, i0 + 1, i1, i0 + 1, i1 + 1, i1);
    }
  // Tapas: un punto en el centro del primer / último anillo.
  const cap = (row: number, bottom: boolean) => {
    const center = pos.length / 3;
    if (axisZ) pos.push(0, zs[row], ys[row]);
    else pos.push(0, ys[row], zs[row]);
    uv.push(0.5, row / (rows - 1));
    for (let c = 0; c < segs; c++) {
      const a = row * (segs + 1) + c;
      const flip = bottom !== axisZ;
      if (flip) idx.push(center, a + 1, a);
      else idx.push(center, a, a + 1);
    }
  };
  if (opts.capBottom) cap(0, true);
  if (opts.capTop) cap(rows - 1, false);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  weldSeam(geo, rows, segs);
  return geo;
}

/**
 * Pieza torneada que va del punto a al b, con el radio que indica el perfil [(t de 0 a 1, radio)].
 * Sirve para brazos y piernas con músculo (más gruesos en el medio) y para mangas y botamangas.
 * La geometría queda ya ubicada en el espacio.
 */
export function axisLathe(
  a: V3,
  b: V3,
  profile: [number, number][],
  opts: { segments?: number; sub?: number; capA?: boolean; capB?: boolean; flatten?: number } = {},
): THREE.BufferGeometry {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const len = va.distanceTo(vb);
  const ts = smooth(profile.map((p) => p[0]), opts.sub ?? 3);
  const rs = smooth(profile.map((p) => p[1]), opts.sub ?? 3);
  const rings: Ring[] = ts.map((t, i) => ({ y: t * len, rx: rs[i], rz: rs[i] * (opts.flatten ?? 1), z: 0 }));
  const geo = ringTube(rings, { segments: opts.segments ?? 24, sub: 1, capBottom: opts.capA, capTop: opts.capB });
  const dir = vb.clone().sub(va).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  geo.applyMatrix4(new THREE.Matrix4().compose(va, q, new THREE.Vector3(1, 1, 1)));
  return geo;
}

/**
 * Base (rotación) para una mano o un pie: el eje local −y apunta en `down`, y el +x local queda
 * lo más parecido posible a `out` (hacia afuera del cuerpo).
 */
export function basisQuaternion(down: THREE.Vector3, out: THREE.Vector3): THREE.Quaternion {
  const y = down.clone().normalize().negate();
  const x = out.clone().sub(y.clone().multiplyScalar(out.dot(y))).normalize();
  const z = new THREE.Vector3().crossVectors(x, y).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}
