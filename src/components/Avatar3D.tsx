"use client";

// Escena del probador 3D: el avatar (cuerpo, cabeza, ropa), las luces, el piso y la cámara.
// El avatar se arma con formas simples (sin modelos externos) para que cargue rápido en el celular:
// ver components/avatar/ (cuerpo, cabeza, ropa) y lib/skeleton.ts (proporciones).

import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { cameraFor, type BodyDims, type View } from "@/lib/avatar";
import { analyzePhotoPrint } from "@/lib/print-decal";
import { wornBottom, wornTop, type Look } from "@/lib/look";
import {
  armRoom,
  bottomInflate,
  bottomShell,
  buildSkeleton,
  layerOver,
  legsEnvelope,
  limbProfiles,
  outerShell,
  profileAt,
  ringAt,
  skirtRings,
  sleeveInflate,
  topEnvelope,
  topShell,
  type Ring,
  type V3,
} from "@/lib/skeleton";
import type { AvatarStyle } from "@/lib/types";
import { type AccessoryContext, Accessory } from "./avatar/Accessories";
import BodySkin from "./avatar/Body";
import { BottomGarment, pantCalfT, pantsOverBoots } from "./avatar/Bottoms";
import Head from "./avatar/Head";
import { OuterGarment } from "./avatar/Outer";
import { useGarmentPrint } from "./avatar/parts";
import { BootShaft, HEEL_LIFT, HEEL_PITCH, Shoe, soleLift } from "./avatar/Shoes";
import { Skirt, TopGarment } from "./avatar/Tops";

/** Anillos que ocupa una banda alrededor de la cintura (cinturón, riñonera), para taparla con el abrigo. */
function bandAround(rings: Ring[], y0: number, y1: number, grow: number): Ring[] {
  return [y0, y1].map((y) => {
    const r = ringAt(rings, y);
    return { ...r, y, rx: r.rx + grow, rz: r.rz + grow };
  });
}

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
  const acc = look.accessory;
  // Prenda digital: el estampado de cada prenda como calcomanía (el color de la tela ya viene en el look).
  // Si la IA no marcó el estampado, se mira la foto (suelto: calcomanía; por toda la tela: la tela real).
  const topFront = useGarmentPrint(look.top?.print, false);
  const topBack = useGarmentPrint(look.top?.print, true);
  const bottomFront = useGarmentPrint(look.bottom?.print, false);
  const bottomBack = useGarmentPrint(look.bottom?.print, true);
  const outerFront = useGarmentPrint(outer?.print, false);
  const outerBack = useGarmentPrint(outer?.print, true);
  const topTile = topFront?.tile ?? topBack?.tile ?? null;
  const shoes = look.shoes;
  const heel = shoes?.kind === "heel";
  const hatOn = acc?.kind === "cap" || acc?.kind === "beanie" || acc?.kind === "hat";
  // Anteojos de sol elegidos como accesorio: los dibuja la cabeza, del color de la prenda.
  const headStyle = useMemo(
    () => (acc?.kind === "sunglasses" ? { ...style, glasses: "sol" as const, glassesColor: acc.color } : style),
    [style, acc],
  );

  // Capas de ropa: cada prenda envuelve a las que van debajo (pantalón → remera → abrigo). Con
  // cinturón, la remera va metida: ahí el pantalón la envuelve a ella.
  const layers = useMemo(() => {
    const legged = bottom && bottom.kind !== "skirt" && bottom.kind !== "brief";
    const legs = legsEnvelope(sk, legged ? bottomInflate(bottom) : 0, 0.45, 0.99);
    let below = bottom ? bottomShell(sk, bottom) : null;
    let topRings: Ring[];
    if (top.tucked && below) {
      topRings = topShell(sk, top, []);
      below = layerOver(below, [topEnvelope(top, topRings)]);
    } else {
      topRings = topShell(sk, top, below ? [below, legs] : [legs]);
    }
    const dress = top.dress !== "none" ? skirtRings(sk.torso, 0.98, top.dress) : null;
    const waistGear = below && (acc?.kind === "belt" || acc?.kind === "waistbag") ? bandAround(below, 0.975, 1.025, 0.012) : null;
    const outerRings = outer
      ? outerShell(
          sk,
          outer,
          [top.tucked ? topRings : topEnvelope(top, topRings), below, dress, legs, waistGear].filter((r): r is Ring[] => r !== null),
        )
      : null;
    return { topRings, below, outerRings };
  }, [sk, top, bottom, outer, acc]);

  // Dónde se apoyan los accesorios: sobre lo de más afuera.
  const accCtx = useMemo((): AccessoryContext => {
    const prof = limbProfiles(sk);
    // Solo el puño de la camisa llega a la muñeca (las otras mangas terminan antes).
    const shirtCuff = top.sleeves === "long" && top.cuffs && (!outer || outer.kind === "vest" || outer.kind === "cape");
    return {
      sk,
      outer: layers.outerRings ?? layers.topRings,
      waist: layers.below,
      wristCover: shirtCuff ? profileAt(prof.forearm, 0.88) + sleeveInflate(top) + 0.0055 : 0,
    };
  }, [sk, layers, top, outer]);

  return (
    <group position={[0, heel ? HEEL_LIFT : soleLift(shoes), 0]}>
      <group ref={breathe}>
        <BodySkin sk={sk} skin={skin} barefoot={!shoes} />
        <Head skin={skin} style={headStyle} cap={hatOn} />
        {bottom && layers.below && (
          <BottomGarment
            sk={sk}
            look={bottom}
            shell={layers.below}
            covered={Boolean(outer) || (!top.tucked && ((top.cut === "normal" && top.dress === "none") || top.cut === "swimsuit"))}
            decalFront={bottomFront?.decal ?? null}
            decalBack={bottomBack?.decal ?? null}
            tile={bottomFront?.tile ?? bottomBack?.tile ?? null}
          />
        )}
        <TopGarment
          sk={sk}
          look={top}
          shell={layers.topRings}
          skin={skin}
          showSleeves={!outer || outer.kind === "vest"}
          decalFront={outer && outer.kind !== "vest" ? null : (topFront?.decal ?? null)}
          decalBack={outer && outer.kind !== "vest" ? null : (topBack?.decal ?? null)}
          tile={topTile}
        />
        {top.dress !== "none" && (
          <Skirt sk={sk} from={0.98} length={top.dress} color={top.color} pattern={topTile ? { kind: "foto", tex: topTile } : top.pattern} />
        )}
        {outer && layers.outerRings && (
          <OuterGarment
            sk={sk}
            look={outer}
            shell={layers.outerRings}
            decalFront={outerFront?.decal ?? null}
            decalBack={outerBack?.decal ?? null}
            tile={outerFront?.tile ?? outerBack?.tile ?? null}
          />
        )}
        {acc && <Accessory look={acc} ctx={accCtx} />}
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
    const w = window as unknown as {
      __armarioCam?: (p: V3, t: V3, fov?: number) => void;
      __armarioScene?: THREE.Scene;
      __armarioPrint?: typeof analyzePhotoPrint;
    };
    w.__armarioScene = scene;
    w.__armarioPrint = analyzePhotoPrint;
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
      delete w.__armarioPrint;
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
