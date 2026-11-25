"use client";

// Abrigos: campera (con cierre), de jean (botones y bolsillos con tapa), de cuero (solapas),
// polar, rompevientos, saco, tapado, chaleco, inflable y poncho. Con capucha si la tiene y el
// estampado de la espalda (o del pecho) recortado de la foto.

import { useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { OuterLook } from "@/lib/look";
import { outerFit, ringAt, type Ring, type Skeleton } from "@/lib/skeleton";
import { Geo } from "./Body";
import { Mat, REPEAT, shade } from "./materials";
import { Button, ButtonRow, Line, Piece, PrintDecal, RingBand, Sleeve, shellNormal } from "./parts";
import { axisLathe, phiAtX, ringTube, shellPatch, shellPoint } from "./shapes";
import { Hood } from "./Tops";

type Decal = { tex: THREE.Texture; aspect: number } | null;

/** Solapas (saco y campera de cuero): dos bandas que bajan del cuello en V. */
function Lapels({ shell, color, wide }: { shell: Ring[]; color: string; wide: boolean }) {
  const top = shell[shell.length - 1].y - 0.01;
  const bottom = wide ? 1.22 : 1.18;
  const geos = useMemo(
    () =>
      [-1, 1].map((s) =>
        shellPatch(
          shell,
          bottom,
          top,
          (y) => {
            const k = (y - bottom) / (top - bottom);
            // Cerca del cuello, bien separadas; abajo se juntan en el medio.
            const inner = s * (0.004 + 0.05 * k);
            const outer = s * (0.03 + (wide ? 0.065 : 0.05) * k);
            const a = phiAtX(shell, y, inner);
            const b = phiAtX(shell, y, outer);
            return [Math.min(a, b), Math.max(a, b)];
          },
          0.0035,
          4,
          8,
        ),
      ),
    [shell, top, bottom, wide],
  );
  return (
    <>
      {geos.map((g, i) => (
        <Piece key={i} geo={g} color={color} />
      ))}
    </>
  );
}

/** Bolsillos del pecho con tapa (campera de jean). */
function FlapPockets({ shell, color, trim }: { shell: Ring[]; color: string; trim: string }) {
  const parts = useMemo(
    () =>
      [-1, 1].map((s) => {
        const [xa, xb] = [s * 0.04, s * 0.115];
        const range = (y: number): [number, number] => {
          const a = phiAtX(shell, y, xa);
          const b = phiAtX(shell, y, xb);
          return [Math.min(a, b), Math.max(a, b)];
        };
        return {
          pocket: shellPatch(shell, 1.2, 1.29, range, 0.0016, 6, 6),
          flap: shellPatch(shell, 1.268, 1.302, range, 0.0034, 6, 2),
          edge: [0, 1, 2, 3, 4].map((i) => {
            const x = xa + ((xb - xa) * i) / 4;
            return shellPoint(shell, 1.268, phiAtX(shell, 1.268, x), 0.0042);
          }),
          mid: (xa + xb) / 2,
        };
      }),
    [shell],
  );
  return (
    <>
      {parts.map((p, i) => (
        <group key={i}>
          <Piece geo={p.pocket} color={shade(color, -0.03)} />
          <Piece geo={p.flap} color={shade(color, -0.06)} />
          <Line points={p.edge} r={0.0009} color={trim} />
          <Button at={shellPoint(shell, 1.278, phiAtX(shell, 1.278, p.mid), 0.0056)} normal={shellNormal(shell, 1.278, phiAtX(shell, 1.278, p.mid))} r={0.0048} color="#b0894f" />
        </group>
      ))}
    </>
  );
}

/** Cierre al frente, del ruedo al cuello. */
function Zipper({ shell, color }: { shell: Ring[]; color: string }) {
  const pts = useMemo(() => {
    const y0 = shell[0].y + 0.008;
    const y1 = shell[shell.length - 1].y;
    return Array.from({ length: 8 }, (_, i) => shellPoint(shell, y0 + ((y1 - y0) * i) / 7, 0, 0.0024));
  }, [shell]);
  return (
    <>
      <Line points={pts} r={0.0026} color={color} />
      {/* Tirador del cierre */}
      <mesh position={pts[pts.length - 2]}>
        <boxGeometry args={[0.008, 0.016, 0.004]} />
        <Mat color="#9a9a9a" />
      </mesh>
    </>
  );
}

/** Flecos colgando alrededor del ruedo (poncho), todos en una sola pieza. */
function Fringe({ ring, color }: { ring: Ring; color: string }) {
  const geo = useMemo(() => {
    const n = 64;
    const parts = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      const g = new THREE.CylinderGeometry(0.0022, 0.0018, 0.044, 4);
      g.translate(ring.rx * Math.sin(a), ring.y - 0.022, ring.z + ring.rz * Math.cos(a));
      return g;
    });
    const merged = mergeGeometries(parts)!;
    parts.forEach((g) => g.dispose());
    return merged;
  }, [ring]);
  return (
    <Geo geo={geo}>
      <Mat color={color} />
    </Geo>
  );
}

/** Abrigo. `shell` es su cuerpo ya calculado (outerShell), por encima de toda la ropa de abajo. */
export function OuterGarment({
  sk,
  look,
  shell,
  decalFront,
  decalBack,
}: {
  sk: Skeleton;
  look: OuterLook;
  shell: Ring[];
  decalFront: Decal;
  decalBack: Decal;
}) {
  const { sleeve } = outerFit(look.kind);
  const geo = useMemo(() => ringTube(shell, { segments: 56 }), [shell]);
  const topRing = shell[shell.length - 1];
  const hem = shell[0].y;
  const dark = shade(look.color, -0.12);
  const quilts = look.kind === "puffer" ? [0.95, 1.05, 1.15, 1.25, 1.35] : [];
  // Cuello alto: campera, polar, inflable, rompevientos, chaleco.
  const standCollar = !["blazer", "leather", "denim", "coat", "cape"].includes(look.kind) && !look.hood;
  const buttonsY: [number, number, number] | null =
    look.closure !== "buttons" ? null : look.kind === "blazer" ? [1.1, 1.0, 2] : look.kind === "denim" ? [1.36, hem + 0.04, 6] : [1.18, 0.86, 4];
  return (
    <group>
      <Geo geo={geo}>
        <Mat color={look.color} pattern={look.pattern} repeat={REPEAT.body} double />
      </Geo>
      {decalFront && look.print?.fitFront?.print && (
        <PrintDecal shell={shell} tex={decalFront.tex} aspect={decalFront.aspect} place={look.print.fitFront.print} />
      )}
      {decalBack && look.print?.fitBack?.print && (
        <PrintDecal shell={shell} tex={decalBack.tex} aspect={decalBack.aspect} place={look.print.fitBack.print} back />
      )}
      <RingBand ring={shell[0]} tube={look.kind === "denim" ? 0.009 : 0.006} color={look.kind === "denim" ? shade(look.color, -0.04) : dark} />
      {/* Cuello */}
      {(look.kind === "blazer" || look.kind === "leather") && <Lapels shell={shell} color={shade(look.color, 0.05)} wide={look.kind === "leather"} />}
      {(look.kind === "denim" || look.kind === "coat") && <Lapels shell={shell} color={shade(look.color, 0.03)} wide={false} />}
      {standCollar && (
        <Geo
          geo={axisLathe([0, topRing.y - 0.012, topRing.z], [0, topRing.y + 0.04, topRing.z - 0.004], [
            [0, topRing.rx + 0.004],
            [1, sk.neck.r + 0.03],
          ])}
        >
          <Mat color={look.kind === "fleece" ? shade(look.color, 0.04) : look.color} double />
        </Geo>
      )}
      {/* Cierre o botones al frente */}
      {look.closure === "zip" && <Zipper shell={shell} color={dark} />}
      {buttonsY &&
        (look.kind === "coat" ? (
          [-0.042, 0.042].map((x) => <ButtonRow key={x} shell={shell} y0={buttonsY[0]} y1={buttonsY[1]} count={buttonsY[2]} x={x} color={dark} r={0.009} />)
        ) : (
          <ButtonRow
            shell={shell}
            y0={buttonsY[0]}
            y1={buttonsY[1]}
            count={buttonsY[2]}
            color={look.kind === "denim" ? "#b0894f" : dark}
            r={look.kind === "denim" ? 0.0058 : 0.009}
          />
        ))}
      {look.closure === "open" && look.kind !== "cape" && (
        <Line
          points={Array.from({ length: 6 }, (_, i) => shellPoint(shell, hem + 0.01 + ((topRing.y - hem - 0.01) * i) / 5, 0.04, 0.003))}
          r={0.003}
          color={look.trim}
        />
      )}
      {look.kind === "denim" && <FlapPockets shell={shell} color={look.color} trim={look.trim} />}
      {/* Rompevientos: franja de otro color en el pecho */}
      {look.kind === "windbreaker" && (
        <Piece geo={shellPatch(shell, 1.2, 1.26, () => [-Math.PI, Math.PI], 0.0016, 48, 2)} color={look.trim} />
      )}
      {/* Saco: bolsillos con ranura a los costados */}
      {look.kind === "blazer" &&
        [-1, 1].map((s) => (
          <Line
            key={s}
            points={[0.06, 0.09, 0.12].map((x) => shellPoint(shell, 0.93, phiAtX(shell, 0.93, s * x), 0.002))}
            r={0.0016}
            color={dark}
          />
        ))}
      {/* Poncho: flecos en el ruedo */}
      {look.kind === "cape" && <Fringe ring={shell[0]} color={look.pattern?.color ?? dark} />}
      {/* Costuras del inflable */}
      {quilts.map((y) => (
        <RingBand key={y} ring={ringAt(shell, y)} tube={0.006} color={dark} />
      ))}
      {look.hood && <Hood shell={shell} color={look.color} strings={look.kind === "windbreaker"} />}
      {look.kind !== "vest" &&
        look.kind !== "cape" &&
        ([1, -1] as const).map((side) => (
          <group key={side} scale={[side, 1, 1]}>
            <Sleeve
              sk={sk}
              length="long"
              inflate={sleeve}
              color={look.color}
              pattern={look.pattern}
              trim={look.kind === "denim" ? shade(look.color, -0.04) : dark}
              cuff={look.kind === "puffer" || look.kind === "fleece" ? "ribbed" : "plain"}
            />
          </group>
        ))}
    </group>
  );
}
