"use client";

// Escena del probador 3D: el avatar (cuerpo, cabeza, ropa), las luces, el piso y la cámara.
// El avatar se arma con formas simples (sin modelos externos) para que cargue rápido en el celular:
// ver components/avatar/ (cuerpo, cabeza, ropa) y lib/skeleton.ts (proporciones).

import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { cameraFor, wornBottom, wornTop, type BodyDims, type Look, type View } from "@/lib/avatar";
import {
  armRoom,
  bottomInflate,
  bottomShell,
  buildSkeleton,
  legsEnvelope,
  outerShell,
  skirtRings,
  topEnvelope,
  topShell,
  type Ring,
  type V3,
} from "@/lib/skeleton";
import type { AvatarStyle } from "@/lib/types";
import BodySkin from "./avatar/Body";
import {
  Accessory,
  BootShaft,
  BottomGarment,
  HEEL_LIFT,
  HEEL_PITCH,
  OuterGarment,
  Shoe,
  pantCalfT,
  pantsOverBoots,
  Skirt,
  TopGarment,
  usePrintDecal,
} from "./avatar/Clothes";
import Head from "./avatar/Head";

/** El avatar completo, con la ropa puesta. Respira despacito. */
function Avatar({ dims, skin, look, style }: { dims: BodyDims; skin: string; look: Look; style: AvatarStyle }) {
  // Los brazos se abren según el cuerpo y la ropa (un abrigo grueso los separa más).
  const room = armRoom(look);
  const sk = useMemo(() => buildSkeleton(dims, { torso: room.torso, hips: room.hips }), [dims, room.torso, room.hips]);
  const breathe = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (breathe.current) breathe.current.scale.y = 1 + Math.sin(clock.elapsedTime * 1.6) * 0.003;
  });

  // Si no elegiste nada, el avatar lleva una remera y un short básicos.
  const top = wornTop(look);
  const bottom = wornBottom(look);
  const outer = look.outerwear;
  // Prenda digital: el color de la tela que vio la IA, y el estampado como calcomanía.
  const decalFront = usePrintDecal(look.top?.print?.front, look.top?.print?.fitFront);
  const decalBack = usePrintDecal(look.top?.print?.back, look.top?.print?.fitBack);
  const topColor = look.top?.print?.fitFront?.fabric ?? top.color;
  const shoes = look.shoes;
  const heel = shoes?.kind === "heel";
  const covered = Boolean(shoes && shoes.kind !== "sandal");
  const hatOn = look.accessory?.kind === "cap" || look.accessory?.kind === "beanie" || look.accessory?.kind === "hat";

  // Capas de ropa: cada prenda envuelve a las que van debajo (pantalón → remera → abrigo).
  const layers = useMemo(() => {
    const below = bottom ? bottomShell(sk, bottom) : null;
    // Los muslos (piel, o la pierna del pantalón) sobresalen un poco adelante: lo de arriba los tapa.
    const legged = bottom && bottom.kind !== "skirt" && bottom.kind !== "brief";
    const legs = legsEnvelope(sk, legged ? bottomInflate(bottom) : 0, 0.45, 0.99);
    const topRings = topShell(sk, top, below ? [below, legs] : [legs]);
    const dress = top.dress !== "none" ? skirtRings(sk.torso, 0.98, top.dress) : null;
    const outerRings = outer
      ? outerShell(sk, outer, [topEnvelope(top, topRings), below, dress, legs].filter((r): r is Ring[] => r !== null))
      : null;
    return { topRings, outerRings };
  }, [sk, top, bottom, outer]);

  return (
    <group position={[0, heel ? HEEL_LIFT : 0, 0]}>
      <group ref={breathe}>
        <BodySkin sk={sk} skin={skin} barefoot={!covered && !heel && !shoes} />
        <Head skin={skin} style={style} cap={hatOn} />
        {bottom && (
          <BottomGarment
            sk={sk}
            look={bottom}
            covered={Boolean(outer) || (top.cut === "normal" && top.dress === "none") || top.cut === "swimsuit"}
          />
        )}
        <TopGarment
          sk={sk}
          look={top}
          shell={layers.topRings}
          color={topColor}
          showSleeves={!outer}
          decalFront={outer ? null : decalFront}
          decalBack={outer ? null : decalBack}
        />
        {top.dress !== "none" && <Skirt sk={sk} from={0.98} length={top.dress} color={topColor} striped={top.striped} />}
        {outer && layers.outerRings && <OuterGarment sk={sk} look={outer} shell={layers.outerRings} />}
        {look.accessory && <Accessory look={look.accessory} />}
        {shoes &&
          ([1, -1] as const).map((side) => {
            const ankle = sk.leg(1).ankle;
            return (
              <group key={side} scale={[side, 1, 1]}>
                <group position={ankle} rotation={[heel ? HEEL_PITCH : 0, 0.1, 0]}>
                  <Shoe look={shoes} skin={skin} />
                </group>
                {(shoes.kind === "boot" || shoes.kind === "tallboot") && (
                  <BootShaft sk={sk} look={shoes} underHem={bottom && pantsOverBoots(bottom) ? pantCalfT(bottom) : undefined} />
                )}
              </group>
            );
          })}
      </group>
    </group>
  );
}

/** Mueve la cámara suave hacia la vista elegida. */
function CameraRig({ view, scale, controls }: { view: View; scale: number; controls: React.RefObject<OrbitControlsImpl | null> }) {
  const moving = useRef(true);
  const goal = useMemo(() => cameraFor(view, scale), [view, scale]);
  const { camera, scene } = useThree();

  // Solo en desarrollo: las pruebas automáticas mueven la cámara a cualquier zona (manos, pies…).
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const w = window as unknown as { __armarioCam?: (p: V3, t: V3, fov?: number) => void; __armarioScene?: THREE.Scene };
    w.__armarioScene = scene;
    // fov chico = zoom (para mirar de cerca sin chocar con la distancia mínima de la cámara).
    w.__armarioCam = (p, t, fov) => {
      moving.current = false;
      if (fov && camera instanceof THREE.PerspectiveCamera) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
      camera.position.set(...p);
      controls.current?.target.set(...t);
      controls.current?.update();
    };
    return () => {
      delete w.__armarioCam;
      delete w.__armarioScene;
    };
  }, [camera, controls, scene]);

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
        <Avatar dims={dims} skin={skin} look={look} style={style} />
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
