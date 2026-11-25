import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { axisLathe, basisQuaternion, ringTube, smooth } from "./shapes";

/** Comprueba que las caras miran hacia afuera: la normal de cada triángulo se aleja del eje. */
function outwardRatio(geo: THREE.BufferGeometry, axis: "y" | "z") {
  const pos = geo.attributes.position;
  const idx = geo.index!;
  let ok = 0;
  let total = 0;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < idx.count; i += 3) {
    a.fromBufferAttribute(pos, idx.getX(i));
    b.fromBufferAttribute(pos, idx.getX(i + 1));
    c.fromBufferAttribute(pos, idx.getX(i + 2));
    const n = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
    const center = a.clone().add(b).add(c).divideScalar(3);
    const radial = axis === "y" ? new THREE.Vector3(center.x, 0, center.z) : new THREE.Vector3(center.x, center.y, 0);
    const along = axis === "y" ? Math.abs(n.clone().normalize().y) : Math.abs(n.clone().normalize().z);
    if (radial.length() < 1e-4 || along > 0.95) continue; // tapas: se miden aparte
    total++;
    if (n.dot(radial) > 0) ok++;
  }
  return ok / total;
}

/** Normal promedio de las tapas: la de abajo tiene que mirar hacia abajo y la de arriba hacia arriba. */
function capNormals(geo: THREE.BufferGeometry, axis: "y" | "z") {
  const pos = geo.attributes.position;
  const idx = geo.index!;
  const k = axis === "y" ? 1 : 2;
  let low = 0;
  let high = 0;
  const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  for (let i = 0; i < idx.count; i += 3) {
    v.forEach((p, j) => p.fromBufferAttribute(pos, idx.getX(i + j)));
    const n = new THREE.Vector3().crossVectors(v[1].clone().sub(v[0]), v[2].clone().sub(v[0])).normalize();
    const c = (v[0].getComponent(k) + v[1].getComponent(k) + v[2].getComponent(k)) / 3;
    if (Math.abs(n.getComponent(k)) < 0.95) continue;
    if (c < 0.01) low += n.getComponent(k);
    else high += n.getComponent(k);
  }
  return { low, high };
}

describe("formas", () => {
  it("smooth pasa por los puntos originales", () => {
    const s = smooth([0, 1, 0.5], 4);
    expect(s[0]).toBe(0);
    expect(s[4]).toBeCloseTo(1);
    expect(s[s.length - 1]).toBe(0.5);
    expect(s).toHaveLength(9);
  });

  it("los tubos verticales miran hacia afuera", () => {
    const g = ringTube(
      [
        { y: 0, rx: 0.1, rz: 0.06, z: 0 },
        { y: 0.5, rx: 0.12, rz: 0.08, z: 0 },
        { y: 1, rx: 0.05, rz: 0.05, z: 0 },
      ],
      { capBottom: true, capTop: true },
    );
    expect(outwardRatio(g, "y")).toBeGreaterThan(0.98);
    const caps = capNormals(g, "y");
    expect(caps.low).toBeLessThan(0);
    expect(caps.high).toBeGreaterThan(0);
  });

  it("los tubos acostados (pie) miran hacia afuera", () => {
    const g = ringTube(
      [
        { y: -0.05, rx: 0.03, rz: 0.02, z: 0 },
        { y: 0.1, rx: 0.04, rz: 0.02, z: 0 },
      ],
      { axis: "z", capBottom: true, capTop: true },
    );
    expect(outwardRatio(g, "z")).toBeGreaterThan(0.98);
    const caps = capNormals(g, "z");
    expect(caps.low).toBeLessThan(0);
    expect(caps.high).toBeGreaterThan(0);
  });

  it("axisLathe va de a hasta b", () => {
    const g = axisLathe([0, 1, 0], [0, 0, 0], [
      [0, 0.05],
      [1, 0.03],
    ]);
    g.computeBoundingBox();
    expect(g.boundingBox!.max.y).toBeCloseTo(1, 2);
    expect(g.boundingBox!.min.y).toBeCloseTo(0, 2);
  });

  it("basisQuaternion apunta −y hacia abajo y +x hacia afuera", () => {
    const q = basisQuaternion(new THREE.Vector3(0, -1, 0.2), new THREE.Vector3(1, 0, 0));
    const down = new THREE.Vector3(0, -1, 0).applyQuaternion(q);
    const out = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    expect(down.y).toBeLessThan(-0.9);
    expect(out.x).toBeGreaterThan(0.9);
  });
});
