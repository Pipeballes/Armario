"use client";

// Parte de arriba del avatar: remera, camisa, chomba, buzo, hoodie, polera, cárdigan, musculosa,
// corpiño, malla y el cuerpo de los vestidos. Cada tipo con sus detalles: cuello, tira de botones,
// bolsillos, puños, franjas, capucha con cordones.

import { useMemo } from "react";
import * as THREE from "three";
import type { TopLook } from "@/lib/look";
import { ringAt, skirtRings, sleeveInflate, strapPath, topCoversShoulders, topHemTube, type Ring, type Skeleton, type SkirtLength } from "@/lib/skeleton";
import { Geo } from "./Body";
import { Mat, REPEAT, shade, type Fill } from "./materials";
import { ButtonRow, Line, Piece, PrintDecal, RingBand, Sleeve, type Decal } from "./parts";
import { axisLathe, phiAtX, ringTube, shellPatch, shellPoint } from "./shapes";


/** Cuello camisero: una banda alrededor del cuello, abierta adelante, con las dos puntas hacia abajo. */
function Collar({ ring, color, trim, polo = false }: { ring: Ring; color: string; trim: string; polo?: boolean }) {
  const R = ring.rx + 0.006;
  // El de chomba es más bajo, tejido, con puntas más cortas y redondeadas.
  const h = polo ? 0.026 : 0.034;
  const leaf: [number, number, number] = polo ? [0.032, 0.03, 0.004] : [0.036, 0.042, 0.004];
  return (
    <group position={[0, ring.y - 0.004, ring.z]}>
      <mesh scale={[1, 1, (ring.rz + 0.006) / R]} castShadow>
        <cylinderGeometry args={[R + 0.008, R, h, 32, 1, true, 0.42, Math.PI * 2 - 0.84]} />
        <Mat color={color} double />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.034, -0.012, ring.rz + 0.004]} rotation={[0.25, s * 0.35, s * 0.55]} castShadow>
          <boxGeometry args={leaf} />
          <Mat color={color} />
        </mesh>
      ))}
      {/* Borde del cuello */}
      <mesh position={[0, h / 2, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, (ring.rz + 0.014) / (R + 0.008), 1]}>
        <torusGeometry args={[R + 0.008, 0.0016, 6, 40, Math.PI * 2]} />
        <Mat color={trim} />
      </mesh>
    </group>
  );
}

/** Escote en V: la piel que se ve y el borde tejido a los dos lados. */
function VNeck({ shell, depth, skin, trim }: { shell: Ring[]; depth: number; skin: string; trim: string }) {
  const top = shell[shell.length - 1];
  const yTop = top.y - 0.004;
  const yBot = yTop - depth;
  const hw = Math.min(0.05, top.rx * 0.7);
  const half = (y: number) => hw * Math.max(0.02, (y - yBot) / (yTop - yBot));
  const geo = useMemo(
    () => shellPatch(shell, yBot, yTop, (y) => [phiAtX(shell, y, -half(y)), phiAtX(shell, y, half(y))], 0.0016, 8, 8),
    // half depende de hw, yBot e yTop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shell, yBot, yTop, hw],
  );
  const edges = useMemo(
    () =>
      [-1, 1].map((s) =>
        Array.from({ length: 7 }, (_, i) => {
          const y = yBot + ((yTop - yBot) * i) / 6;
          return shellPoint(shell, y, phiAtX(shell, y, s * half(y)), 0.003);
        }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shell, yBot, yTop, hw],
  );
  return (
    <>
      <Piece geo={geo} color={skin} />
      {edges.map((pts, i) => (
        <Line key={i} points={pts} r={0.0042} color={trim} />
      ))}
    </>
  );
}

/** Tira de botones al frente, con sus costuras y botones. */
function Placket({
  shell,
  y0,
  y1,
  buttons,
  color,
  trim,
  buttonColor,
  pattern,
}: {
  shell: Ring[];
  y0: number;
  y1: number;
  buttons: number;
  color: string;
  trim: string;
  buttonColor: string;
  pattern: Fill;
}) {
  const w = 0.013;
  const geo = useMemo(() => shellPatch(shell, y1, y0, (y) => [phiAtX(shell, y, -w), phiAtX(shell, y, w)], 0.0012, 4, 12), [shell, y0, y1]);
  const seams = useMemo(
    () =>
      [-1, 1].map((s) =>
        Array.from({ length: 8 }, (_, i) => {
          const y = y1 + ((y0 - y1) * i) / 7;
          return shellPoint(shell, y, phiAtX(shell, y, s * w), 0.0019);
        }),
      ),
    [shell, y0, y1],
  );
  return (
    <>
      <Piece geo={geo} color={pattern ? color : shade(color, -0.03)} pattern={pattern} repeat={[0.18, Math.max(0.6, (y0 - y1) / 0.15)]} />
      {seams.map((pts, i) => (
        <Line key={i} points={pts} r={0.0008} color={trim} />
      ))}
      {buttons > 0 && <ButtonRow shell={shell} y0={y0 - 0.012} y1={y1 + 0.03} count={buttons} color={buttonColor} />}
    </>
  );
}

/** Bolsillo en el pecho (del lado izquierdo de quien la usa, +x), con el borde de arriba marcado. */
const POCKET = { x0: 0.045, x1: 0.112, y0: 1.235, y1: 1.318 };
function ChestPocket({ shell, color, trim, pattern }: { shell: Ring[]; color: string; trim: string; pattern: Fill }) {
  const geo = useMemo(() => {
    const { x0, x1, y0, y1 } = POCKET;
    return shellPatch(shell, y0, y1, (y) => [phiAtX(shell, y, x0), phiAtX(shell, y, x1)], 0.0014, 6, 6);
  }, [shell]);
  const edge = useMemo(() => {
    const { x0, x1, y1 } = POCKET;
    return Array.from({ length: 5 }, (_, i) => shellPoint(shell, y1, phiAtX(shell, y1, x0 + ((x1 - x0) * i) / 4), 0.0022));
  }, [shell]);
  return (
    <>
      <Piece geo={geo} color={pattern ? color : shade(color, -0.035)} pattern={pattern} repeat={[0.45, 0.55]} />
      <Line points={edge} r={0.0011} color={trim} />
    </>
  );
}

/** Franjas a los costados, de la axila al ruedo. */
function SideStripes({ shell, color }: { shell: Ring[]; color: string }) {
  const y0 = shell[0].y + 0.004;
  const y1 = Math.min(1.33, shell[shell.length - 1].y - 0.02);
  const geos = useMemo(
    () => [-1, 1].map((s) => shellPatch(shell, y0, y1, () => [s * (Math.PI / 2) - 0.13, s * (Math.PI / 2) + 0.13], 0.0014, 4, 12)),
    [shell, y0, y1],
  );
  return (
    <>
      {geos.map((g, i) => (
        <Piece key={i} geo={g} color={color} />
      ))}
    </>
  );
}

/** Capucha bajada, apoyada en la espalda, y (si tiene) los dos cordones colgando sobre el pecho. */
export function Hood({ shell, color, strings }: { shell: Ring[]; color: string; strings: boolean }) {
  const ring = shell[shell.length - 1];
  const cords = useMemo(
    () =>
      strings
        ? [-1, 1].map((s) =>
            Array.from({ length: 7 }, (_, i) => {
              const y = ring.y - 0.004 - (0.135 * i) / 6;
              return shellPoint(shell, y, phiAtX(shell, y, s * (0.028 + 0.004 * (i / 6))), 0.0055);
            }),
          )
        : [],
    [shell, ring.y, strings],
  );
  return (
    <group>
      <mesh position={[0, ring.y + 0.02, ring.z - ring.rz * 0.85]} scale={[1, 0.62, 0.72]} castShadow>
        <sphereGeometry args={[0.115, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
        <Mat color={color} double />
      </mesh>
      <RingBand ring={{ ...ring, rx: ring.rx + 0.012, rz: ring.rz + 0.012 }} tube={0.012} color={shade(color, -0.04)} />
      {cords.map((pts, i) => (
        <group key={i}>
          <Line points={pts} r={0.0032} color="#f2f2f2" />
          <mesh position={pts[pts.length - 1]}>
            <capsuleGeometry args={[0.0042, 0.012, 4, 8]} />
            <Mat color="#d9d9d9" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Tira de una musculosa, corpiño o malla (la derecha): sale del borde de adelante de la prenda,
 * pasa por arriba del hombro pegada al cuerpo y baja por la espalda.
 */
function Strap({ sk, ring, r, color }: { sk: Skeleton; ring: Ring; r: number; color: string }) {
  const geo = useMemo(() => {
    const pts = strapPath(sk, ring, r).map((p) => new THREE.Vector3(...p));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, r, 8, false);
  }, [sk, ring, r]);
  return (
    <Geo geo={geo}>
      <Mat color={color} />
    </Geo>
  );
}

/** Bolsillo canguro: un parche curvo que sigue la panza, con el borde de arriba marcado. */
function KangarooPocket({ ring, color }: { ring: Ring; color: string }) {
  const R = ring.rx + 0.005;
  const half = Math.asin(Math.min(0.95, 0.1 / R));
  const edge = useMemo(() => {
    const pts = Array.from({ length: 13 }, (_, i) => {
      const t = -half + (2 * half * i) / 12;
      return new THREE.Vector3(R * Math.sin(t), 0.05, R * Math.cos(t));
    });
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.003, 6, false);
  }, [R, half]);
  return (
    <group position={[0, ring.y, ring.z]} scale={[1, 1, (ring.rz + 0.005) / R]}>
      <mesh castShadow>
        <cylinderGeometry args={[R, R, 0.1, 24, 1, true, -half, half * 2]} />
        <Mat color={color} double />
      </mesh>
      <Geo geo={edge}>
        <Mat color={shade(color, -0.08)} />
      </Geo>
    </group>
  );
}

/**
 * Parte de arriba. `shell` es su cuerpo ya calculado (topShell), por encima de lo que vaya abajo.
 * `skin` hace falta para el escote en V.
 */
export function TopGarment({
  sk,
  look,
  shell,
  skin,
  showSleeves,
  decalFront,
  decalBack,
  tile,
}: {
  sk: Skeleton;
  look: TopLook;
  shell: Ring[];
  skin: string;
  showSleeves: boolean;
  decalFront: Decal | null;
  decalBack: Decal | null;
  /** Pedazo de la tela real (estampado por toda la prenda), si hay. */
  tile?: THREE.Texture | null;
}) {
  const color = look.color;
  const fill: Fill = tile ? { kind: "foto", tex: tile } : look.pattern;
  const geo = useMemo(() => ringTube(shell, { segments: 48, capBottom: look.cut === "swimsuit" }), [shell, look.cut]);
  const topRing = shell[shell.length - 1];
  const hemY = shell[0].y;
  const straps = look.neck === "straps" || look.cut === "bra" || look.cut === "swimsuit";
  const vDepth = look.placket === "open" ? 0.17 : look.sleeves === "none" ? 0.12 : 0.075;
  // La tira de botones arranca debajo del cuello (o del escote, en el cárdigan).
  const placketTop = look.placket === "open" ? topRing.y - vDepth - 0.004 : topRing.y - 0.012;
  const placketBottom = look.placket === "short" ? topRing.y - 0.125 : hemY + 0.006;
  return (
    <group>
      <Geo geo={geo}>
        <Mat color={color} pattern={fill} repeat={REPEAT.body} double />
      </Geo>
      {decalFront && <PrintDecal shell={shell} tex={decalFront.tex} aspect={decalFront.aspect} place={decalFront.place} />}
      {decalBack && <PrintDecal shell={shell} tex={decalBack.tex} aspect={decalBack.aspect} place={decalBack.place} back />}
      {/* Ruedo (elastizado en buzos y sweaters). Metida adentro del pantalón, no se ve. */}
      {look.cut !== "swimsuit" && look.dress === "none" && !look.tucked && (
        <RingBand ring={shell[0]} tube={topHemTube(look)} color={look.trim} />
      )}
      {/* Cuello */}
      {!straps && look.neck === "round" && <RingBand ring={topRing} tube={0.007} color={look.trim} />}
      {!straps && look.neck === "collar" && <Collar ring={topRing} color={color} trim={look.trim} />}
      {!straps && look.neck === "polo" && <Collar ring={topRing} color={color} trim={look.trim} polo />}
      {look.neck === "v" && <VNeck shell={shell} depth={vDepth} skin={skin} trim={look.trim} />}
      {!straps && look.neck === "turtle" && (
        <Geo
          geo={axisLathe([0, topRing.y - 0.01, topRing.z], [0, 1.555, -0.008], [
            [0, topRing.rx + 0.004],
            [0.4, sk.neck.r + 0.016],
            [1, sk.neck.r + 0.014],
          ])}
        >
          <Mat color={color} double />
        </Geo>
      )}
      {!straps && look.neck === "hood" && <Hood shell={shell} color={color} strings={look.drawstring} />}
      {/* Tiras (musculosa, corpiño, malla) que pasan por arriba de los hombros */}
      {straps &&
        ([1, -1] as const).map((side) => (
          <group key={side} scale={[side, 1, 1]}>
            <Strap sk={sk} ring={topRing} r={look.cut === "normal" || look.cut === "crop" ? 0.011 : 0.0072} color={color} />
          </group>
        ))}
      {/* Tira de botones: camisa (hasta abajo), chomba (corta), cárdigan (abierta arriba) */}
      {look.placket !== "none" && placketTop > placketBottom + 0.03 && (
        <Placket
          shell={shell}
          y0={placketTop}
          y1={placketBottom}
          buttons={look.buttons}
          color={color}
          trim={look.trim}
          buttonColor={look.buttonColor}
          pattern={fill}
        />
      )}
      {look.chestPocket && topRing.y > 1.34 && <ChestPocket shell={shell} color={color} trim={look.trim} pattern={fill} />}
      {look.sideStripes && <SideStripes shell={shell} color={look.trim} />}
      {look.pocket && <KangarooPocket ring={ringAt(shell, 1.0)} color={shade(color, -0.03)} />}
      {/* Mangas */}
      {showSleeves && topCoversShoulders(look) && (
        <>
          {([1, -1] as const).map((side) => (
            <group key={side} scale={[side, 1, 1]}>
              <Sleeve
                sk={sk}
                length={look.sleeves === "long" ? "long" : "short"}
                inflate={sleeveInflate(look)}
                color={color}
                pattern={fill}
                trim={look.trim}
                cuff={look.ribbed ? "ribbed" : look.cuffs ? "shirt" : "plain"}
                buttonColor={look.buttonColor}
              />
            </group>
          ))}
        </>
      )}
    </group>
  );
}

/** Pollera (y la de los vestidos). */
export function Skirt({
  sk,
  from,
  length,
  color,
  pattern,
}: {
  sk: Skeleton;
  from: number;
  length: SkirtLength;
  color: string;
  pattern: Fill;
}) {
  const geo = useMemo(() => ringTube(skirtRings(sk.torso, from, length), { segments: 48 }), [sk.torso, from, length]);
  return (
    <Geo geo={geo}>
      <Mat color={color} pattern={pattern} repeat={REPEAT.skirt} double />
    </Geo>
  );
}
