"use client";

// Avatar 3D tipo maniquí: proporciones del perfil y colores de la ropa elegida.
// Se arma con formas simples (sin modelos externos) para que cargue rápido en el celular.

import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { HAIR_WITH_BACK, cameraFor, glassesById, type BodyDims, type GlassesDef, type Look, type View } from "@/lib/avatar";
import type { AvatarStyle } from "@/lib/types";

type V3 = [number, number, number];

/** Textura rayada para las prendas estampadas. */
function useStripes(color: string, striped: boolean) {
  return useMemo(() => {
    if (!striped || typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    for (let y = 0; y < 64; y += 16) ctx.fillRect(0, y, 64, 6);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(4, 6);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [color, striped]);
}

/** Degradé de 3 tonos para el sombreado tipo dibujo animado. */
let toonGradient: THREE.DataTexture | null = null;
function getToonGradient() {
  if (!toonGradient) {
    toonGradient = new THREE.DataTexture(new Uint8Array([120, 200, 255]), 3, 1, THREE.RedFormat);
    toonGradient.minFilter = THREE.NearestFilter;
    toonGradient.magFilter = THREE.NearestFilter;
    toonGradient.needsUpdate = true;
  }
  return toonGradient;
}

function Mat({ color, striped = false, double = false }: { color: string; striped?: boolean; double?: boolean; rough?: number }) {
  const map = useStripes(color, striped);
  return (
    <meshToonMaterial
      color={map ? "#ffffff" : color}
      map={map ?? undefined}
      gradientMap={getToonGradient()}
      side={double ? THREE.DoubleSide : THREE.FrontSide}
    />
  );
}

/** Cápsula entre dos puntos (brazos, piernas). */
function Limb({ a, b, r, children }: { a: V3; b: V3; r: number; children: React.ReactNode }) {
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

/** Pieza con forma de torso (o pollera) hecha girando un perfil. Se aplana para que no sea un cilindro. */
function Lathe({ points, children, flat = 0.62 }: { points: [number, number][]; children: React.ReactNode; flat?: number }) {
  const geom = useMemo(() => new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), 40), [points]);
  return (
    <mesh geometry={geom} scale={[1, 1, flat]} castShadow>
      {children}
    </mesh>
  );
}


const HEAD_Y = 1.67;
const HEAD_R = 0.15;

/** Cabeza estilo caricatura: grande, redonda, con ojos con brillo, cejas, sonrisa y cachetes. Parpadea. */
function Head({ skin, style, cap }: { skin: string; style: AvatarStyle; cap: boolean }) {
  const eyes = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const nextBlink = useRef(2);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (head.current) head.current.rotation.z = Math.sin(t * 0.7) * 0.025;
    if (eyes.current) {
      if (t > nextBlink.current) {
        const k = (t - nextBlink.current) / 0.14;
        eyes.current.scale.y = k < 1 ? Math.abs(1 - 2 * k) * 0.9 + 0.1 : 1;
        if (k >= 1) nextBlink.current = t + 2.5 + Math.random() * 3;
      }
    }
  });
  const hair = style.hairColor;
  const R = HEAD_R;
  const expr = style.expression ?? "sonrisa";
  const glasses = style.glasses ?? "ninguno";
  const wink = expr === "guino";
  return (
    <group ref={head} position={[0, HEAD_Y, 0]}>
      {/* Cara */}
      <mesh scale={[1, 1.04, 0.96]} castShadow>
        <sphereGeometry args={[R, 40, 32]} />
        <Mat color={skin} />
      </mesh>
      {/* Orejas */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * R * 0.97, -0.005, 0]} scale={[0.55, 1, 0.8]}>
          <sphereGeometry args={[0.032, 16, 16]} />
          <Mat color={skin} />
        </mesh>
      ))}
      {/* Ojos con brillo */}
      <group ref={eyes} position={[0, 0.012, 0]}>
        {[-1, 1].map((s) =>
          wink && s === 1 ? (
            <mesh key={s} position={[s * 0.052, -0.004, R * 0.93]} rotation={[0.1, 0, Math.PI]}>
              <torusGeometry args={[0.02, 0.005, 8, 16, Math.PI]} />
              <meshBasicMaterial color="#2a1f1a" />
            </mesh>
          ) : (
          <group key={s} position={[s * 0.052, 0, R * 0.86]}>
            <mesh scale={[1, 1.15, 0.6]}>
              <sphereGeometry args={[0.03, 20, 20]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            <mesh position={[0, -0.002, 0.014]} scale={[1, 1.1, 0.6]}>
              <sphereGeometry args={[0.02, 20, 20]} />
              <meshBasicMaterial color="#2a1f1a" />
            </mesh>
            <mesh position={[0.007, 0.008, 0.027]}>
              <sphereGeometry args={[0.0065, 10, 10]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          </group>
          ),
        )}
      </group>
      {/* Cejas */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[s * 0.052, expr === "feliz" ? 0.064 : 0.058, R * 0.9]}
          rotation={[0, 0, Math.PI / 2 + s * (expr === "serio" ? -0.05 : 0.12)]}
        >
          <capsuleGeometry args={[0.006, 0.03, 4, 8]} />
          <meshBasicMaterial color={hair} />
        </mesh>
      ))}
      {/* Nariz */}
      <mesh position={[0, -0.018, R * 0.97]}>
        <sphereGeometry args={[0.014, 16, 16]} />
        <Mat color={skin} />
      </mesh>
      {/* Boca según la expresión */}
      {expr === "serio" ? (
        <mesh position={[0, -0.058, R * 0.93]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.005, 0.034, 4, 8]} />
          <meshBasicMaterial color="#8a3b2e" />
        </mesh>
      ) : expr === "feliz" ? (
        <group position={[0, -0.05, R * 0.9]} rotation={[0.15, 0, 0]}>
          <mesh rotation={[0, 0, Math.PI]} scale={[1, 1, 0.4]}>
            <circleGeometry args={[0.032, 24, 0, Math.PI]} />
            <meshBasicMaterial color="#6e2a22" side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, -0.019, 0.002]} scale={[1, 0.5, 1]}>
            <circleGeometry args={[0.016, 16]} />
            <meshBasicMaterial color="#e5736b" />
          </mesh>
        </group>
      ) : (
        <mesh position={[0, -0.05, R * 0.9]} rotation={[0.15, 0, Math.PI]}>
          <torusGeometry args={[0.026, 0.0055, 8, 24, Math.PI]} />
          <meshBasicMaterial color="#8a3b2e" />
        </mesh>
      )}
      {/* Anteojos */}
      {glasses !== "ninguno" && <Glasses kind={glasses} color={style.glassesColor} />}
      {/* Cachetes */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.088, -0.03, R * 0.78]} rotation={[0, s * 0.5, 0]} scale={[1, 0.7, 0.25]}>
          <sphereGeometry args={[0.022, 16, 16]} />
          <meshBasicMaterial color="#ff8a80" transparent opacity={0.35} />
        </mesh>
      ))}
      {/* Pelo (con gorra se ve solo lo de atrás) */}
      {!cap && <Hair kind={style.hair} color={hair} />}
      {cap && HAIR_WITH_BACK.includes(style.hair) && <Hair kind={style.hair} color={hair} backOnly />}
      {/* Barba */}
      {style.beard && (
        <mesh scale={[1.03, 1.06, 1]}>
          <sphereGeometry args={[R * 1.01, 32, 16, 0, Math.PI, Math.PI * 0.68, Math.PI * 0.26]} />
          <Mat color={hair} />
        </mesh>
      )}
    </group>
  );
}


/** Contorno de un vidrio (el derecho; el izquierdo es el espejo). x positivo = hacia afuera. */
function lensOutline(shape: GlassesDef["shape"]): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  const n = 48;
  // Superelipse: e=2 es una elipse, más grande se vuelve más cuadrada.
  const se = (a: number, b: number, e: number, t: number) => {
    const c = Math.cos(t);
    const sn = Math.sin(t);
    return [a * Math.sign(c) * Math.abs(c) ** (2 / e), b * Math.sign(sn) * Math.abs(sn) ** (2 / e)];
  };
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    let x: number;
    let y: number;
    switch (shape) {
      case "round":
        [x, y] = se(0.033, 0.033, 2, t);
        break;
      case "square":
        [x, y] = se(0.036, 0.029, 4.5, t);
        break;
      case "rect":
        [x, y] = se(0.038, 0.02, 5, t);
        break;
      case "thick":
        // Tipo wayfarer: más ancho arriba que abajo.
        [x, y] = se(0.037, 0.027, 4, t);
        x *= 1 + 0.14 * (y / 0.027);
        break;
      case "aviator": {
        // Gota: arriba casi recto, abajo más largo y hacia la nariz.
        [x, y] = se(0.037, 0.03, 2.6, t);
        if (y < 0) {
          const k = -y / 0.03;
          y *= 1.25;
          x -= 0.012 * k;
        } else y *= 0.85;
        break;
      }
      case "cateye":
        // Ojo de gato: la punta de afuera sube.
        [x, y] = se(0.036, 0.025, 3, t);
        if (y > 0 && x > 0) y += 0.02 * (x / 0.036) ** 3 * (y / 0.025);
        break;
      case "oversize":
        [x, y] = se(0.045, 0.039, 3.4, t);
        break;
      case "sport": {
        // Una sola visera para los dos ojos, con hueco para la nariz.
        [x, y] = se(0.112, 0.03, 4, t);
        if (y < 0 && Math.abs(x) < 0.03) y *= 0.35 + 0.65 * (Math.abs(x) / 0.03);
        break;
      }
    }
    pts.push(new THREE.Vector2(x, y));
  }
  return pts;
}

function frameShape(pts: THREE.Vector2[], k: number): THREE.Shape {
  const outer = new THREE.Shape(pts.map((p) => p.clone().multiplyScalar(1 + k)));
  outer.holes.push(new THREE.Path([...pts].reverse()));
  return outer;
}

function Glasses({ kind, color }: { kind: NonNullable<AvatarStyle["glasses"]>; color?: string }) {
  const R = HEAD_R;
  const def = glassesById(kind);
  const frame = color ?? def.frame;
  const sport = def.shape === "sport";
  const k = def.shape === "thick" || def.shape === "oversize" ? 0.22 : def.shape === "rect" ? 0.09 : sport ? 0.07 : 0.13;
  const { lens, rim, halfW, halfH } = useMemo(() => {
    const pts = lensOutline(def.shape);
    const lens = new THREE.ShapeGeometry(new THREE.Shape(pts));
    const rim = new THREE.ExtrudeGeometry(frameShape(pts, k), { depth: 0.005, bevelEnabled: false, curveSegments: 4 });
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    return { lens, rim, halfW: Math.max(...xs) * (1 + k), halfH: Math.max(...ys) };
  }, [def.shape, k]);
  useEffect(
    () => () => {
      lens.dispose();
      rim.dispose();
    },
    [lens, rim],
  );
  const lensMat = (
    <meshBasicMaterial
      color={def.lens}
      transparent
      opacity={def.sun ? (def.mirror ? 1 : 0.97) : 0.16}
      side={THREE.DoubleSide}
      depthWrite={false}
    />
  );
  const frameMat = <meshToonMaterial color={frame} gradientMap={getToonGradient()} side={THREE.DoubleSide} />;
  // Brillo en el vidrio (más fuerte en los espejados).
  const glint = (x: number) =>
    def.sun && (
      <mesh position={[x - 0.01, halfH * 0.35, 0.004]} rotation={[0, 0, -0.7]}>
        <planeGeometry args={[0.008, 0.03]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={def.mirror ? 0.55 : 0.28} depthWrite={false} />
      </mesh>
    );
  const cx = 0.054;
  const outerX = sport ? halfW : cx + halfW;
  const templeY = sport ? halfH * 0.4 : halfH * 0.45;
  return (
    <group position={[0, 0.012, R * 0.97]}>
      {sport ? (
        <group>
          <mesh geometry={lens}>{lensMat}</mesh>
          <mesh geometry={rim} position={[0, 0, -0.0025]}>
            {frameMat}
          </mesh>
          {glint(-0.05)}
          {glint(0.06)}
        </group>
      ) : (
        [-1, 1].map((s) => (
          <group key={s} position={[s * cx, 0, 0]} scale={[s, 1, 1]}>
            <mesh geometry={lens}>{lensMat}</mesh>
            <mesh geometry={rim} position={[0, 0, -0.0025]}>
              {frameMat}
            </mesh>
            {glint(0)}
          </group>
        ))
      )}
      {/* Puente (doble en los aviador) */}
      {!sport && (
        <mesh position={[0, halfH * 0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.0032, Math.max(0.004, 2 * (cx - halfW) + 0.004), 4, 8]} />
          {frameMat}
        </mesh>
      )}
      {def.shape === "aviator" && (
        <mesh position={[0, halfH * 0.95, 0]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.0025, 2 * (cx - halfW) + 0.02, 4, 8]} />
          {frameMat}
        </mesh>
      )}
      {/* Patillas hasta las orejas */}
      {[-1, 1].map((s) => (
        <Limb key={s} a={[s * outerX, templeY, -0.002]} b={[s * R * 0.99, templeY - 0.01, -R * 0.97]} r={0.0035}>
          {frameMat}
        </Limb>
      ))}
    </group>
  );
}

/** Dirección sobre la cabeza a partir de dos ángulos (theta desde arriba, phi alrededor; phi=0 es adelante). */
function dirOn(theta: number, phi: number, r: number): V3 {
  return [Math.sin(theta) * Math.sin(phi) * r, Math.cos(theta) * r, Math.sin(theta) * Math.cos(phi) * r];
}

function Hair({ kind, color, backOnly = false }: { kind: AvatarStyle["hair"]; color: string; backOnly?: boolean }) {
  const R = HEAD_R;
  const mat = <Mat color={color} />;
  // Parte de atrás de la cabeza (hasta la nuca), para que no quede pelada al girar.
  const nape = (material: React.ReactNode, scale: V3 = [1.06, 1.04, 1.06], rot = 0) => (
    <mesh key="nuca" position={[0, 0.012, -0.008]} scale={scale} rotation={[rot, 0, 0]}>
      <sphereGeometry args={[R * 0.995, 32, 12, Math.PI + 0.12, Math.PI - 0.24, Math.PI * 0.25, Math.PI * 0.36]} />
      {material}
    </mesh>
  );
  const cap = (h: number, yScale = 1.04) => (
    <group key="cap">
      <mesh position={[0, 0.012, -0.008]} scale={[1.06, yScale, 1.06]}>
        <sphereGeometry args={[R, 32, 16, 0, Math.PI * 2, 0, h]} />
        {mat}
      </mesh>
      {nape(mat, [1.06, yScale, 1.06])}
    </group>
  );
  // Pelo bien cortito: se transparenta un poco la piel.
  const buzzMat = <meshToonMaterial color={color} gradientMap={getToonGradient()} transparent opacity={0.72} />;
  const buzz = (h: number) => (
    <group key="cap">
      <mesh position={[0, 0.01, -0.006]} scale={[1.025, 1.02, 1.025]}>
        <sphereGeometry args={[R, 32, 16, 0, Math.PI * 2, 0, h]} />
        {buzzMat}
      </mesh>
      <mesh position={[0, 0.01, -0.006]} scale={[1.025, 1.02, 1.025]}>
        <sphereGeometry args={[R, 32, 12, Math.PI + 0.12, Math.PI - 0.24, h, Math.PI * 0.61 - h]} />
        {buzzMat}
      </mesh>
    </group>
  );
  // Pelo atado: tirante hacia atrás, deja más frente a la vista.
  const pulled = () => (
    <group key="cap">
      <mesh position={[0, 0.012, -0.02]} scale={[1.06, 1.03, 1.06]} rotation={[-0.22, 0, 0]}>
        <sphereGeometry args={[R, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.4]} />
        {mat}
      </mesh>
      {nape(mat, [1.06, 1.03, 1.06])}
    </group>
  );
  const ball = (key: string, p: V3, r: number, scale?: V3) => (
    <mesh key={key} position={p} scale={scale}>
      <sphereGeometry args={[r, 16, 14]} />
      {mat}
    </mesh>
  );
  // Rulos y afro: bolitas repartidas en anillos (sin tapar la cara).
  const curls = useMemo(() => {
    const ring = (rings: [number, number][], r: number) => {
      const out: V3[] = [];
      for (const [theta, n] of rings)
        for (let i = 0; i < n; i++) {
          const phi = (i / n) * Math.PI * 2 + theta;
          const p = dirOn(theta, phi, r);
          if (theta > 0.85 && p[2] > R * 0.3) continue;
          out.push([p[0], p[1] + 0.01, p[2] - 0.01]);
        }
      return out;
    };
    return {
      rulos: ring([[0.15, 4], [0.6, 9], [1.05, 11]], R * 1.05),
      afro: ring([[0, 1], [0.35, 7], [0.75, 12], [1.15, 14], [1.5, 12]], R * 1.2),
    };
  }, [R]);
  // Puntas del despeinado, cada una apuntando hacia afuera.
  const spikes = useMemo(() => {
    const dirs: [number, number][] = [
      [0.15, 0], [0.35, 0.4], [0.35, -0.5], [0.55, 0.15], [0.55, 1.1], [0.55, -1.2],
      [0.7, 0.6], [0.7, -0.6], [0.45, 2.2], [0.45, -2.3], [0.2, 3], [0.7, 2.8],
    ];
    return dirs.map(([t, ph]) => {
      const d = new THREE.Vector3(...dirOn(t, ph, 1));
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
      return { pos: d.clone().multiplyScalar(R * 1.06).toArray() as V3, q };
    });
  }, [R]);

  const front: React.ReactNode[] = [];
  const back: React.ReactNode[] = [];
  let top: React.ReactNode = null;

  switch (kind) {
    case "pelado":
      break;
    case "rapado":
      top = buzz(Math.PI * 0.42);
      break;
    case "corto":
      top = cap(Math.PI * 0.37, 1.05);
      front.push(
        <mesh key="jopo" position={[0.02, R * 0.78, R * 0.5]} rotation={[0.9, 0, -0.35]} scale={[1.5, 0.55, 0.9]}>
          <sphereGeometry args={[0.055, 20, 16]} />
          {mat}
        </mesh>,
      );
      break;
    case "costado":
      top = cap(Math.PI * 0.38, 1.05);
      front.push(
        <mesh key="barrido" position={[-0.03, R * 0.84, R * 0.42]} rotation={[0.75, 0, 0.45]} scale={[2, 0.5, 1.05]}>
          <sphereGeometry args={[0.055, 20, 16]} />
          {mat}
        </mesh>,
        <mesh key="raya" position={[0.045, R * 0.99, 0.02]} rotation={[0, 0, -0.3]} scale={[0.3, 0.12, 2.6]}>
          <sphereGeometry args={[0.03, 10, 8]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.18} />
        </mesh>,
      );
      break;
    case "flequillo":
      top = cap(Math.PI * 0.36, 1.03);
      front.push(
        <mesh key="flequillo" position={[0, 0.004, -0.002]}>
          <sphereGeometry args={[R * 1.08, 32, 8, Math.PI / 2 - 1, 2, Math.PI * 0.12, Math.PI * 0.29]} />
          <Mat color={color} double />
        </mesh>,
      );
      // Puntas del flequillo sobre la frente.
      for (let k = -3; k <= 3; k++) {
        const ph = k * 0.22;
        const p = dirOn(Math.PI * 0.41, ph, R * 1.07);
        front.push(
          <mesh key={`f${k}`} position={[p[0], p[1] + 0.006, p[2] + 0.004]} rotation={[Math.PI - 0.5, ph, 0]}>
            <coneGeometry args={[0.016, 0.03, 8]} />
            {mat}
          </mesh>,
        );
      }
      break;
    case "despeinado":
      top = cap(Math.PI * 0.37, 1.05);
      spikes.forEach(({ pos, q }, i) =>
        front.push(
          <mesh key={`p${i}`} position={pos} quaternion={q}>
            <coneGeometry args={[0.03, 0.075, 10]} />
            {mat}
          </mesh>,
        ),
      );
      break;
    case "cresta":
      top = buzz(Math.PI * 0.42);
      for (let k = 0; k < 6; k++) {
        const a = -0.35 + k * 0.32;
        front.push(
          <mesh
            key={`c${k}`}
            position={[0, Math.cos(a) * R * 1.02 + 0.01, Math.sin(-a) * R * 1.02]}
            rotation={[-a, 0, 0]}
            scale={[0.6, 1, 1.4]}
          >
            <coneGeometry args={[0.04, 0.1, 14]} />
            {mat}
          </mesh>,
        );
      }
      break;
    case "rulos":
      top = cap(Math.PI * 0.36, 1);
      curls.rulos.forEach((p, i) => front.push(ball(`r${i}`, p, 0.045)));
      break;
    case "afro":
      top = cap(Math.PI * 0.42, 1.08);
      curls.afro.forEach((p, i) => front.push(ball(`a${i}`, p, 0.066)));
      break;
    case "ondas":
      top = cap(Math.PI * 0.4, 1.03);
      for (const s of [-1, 1])
        for (let k = 0; k < 3; k++)
          back.push(ball(`o${s}${k}`, [s * (R * 0.92 - k * 0.006), -0.02 - k * 0.055, -0.02 - k * 0.01], 0.045 - k * 0.004));
      back.push(
        <mesh key="atras" position={[0, -0.06, -0.09]} scale={[1.05, 1, 0.55]}>
          <capsuleGeometry args={[0.11, 0.08, 8, 16]} />
          {mat}
        </mesh>,
      );
      break;
    case "melena":
      top = cap(Math.PI * 0.4, 1.03);
      back.push(
        <mesh key="carre" position={[0, 0.008, -0.006]}>
          <sphereGeometry args={[R * 1.1, 32, 12, Math.PI / 2 + 0.85, Math.PI * 2 - 1.7, Math.PI * 0.3, Math.PI * 0.42]} />
          <Mat color={color} double />
        </mesh>,
      );
      break;
    case "largo":
      top = cap(Math.PI * 0.4, 1.02);
      back.push(
        <mesh key="atras" position={[0, -0.12, -0.075]} scale={[1.05, 1, 0.55]}>
          <capsuleGeometry args={[0.12, 0.14, 8, 16]} />
          {mat}
        </mesh>,
      );
      for (const s of [-1, 1])
        back.push(
          <mesh key={`l${s}`} position={[s * 0.12, -0.08, 0.02]} scale={[0.4, 1, 0.6]}>
            <capsuleGeometry args={[0.05, 0.12, 6, 12]} />
            {mat}
          </mesh>,
        );
      break;
    case "colita":
      top = pulled();
      back.push(
        ball("gomita", [0, 0.035, -0.155], 0.028),
        <mesh key="cola" position={[0, -0.075, -0.19]} rotation={[0.3, 0, 0]}>
          <capsuleGeometry args={[0.034, 0.15, 6, 12]} />
          {mat}
        </mesh>,
      );
      break;
    case "rodete":
      top = pulled();
      front.push(ball("rodete", [0, R * 1.04 + 0.035, -0.035], 0.058, [1, 0.85, 1]));
      break;
    case "recogido":
      top = pulled();
      back.push(ball("rodete", [0, 0.11, -0.12], 0.06));
      break;
    case "trenzas":
      top = pulled();
      for (const s of [-1, 1])
        for (let k = 0; k < 6; k++)
          back.push(ball(`t${s}${k}`, [s * (0.118 - k * 0.003), -0.04 - k * 0.045, -0.03 + k * 0.012], 0.028 - k * 0.0015, [1, 1.2, 1]));
      break;
    case "rastas":
      top = cap(Math.PI * 0.38, 1.03);
      for (let i = 0; i < 15; i++) {
        const a = 0.95 + (i / 14) * (Math.PI * 2 - 1.9);
        const x = Math.sin(a) * 0.155;
        const z = Math.cos(a) * 0.155 - 0.01;
        back.push(
          <mesh key={`d${i}`} position={[x, -0.09, z]} rotation={[-Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15]}>
            <capsuleGeometry args={[0.017, 0.19, 4, 8]} />
            {mat}
          </mesh>,
        );
      }
      break;
  }

  if (backOnly) return <group>{back}</group>;
  return (
    <group>
      {top}
      {front}
      {back}
    </group>
  );
}

/**
 * Mira la foto de la prenda: dónde está (para recortar justo el pecho, aunque la prenda no esté
 * centrada) y de qué color es la tela (cerca del ruedo, donde casi nunca hay estampado).
 */
function analyzePhoto(img: CanvasImageSource): { box: [number, number, number, number]; fabric: string | null } {
  const full: [number, number, number, number] = [0, 0, 1, 1];
  try {
    const N = 64;
    const c = document.createElement("canvas");
    c.width = c.height = N;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return { box: full, fabric: null };
    ctx.drawImage(img, 0, 0, N, N);
    const d = ctx.getImageData(0, 0, N, N).data;
    const px = (x: number, y: number) => {
      const i = (y * N + x) * 4;
      return [d[i], d[i + 1], d[i + 2]];
    };
    // Fondo: promedio de las 4 esquinas.
    const corners = [px(1, 1), px(N - 2, 1), px(1, N - 2), px(N - 2, N - 2)];
    const bg = [0, 1, 2].map((k) => corners.reduce((s, c) => s + c[k], 0) / 4);
    let x0 = N, y0 = N, x1 = -1, y1 = -1;
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const [r, g, b] = px(x, y);
        if (Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) > 60) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    const box: [number, number, number, number] =
      x1 - x0 > N * 0.25 && y1 - y0 > N * 0.25 ? [x0 / N, y0 / N, (x1 + 1) / N, (y1 + 1) / N] : full;
    // Tela: franja de abajo, en el centro de la prenda.
    let r = 0, g = 0, b = 0, n = 0;
    const [bx0, by0, bx1, by1] = box.map((v) => v * N);
    for (let y = Math.floor(by0 + (by1 - by0) * 0.8); y < by0 + (by1 - by0) * 0.92; y++)
      for (let x = Math.floor(bx0 + (bx1 - bx0) * 0.35); x < bx0 + (bx1 - bx0) * 0.65; x++) {
        const p = px(x, y);
        r += p[0];
        g += p[1];
        b += p[2];
        n++;
      }
    return { box, fabric: n ? `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})` : null };
  } catch {
    return { box: full, fabric: null }; // la foto no deja leer sus colores
  }
}

/** Carga una foto como textura (sin bloquear la escena), recortada al pecho de la prenda. */
function usePhotoTexture(src: string | undefined): { tex: THREE.Texture; fabric: string | null } | null {
  const [tex, setTex] = useState<{ tex: THREE.Texture; fabric: string | null } | null>(null);
  useEffect(() => {
    if (!src) return;
    let alive = true;
    let loaded: THREE.Texture | null = null;
    new THREE.TextureLoader().load(
      src,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        const { box, fabric } = analyzePhoto(t.image as CanvasImageSource);
        const [bx0, by0, bx1, by1] = box;
        const bw = bx1 - bx0;
        const bh = by1 - by0;
        // Pecho de una remera estirada: el centro (sin mangas) y de arriba hasta un poco más abajo de la mitad.
        t.repeat.set(bw * 0.5, bh * 0.62);
        t.offset.set(bx0 + bw * 0.25, 1 - (by0 + bh * 0.8));
        loaded = t;
        if (alive) setTex({ tex: t, fabric });
        else t.dispose();
      },
      undefined,
      () => {},
    );
    return () => {
      alive = false;
      loaded?.dispose();
      setTex(null);
    };
  }, [src]);
  return src ? tex : null;
}

/** El estampado de la remera: la foto pegada sobre el pecho (y la de atrás en la espalda). */
function PrintPanel({ d, tex, back = false }: { d: BodyDims; tex: THREE.Texture | undefined; back?: boolean }) {
  const geom = useMemo(() => {
    // Perfil del torso con más puntos para que la foto no se deforme.
    const base = topProfile(d, SHIRT_INFLATE + 0.004);
    const at = (y: number) => {
      for (let i = 1; i < base.length; i++) {
        const [r0, y0] = base[i - 1];
        const [r1, y1] = base[i];
        if (y <= y1 && y1 > y0) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
      }
      return base[base.length - 1][0];
    };
    const pts: THREE.Vector2[] = [];
    for (let k = 0; k <= 14; k++) {
      const y = 0.9 + (k / 14) * 0.52;
      pts.push(new THREE.Vector2(at(y), y));
    }
    const span = 2.1;
    return new THREE.LatheGeometry(pts, 24, (back ? Math.PI : 0) - span / 2, span);
  }, [d, back]);
  useEffect(() => () => geom.dispose(), [geom]);
  if (!tex) return null;
  return (
    <mesh geometry={geom} scale={[1, 1, 0.62]}>
      <meshToonMaterial map={tex} gradientMap={getToonGradient()} side={THREE.DoubleSide} />
    </mesh>
  );
}

const SHIRT_INFLATE = 0.024;

/** Remera: un poco más holgada que el cuerpo y larga hasta la cadera, cayendo sobre el pantalón. */
function topProfile(d: BodyDims, inflate = SHIRT_INFLATE): [number, number][] {
  return [[d.hip + inflate + 0.008, 0.84] as [number, number], ...torsoProfile(d, inflate, 0.9, 1.47)];
}

function torsoProfile(d: BodyDims, inflate = 0, from = 0.9, to = 1.49): [number, number][] {
  const chest = Math.max(d.waist, d.shoulder * (d.feminine ? 0.95 : 0.85));
  const pts: [number, number][] = [
    [d.hip * 0.95, 0.9],
    [d.hip, 0.98],
    [d.waist, 1.1],
    [chest, 1.28],
    [d.shoulder * 0.92, 1.4],
    [d.shoulder * 0.55, 1.46],
    [0.06, 1.49],
  ];
  return pts.filter(([, y]) => y >= from - 1e-6 && y <= to + 1e-6).map(([r, y]) => [r + inflate, y]);
}

function Body({ d, skin, look, style }: { d: BodyDims; skin: string; look: Look; style: AvatarStyle }) {
  const breathe = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (breathe.current) breathe.current.scale.y = 1 + Math.sin(clock.elapsedTime * 1.6) * 0.004;
  });

  const sx = d.shoulder * 0.95;
  const arm = (side: 1 | -1) => ({
    shoulder: [side * sx, 1.4, 0] as V3,
    elbow: [side * (sx + 0.05), 1.13, 0.01] as V3,
    wrist: [side * (sx + 0.08), 0.88, 0.02] as V3,
  });
  const legX = d.hip * 0.56;
  const leg = (side: 1 | -1) => ({
    hip: [side * legX, 0.92, 0] as V3,
    knee: [side * legX, 0.52, 0.01] as V3,
    ankle: [side * legX * 0.96, 0.1, 0] as V3,
  });
  const thigh = 0.066 * Math.min(1.25, Math.max(0.85, d.hip / 0.17));
  const calf = 0.055;

  // Si no elegiste nada, el avatar lleva una remera y un short básicos grises.
  const top = look.top ?? { color: "#d6d0c6", striped: false, sleeves: "short" as const, dress: "none" as const };
  // Estampado real: la foto de la prenda en el pecho y la espalda; el resto toma el color de la tela.
  const printFront = usePhotoTexture(look.top?.print?.front);
  const printBack = usePhotoTexture(look.top?.print?.back);
  const topColor = printFront?.fabric ?? top.color;
  const bottom =
    look.bottom ?? (look.top && look.top.dress !== "none" ? null : { color: "#8f8a82", striped: false, kind: "shorts" as const });
  const outer = look.outerwear;
  const sleeveLen = outer ? "long" : top?.sleeves;
  const skirtHem = top?.dress === "long" ? 0.14 : 0.55;

  return (
    <group ref={breathe}>
      <Head skin={skin} style={style} cap={look.accessory?.kind === "cap"} />
      <mesh position={[0, 1.505, 0]}>
        <cylinderGeometry args={[0.05, 0.058, 0.08, 20]} />
        <Mat color={skin} />
      </mesh>

      {/* Cuerpo */}
      <Lathe points={torsoProfile(d)}>
        <Mat color={skin} rough={0.6} />
      </Lathe>
      {([-1, 1] as const).map((s) => {
        const a = arm(s);
        const l = leg(s);
        return (
          <group key={s}>
            <Limb a={a.shoulder} b={a.elbow} r={0.045}>
              <Mat color={skin} rough={0.6} />
            </Limb>
            <Limb a={a.elbow} b={a.wrist} r={0.037}>
              <Mat color={skin} rough={0.6} />
            </Limb>
            <mesh position={[a.wrist[0] + s * 0.01, 0.83, 0.02]} scale={[0.8, 1.2, 0.6]}>
              <sphereGeometry args={[0.045, 16, 16]} />
              <Mat color={skin} rough={0.6} />
            </mesh>
            <Limb a={l.hip} b={l.knee} r={thigh}>
              <Mat color={skin} rough={0.6} />
            </Limb>
            <Limb a={l.knee} b={l.ankle} r={calf}>
              <Mat color={skin} rough={0.6} />
            </Limb>
            {/* Pies (o calzado) */}
            <mesh position={[l.ankle[0], 0.045, 0.045]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.8]} castShadow>
              <capsuleGeometry args={[look.shoes ? 0.055 : 0.045, look.shoes ? 0.15 : 0.12, 6, 16]} />
              <Mat color={look.shoes?.color ?? skin} />
            </mesh>
            {look.shoes?.boots && (
              <mesh position={[l.ankle[0], 0.17, 0.005]} castShadow>
                <cylinderGeometry args={[0.064, 0.06, 0.2, 18]} />
                <Mat color={look.shoes.color} rough={0.5} />
              </mesh>
            )}

            {/* Mangas */}
            {(top || outer) && (
              <>
                <Limb a={a.shoulder} b={sleeveLen === "long" ? a.elbow : lerp3(a.shoulder, a.elbow, 0.55)} r={outer ? 0.062 : 0.054}>
                  <Mat color={outer?.color ?? topColor} striped={outer ? outer.striped : top!.striped} />
                </Limb>
                {sleeveLen === "long" && (
                  <Limb a={a.elbow} b={lerp3(a.elbow, a.wrist, 0.92)} r={outer ? 0.052 : 0.045}>
                    <Mat color={outer?.color ?? topColor} striped={outer ? outer.striped : top!.striped} />
                  </Limb>
                )}
              </>
            )}

            {/* Piernas del pantalón */}
            {bottom && bottom.kind !== "skirt" && (
              <>
                <Limb a={[l.hip[0], 0.96, 0]} b={bottom.kind === "shorts" ? lerp3(l.hip, l.knee, 0.8) : l.knee} r={thigh + 0.014}>
                  <Mat color={bottom.color} striped={bottom.striped} />
                </Limb>
                {bottom.kind === "pants" && (
                  <Limb a={l.knee} b={[l.ankle[0], 0.12, 0]} r={calf + 0.016}>
                    <Mat color={bottom.color} striped={bottom.striped} />
                  </Limb>
                )}
              </>
            )}
          </group>
        );
      })}

      {/* Cadera del pantalón o pollera */}
      {bottom && bottom.kind !== "skirt" && (
        <Lathe points={torsoProfile(d, 0.014, 0.9, 0.98).concat([[(d.hip + d.waist) / 2 + 0.014, 1.02]])}>
          <Mat color={bottom.color} striped={bottom.striped} />
        </Lathe>
      )}
      {bottom?.kind === "skirt" && (
        <Lathe points={[[d.hip + 0.09, 0.55], [d.hip + 0.03, 0.9], [d.waist + 0.02, 1.08]]} flat={0.75}>
          <Mat color={bottom.color} striped={bottom.striped} />
        </Lathe>
      )}

      {/* Parte de arriba / vestido */}
      {top && (
        <Lathe points={top.dress === "none" ? topProfile(d) : torsoProfile(d, 0.012, 0.98, 1.47)}>
          <Mat color={topColor} striped={top.striped} />
        </Lathe>
      )}
      {printFront && !outer && <PrintPanel d={d} tex={printFront.tex} />}
      {printBack && !outer && <PrintPanel d={d} tex={printBack.tex} back />}
      {top && top.dress !== "none" && (
        <Lathe
          points={[
            [d.hip + (top.dress === "long" ? 0.14 : 0.08), skirtHem],
            [d.hip + 0.03, 0.9],
            [d.hip + 0.012, 0.98],
          ]}
          flat={0.75}
        >
          <Mat color={topColor} striped={top.striped} />
        </Lathe>
      )}

      {/* Abrigo: una capa más grande y un poco más larga */}
      {outer && (
        <Lathe points={torsoProfile(d, 0.032, 0.9, 1.47).concat([[0.075, 1.5]]).map(([r, y], i) => (i === 0 ? [r + 0.01, 0.84] : [r, y]))}>
          <Mat color={outer.color} striped={outer.striped} />
        </Lathe>
      )}

      {/* Accesorios */}
      {look.accessory?.kind === "cap" && (
        <group position={[0, HEAD_Y + 0.03, 0]}>
          <mesh scale={[1.03, 0.82, 1.03]}>
            <sphereGeometry args={[HEAD_R * 1.04, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <Mat color={look.accessory.color} />
          </mesh>
          <mesh position={[0, 0.0, HEAD_R * 0.95]} rotation={[0.18, 0, 0]}>
            <cylinderGeometry args={[0.09, 0.09, 0.012, 24, 1, false, -Math.PI / 2, Math.PI]} />
            <Mat color={look.accessory.color} />
          </mesh>
        </group>
      )}
      {look.accessory?.kind === "scarf" && (
        <mesh position={[0, 1.49, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.8, 1]}>
          <torusGeometry args={[0.07, 0.032, 12, 32]} />
          <Mat color={look.accessory.color} />
        </mesh>
      )}
    </group>
  );
}

function lerp3(a: V3, b: V3, t: number): V3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Mueve la cámara suave hacia la vista elegida. */
function CameraRig({ view, scale, controls }: { view: View; scale: number; controls: React.RefObject<OrbitControlsImpl | null> }) {
  const moving = useRef(true);
  const goal = useMemo(() => cameraFor(view, scale), [view, scale]);

  useEffect(() => {
    moving.current = true;
  }, [goal]);

  useFrame((state, dt) => {
    if (!moving.current || !controls.current) return;
    const cam = state.camera as THREE.PerspectiveCamera;
    const fov = view === "otro" ? 50 : 35;
    if (cam.fov !== fov) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    const k = 1 - Math.pow(0.001, dt);
    const p = new THREE.Vector3(...goal.position);
    const t = new THREE.Vector3(...goal.target);
    cam.position.lerp(p, k);
    controls.current.target.lerp(t, k);
    controls.current.update();
    if (cam.position.distanceTo(p) < 0.005 && controls.current.target.distanceTo(t) < 0.005) moving.current = false;
  });
  return null;
}

export default function Avatar3D({
  dims,
  skin,
  look,
  view,
  style,
  onUserMove,
}: {
  dims: BodyDims;
  skin: string;
  look: Look;
  view: View;
  style: AvatarStyle;
  /** Se llama cuando la persona gira el avatar con el dedo. */
  onUserMove?: () => void;
}) {
  const controls = useRef<OrbitControlsImpl | null>(null);
  const start = cameraFor(view, dims.scale);
  const observer = view === "otro";
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: start.position, fov: 35, near: 0.05, far: 50 }} gl={{ preserveDrawingBuffer: true }}>
      <color attach="background" args={[observer ? "#dfe5ea" : "#efe7dc"]} />
      <hemisphereLight args={["#ffffff", "#b9a99a", 1.1]} />
      <directionalLight position={[2.5, 4, 3]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-3, 2, -2]} intensity={0.5} />

      <group scale={dims.scale}>
        <Body d={dims} skin={skin} look={look} style={style} />
      </group>

      {/* Piso: un círculo en el estudio, o la vereda en la vista de otra persona */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        {observer ? <planeGeometry args={[30, 30]} /> : <circleGeometry args={[1.1, 48]} />}
        <meshStandardMaterial color={observer ? "#b7b2aa" : "#e2d8ca"} roughness={1} />
      </mesh>
      <ContactShadows position={[0, 0.001, 0]} opacity={0.45} scale={3} blur={2.2} far={2} />

      <OrbitControls
        ref={controls}
        makeDefault
        enablePan={false}
        enableRotate={!observer}
        enableZoom={!observer}
        minDistance={0.6}
        maxDistance={5}
        minPolarAngle={0.35}
        maxPolarAngle={1.75}
        onStart={onUserMove}
      />
      <CameraRig view={view} scale={dims.scale} controls={controls} />
    </Canvas>
  );
}
