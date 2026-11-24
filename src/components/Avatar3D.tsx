"use client";

// Avatar 3D tipo maniquí: proporciones del perfil y colores de la ropa elegida.
// Se arma con formas simples (sin modelos externos) para que cargue rápido en el celular.

import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { cameraFor, type BodyDims, type Look, type View } from "@/lib/avatar";

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

function Mat({ color, striped = false, rough = 0.85 }: { color: string; striped?: boolean; rough?: number }) {
  const map = useStripes(color, striped);
  return <meshStandardMaterial color={map ? "#ffffff" : color} map={map ?? undefined} roughness={rough} />;
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

function torsoProfile(d: BodyDims, inflate = 0, from = 0.9, to = 1.49): [number, number][] {
  const chest = Math.max(d.waist, d.shoulder * 0.85);
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

function Body({ d, skin, look }: { d: BodyDims; skin: string; look: Look }) {
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

  const top = look.top;
  const bottom = look.bottom;
  const outer = look.outerwear;
  const sleeveLen = outer ? "long" : top?.sleeves;
  const skirtHem = top?.dress === "long" ? 0.14 : 0.55;

  return (
    <group ref={breathe}>
      {/* Cabeza, pelo y cara (los ojos ayudan a saber dónde está el frente) */}
      <mesh position={[0, 1.64, 0]} scale={[0.95, 1.12, 1]} castShadow>
        <sphereGeometry args={[0.105, 32, 24]} />
        <Mat color={skin} rough={0.6} />
      </mesh>
      <mesh position={[0, 1.665, -0.01]} scale={[1, 1.05, 1.02]}>
        <sphereGeometry args={[0.108, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Mat color="#3b2a20" />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.035, 1.655, 0.095]}>
          <sphereGeometry args={[0.011, 12, 12]} />
          <meshStandardMaterial color="#221d18" />
        </mesh>
      ))}
      <mesh position={[0, 1.515, 0]}>
        <cylinderGeometry args={[0.048, 0.055, 0.1, 20]} />
        <Mat color={skin} rough={0.6} />
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
            <mesh position={[l.ankle[0], look.shoes ? 0.04 : 0.032, 0.045]} castShadow>
              <boxGeometry args={look.shoes ? [0.105, 0.08, 0.26] : [0.085, 0.06, 0.22]} />
              <Mat color={look.shoes?.color ?? skin} rough={look.shoes ? 0.5 : 0.6} />
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
                  <Mat color={outer?.color ?? top!.color} striped={outer ? outer.striped : top!.striped} />
                </Limb>
                {sleeveLen === "long" && (
                  <Limb a={a.elbow} b={lerp3(a.elbow, a.wrist, 0.92)} r={outer ? 0.052 : 0.045}>
                    <Mat color={outer?.color ?? top!.color} striped={outer ? outer.striped : top!.striped} />
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
        <Lathe points={torsoProfile(d, 0.014, 0.9, 1.1).concat([[d.waist + 0.014, 1.12]])}>
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
        <Lathe points={torsoProfile(d, 0.012, top.dress === "none" ? 0.92 : 0.98, 1.47)}>
          <Mat color={top.color} striped={top.striped} />
        </Lathe>
      )}
      {top && top.dress !== "none" && (
        <Lathe
          points={[
            [d.hip + (top.dress === "long" ? 0.14 : 0.08), skirtHem],
            [d.hip + 0.03, 0.9],
            [d.hip + 0.012, 0.98],
          ]}
          flat={0.75}
        >
          <Mat color={top.color} striped={top.striped} />
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
        <group position={[0, 1.7, 0]}>
          <mesh scale={[1.02, 0.8, 1.05]}>
            <sphereGeometry args={[0.112, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <Mat color={look.accessory.color} />
          </mesh>
          <mesh position={[0, 0.005, 0.11]} rotation={[0.25, 0, 0]}>
            <boxGeometry args={[0.15, 0.012, 0.09]} />
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
  onUserMove,
}: {
  dims: BodyDims;
  skin: string;
  look: Look;
  view: View;
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
        <Body d={dims} skin={skin} look={look} />
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
        minDistance={1.3}
        maxDistance={5}
        minPolarAngle={0.35}
        maxPolarAngle={1.75}
        onStart={onUserMove}
      />
      <CameraRig view={view} scale={dims.scale} controls={controls} />
    </Canvas>
  );
}
