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

// ───────────────────────── Detalles sobre la ropa ─────────────────────────
// Bolsillos, tiras de botones, franjas y logos se apoyan sobre la superficie de la prenda: en el
// torso (un óvalo por altura) o en una pieza torneada (pierna, brazo). Ángulos: 0 = adelante,
// +π/2 = hacia +x (el costado izquierdo del avatar, que mira hacia +z).

/** Punto sobre el óvalo de la prenda a cierta altura y ángulo, separado `off` hacia afuera. */
export function shellPoint(shell: Ring[], y: number, phi: number, off = 0): THREE.Vector3 {
  const r = ringAtRings(shell, y);
  const x = r.rx * Math.sin(phi);
  const z = r.rz * Math.cos(phi);
  // Normal del óvalo en ese punto.
  const nx = x / (r.rx * r.rx);
  const nz = z / (r.rz * r.rz);
  const len = Math.hypot(nx, nz) || 1;
  return new THREE.Vector3(x + (nx / len) * off, y, r.z + z + (nz / len) * off);
}

/** Ángulo del punto de adelante (o de atrás) del óvalo que está a cierta x. */
export function phiAtX(shell: Ring[], y: number, x: number, back = false): number {
  const r = ringAtRings(shell, y);
  const s = Math.asin(Math.max(-0.98, Math.min(0.98, x / r.rx)));
  return back ? Math.PI - s : s;
}

/**
 * Parche curvo pegado a la prenda: de `y0` a `y1`, y en cada altura entre los ángulos que diga
 * `range`. La textura (si tiene) va de izquierda a derecha y de abajo arriba.
 */
export function shellPatch(
  shell: Ring[],
  y0: number,
  y1: number,
  range: (y: number) => [number, number],
  off = 0.0015,
  nx = 12,
  ny = 8,
): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  for (let j = 0; j <= ny; j++) {
    const y = y0 + ((y1 - y0) * j) / ny;
    const [a, b] = range(y);
    for (let i = 0; i <= nx; i++) {
      const p = shellPoint(shell, y, a + ((b - a) * i) / nx, off);
      pos.push(p.x, p.y, p.z);
      uv.push(i / nx, j / ny);
    }
  }
  return gridGeometry(pos, uv, nx, ny);
}

/** Marco de una pieza torneada de `a` a `b`: eje, "adelante" y "costado" (+x). */
export function limbFrame(a: V3, b: V3) {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const d = vb.clone().sub(va).normalize();
  const fwd = new THREE.Vector3(0, 0, 1).sub(d.clone().multiplyScalar(d.z)).normalize();
  const side = new THREE.Vector3().crossVectors(fwd, d).normalize();
  return { a: va, b: vb, d, fwd, side };
}

/** Punto sobre una pieza torneada: `t` a lo largo (0 en a, 1 en b), a cierto ángulo y radio. */
export function limbPoint(frame: ReturnType<typeof limbFrame>, t: number, theta: number, r: number): THREE.Vector3 {
  return frame.a
    .clone()
    .lerp(frame.b, t)
    .addScaledVector(frame.fwd, Math.cos(theta) * r)
    .addScaledVector(frame.side, Math.sin(theta) * r);
}

/** Parche curvo sobre una pieza torneada (bolsillo cargo, franja de la pierna, logo). */
export function limbPatch(
  frame: ReturnType<typeof limbFrame>,
  t0: number,
  t1: number,
  theta0: number,
  theta1: number,
  radius: (t: number) => number,
  nx = 10,
  ny = 8,
): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  // De abajo (t1) hacia arriba (t0), así la textura queda derecha.
  for (let j = 0; j <= ny; j++) {
    const t = t1 + ((t0 - t1) * j) / ny;
    for (let i = 0; i <= nx; i++) {
      const p = limbPoint(frame, t, theta0 + ((theta1 - theta0) * i) / nx, radius(t));
      pos.push(p.x, p.y, p.z);
      uv.push(i / nx, j / ny);
    }
  }
  return gridGeometry(pos, uv, nx, ny);
}

/**
 * Tramo final de una pieza torneada (toda la vuelta) cuyo borde de abajo cambia con el ángulo:
 * el ruedo de un short con tajo al costado. `t1(theta)` dice dónde termina en cada ángulo.
 */
export function limbHemPatch(
  frame: ReturnType<typeof limbFrame>,
  t0: number,
  t1: (theta: number) => number,
  radius: (t: number) => number,
  nx = 48,
  ny = 4,
): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const theta = -Math.PI + (2 * Math.PI * i) / nx;
      const end = t1(theta);
      const t = end + ((t0 - end) * j) / ny;
      const p = limbPoint(frame, t, theta, radius(t));
      pos.push(p.x, p.y, p.z);
      uv.push(i / nx, j / ny);
    }
  }
  return gridGeometry(pos, uv, nx, ny);
}

/** Número entre 0 y 1 que parece al azar pero siempre es el mismo para cada i (así no "bailan"). */
function noise(i: number): number {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Flecos de un ruedo deshilachado: hilitos de distinto largo que cuelgan del borde. */
export function fringeGeometry(frame: ReturnType<typeof limbFrame>, t: number, r: number, n = 120): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < n; i++) {
    const theta = (2 * Math.PI * (i + 0.4 * noise(i))) / n;
    const len = 0.004 + 0.011 * noise(i + 31) ** 1.5;
    const w = 0.0016 + 0.0012 * noise(i + 57);
    const base = limbPoint(frame, t, theta, r);
    const tangent = frame.fwd.clone().multiplyScalar(-Math.sin(theta)).addScaledVector(frame.side, Math.cos(theta));
    const out = frame.fwd.clone().multiplyScalar(Math.cos(theta)).addScaledVector(frame.side, Math.sin(theta));
    const tip = base.clone().addScaledVector(frame.d, len).addScaledVector(out, len * 0.12);
    const k = pos.length / 3;
    for (const [p, half] of [
      [base, w / 2],
      [tip, w * 0.2],
    ] as const) {
      const a = p.clone().addScaledVector(tangent, -half);
      const b = p.clone().addScaledVector(tangent, half);
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
    idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function gridGeometry(pos: number[], uv: number[], nx: number, ny: number): THREE.BufferGeometry {
  const idx: number[] = [];
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

/** Cordón, costura o tira que pasa por varios puntos. */
export function pathTube(points: THREE.Vector3[], r: number, segments = 32): THREE.BufferGeometry {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segments, r, 6, false);
}

/** Óvalo interpolado entre cortes (igual que ringAt de skeleton, sin importar desde ahí). */
function ringAtRings(rings: Ring[], y: number): Ring {
  if (y <= rings[0].y) return rings[0];
  for (let i = 1; i < rings.length; i++) {
    const a = rings[i - 1];
    const b = rings[i];
    if (y <= b.y) {
      const t = (y - a.y) / (b.y - a.y);
      return { y, rx: a.rx + (b.rx - a.rx) * t, rz: a.rz + (b.rz - a.rz) * t, z: a.z + (b.z - a.z) * t };
    }
  }
  return rings[rings.length - 1];
}
