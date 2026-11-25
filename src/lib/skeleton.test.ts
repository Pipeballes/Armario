import { describe, expect, it } from "vitest";
import { bodyDims } from "./avatar";
import { buildSkeleton, ringAt, shellRings } from "./skeleton";
import { DEFAULT_BOTTOM, type BottomLook, type OuterLook } from "./look";
import { EMPTY_PROFILE } from "./types";

const dims = (p: Partial<typeof EMPTY_PROFILE>) => bodyDims({ ...EMPTY_PROFILE, ...p });
const pants = (): BottomLook => ({ ...DEFAULT_BOTTOM, kind: "pants", waist: "belt", legT: 1, fly: true });
const outer = (kind: OuterLook["kind"]): OuterLook => ({ color: "#123", pattern: null, trim: "#000", kind, hood: false, closure: "zip" });

describe("esqueleto", () => {
  for (const [nombre, p] of [
    ["hombre", { gender: "hombre" as const }],
    ["mujer reloj", { gender: "mujer" as const, bodyType: "reloj" as const }],
    ["triángulo invertido", { gender: "hombre" as const, bodyType: "triangulo-invertido" as const }],
    ["óvalo", { bodyType: "ovalo" as const }],
  ] as const) {
    it(`proporciones coherentes (${nombre})`, () => {
      const sk = buildSkeleton(dims(p));
      // El torso va de abajo hacia arriba sin saltos.
      for (let i = 1; i < sk.torso.length; i++) expect(sk.torso[i].y).toBeGreaterThan(sk.torso[i - 1].y);
      // Brazos: hombro arriba del codo, codo arriba de la muñeca; la mano llega a la mitad del muslo.
      const a = sk.arm(1);
      expect(a.shoulder[1]).toBeGreaterThan(a.elbow[1]);
      expect(a.elbow[1]).toBeGreaterThan(a.wrist[1]);
      expect(a.wrist[1]).toBeGreaterThan(sk.leg(1).knee[1]);
      // El hombro sobresale del torso (no queda adentro) pero no flota.
      const top = ringAt(sk.torso, a.shoulder[1]);
      expect(a.shoulder[0] + sk.deltoid).toBeGreaterThan(top.rx);
      expect(a.shoulder[0] - sk.deltoid).toBeLessThan(top.rx);
      // Piernas: los muslos se tocan adentro sin atravesarse demasiado.
      const l = sk.leg(1);
      const gap = l.hip[0] - sk.legR.thigh;
      expect(gap).toBeGreaterThan(-0.02);
      expect(gap).toBeLessThan(0.02);
      // El tobillo queda arriba del piso.
      expect(l.ankle[1]).toBeGreaterThan(sk.legR.ankle);
      // Simetría izquierda / derecha.
      expect(sk.arm(-1).wrist[0]).toBeCloseTo(-a.wrist[0]);
      expect(sk.leg(-1).knee[0]).toBeCloseTo(-l.knee[0]);
      // El cuello llega hasta adentro de la cabeza.
      expect(sk.neck.top).toBeGreaterThan(sk.head.y - sk.head.r);
    });
  }

  it("la prenda queda siempre por fuera del cuerpo", () => {
    const sk = buildSkeleton(dims({ gender: "mujer", bodyType: "reloj" }));
    const shell = shellRings(sk.torso, 0.015, 0.86, 1.47, 0.02);
    for (const r of shell) {
      const body = ringAt(sk.torso, r.y);
      expect(r.rx).toBeGreaterThan(body.rx);
      expect(r.rz).toBeGreaterThan(body.rz);
    }
    expect(shell[0].y).toBeCloseTo(0.86);
    expect(shell[shell.length - 1].y).toBeCloseTo(1.47);
  });

  it("una calza o una malla cierra por debajo de la piel (no comparten la tapa de abajo)", () => {
    const sk = buildSkeleton(dims({ gender: "mujer" }));
    const shell = shellRings(sk.torso, 0.004, sk.crotchY, 1.02);
    expect(shell[0].y).toBeLessThan(sk.torso[0].y - 0.003);
    expect(shell[0].rx).toBeGreaterThan(sk.torso[0].rx);
    for (let i = 1; i < shell.length; i++) expect(shell[i].y).toBeGreaterThan(shell[i - 1].y);
  });
});

describe("prenda con hombros", () => {
  it("a la altura del hombro cubre casi todo el hombro, y arriba y abajo sigue al cuerpo", async () => {
    const { garmentRings } = await import("./skeleton");
    const sk = buildSkeleton(dims({ gender: "hombre" }));
    const g = garmentRings(sk, 0.013, 0.87, 1.468);
    const sx = sk.arm(1).shoulder[0];
    const atShoulder = ringAt(g, 1.395);
    expect(atShoulder.rx).toBeGreaterThan(sx + sk.deltoid * 0.4);
    const waist = ringAt(g, 1.1);
    expect(waist.rx).toBeCloseTo(ringAt(sk.torso, 1.1).rx + 0.013, 3);
    for (let i = 1; i < g.length; i++) expect(g[i].y).toBeGreaterThan(g[i - 1].y);
  });
});

describe("ropa sobre brazos y piernas", () => {
  it("la tela nunca queda más finita que la piel en ningún punto", async () => {
    const { clothProfile, limbProfiles, profileAt } = await import("./skeleton");
    const sk = buildSkeleton(dims({ gender: "mujer", bodyType: "triangulo" }));
    const p = limbProfiles(sk);
    for (const skin of [p.thigh, p.calf, p.upperArm, p.forearm]) {
      for (const [t0, t1] of [
        [0, 1],
        [0, 0.55],
      ]) {
        const cloth = clothProfile(skin, 0.004, t0, t1);
        for (let k = 0; k <= 20; k++) {
          const t = t0 + ((t1 - t0) * k) / 20;
          const kk = (t - t0) / (t1 - t0);
          expect(profileAt(cloth, kk)).toBeGreaterThanOrEqual(profileAt(skin, t) + 0.004 - 1e-9);
        }
      }
    }
  });

  it("las tiras pasan por arriba del hombro, apoyadas sobre la piel (sin hundirse)", async () => {
    const { insideTorso, strapPath } = await import("./skeleton");
    for (const p of [{ gender: "hombre" as const }, { gender: "mujer" as const, bodyType: "reloj" as const }]) {
      const sk = buildSkeleton(dims(p));
      for (const ring of [ringAt(sk.torso, 1.39), ringAt(sk.torso, 1.37)]) {
        const r = 0.011;
        const path = strapPath(sk, ring, r);
        // Arranca adelante, sube por arriba del hombro y termina atrás.
        expect(path[0][2]).toBeGreaterThan(0.03);
        expect(path[path.length - 1][2]).toBeLessThan(-0.03);
        expect(Math.max(...path.map((q) => q[1]))).toBeGreaterThan(1.44);
        path.forEach(([x, y, z], i) => {
          // El centro de la tira queda afuera del cuerpo, y la tira apenas por encima de la piel:
          // volviendo hacia adentro un poco más que su radio, ya se está adentro del cuerpo.
          expect(insideTorso(sk, x, y, z)).toBe(false);
          const th = (Math.PI * i) / (path.length - 1);
          const back = r + 0.006;
          expect(insideTorso(sk, x, y - Math.sin(th) * back, z - Math.cos(th) * back)).toBe(true);
        });
      }
    }
  });
});

describe("articulaciones", () => {
  const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

  for (const [nombre, p] of [
    ["hombre", { gender: "hombre" as const }],
    ["mujer reloj", { gender: "mujer" as const, bodyType: "reloj" as const }],
    ["triángulo invertido", { gender: "hombre" as const, bodyType: "triangulo-invertido" as const }],
  ] as const) {
    it(`cada bola tapa la boca de los tubos que llegan a ella (${nombre})`, async () => {
      const { jointBalls, limbProfiles, profileAt } = await import("./skeleton");
      const sk = buildSkeleton(dims(p));
      const pr = limbProfiles(sk);
      const a = sk.arm(1);
      const l = sk.leg(1);
      for (const inflate of [0, 0.004, 0.012, 0.018]) {
        const j = jointBalls(sk, inflate);
        // Radio de la bola a la altura de la boca (el centro puede no estar justo en la articulación).
        const reach = (ball: { at: number[]; r: number }, joint: number[]) => Math.sqrt(ball.r ** 2 - dist(ball.at, joint) ** 2);
        const cases: [{ at: number[]; r: number }, number[], number[]][] = [
          [j.shoulder, a.shoulder, [profileAt(pr.upperArm, 0)]],
          [j.elbow, a.elbow, [profileAt(pr.upperArm, 1), profileAt(pr.forearm, 0)]],
          [j.wrist, a.wrist, [profileAt(pr.forearm, 1)]],
          [j.hip, l.hip, [profileAt(pr.thigh, 0)]],
          [j.knee, l.knee, [profileAt(pr.thigh, 1), profileAt(pr.calf, 0)]],
          [j.ankle, l.ankle, [profileAt(pr.calf, 1)]],
        ];
        for (const [ball, joint, rims] of cases) {
          for (const rim of rims) expect(reach(ball, joint)).toBeGreaterThan((rim + inflate) * 1.02);
        }
      }
    });
  }

  it("la bola de la ropa envuelve a la de la piel con la holgura de la prenda", async () => {
    const { jointBalls } = await import("./skeleton");
    const sk = buildSkeleton(dims({ gender: "mujer" }));
    const skin = jointBalls(sk);
    const cloth = jointBalls(sk, 0.004);
    for (const k of Object.keys(skin) as (keyof typeof skin)[]) {
      expect(cloth[k].at).toEqual(skin[k].at);
      expect(cloth[k].r - skin[k].r).toBeGreaterThanOrEqual(0.004);
    }
  });
});

describe("brazos al costado", () => {
  const tipos = [
    { gender: "hombre" as const },
    { gender: "hombre" as const, bodyType: "triangulo" as const },
    { gender: "hombre" as const, bodyType: "ovalo" as const },
    { gender: "hombre" as const, bodyType: "triangulo-invertido" as const },
    { gender: "mujer" as const, bodyType: "reloj" as const },
    { gender: "mujer" as const, bodyType: "triangulo" as const },
    { gender: "mujer" as const, bodyType: "ovalo" as const },
  ];

  it("el codo, el antebrazo y la mano nunca atraviesan la cintura ni la cadera", async () => {
    const { ARM_ROOM, limbProfiles, profileAt } = await import("./skeleton");
    for (const p of tipos) {
      for (const room of [ARM_ROOM, { torso: 0.06, hips: 0.075 }]) {
        const sk = buildSkeleton(dims(p), room);
        const a = sk.arm(1);
        const pr = limbProfiles(sk);
        const hipW = Math.max(...sk.torso.map((r) => (r.y < 1 ? r.rx : 0)));
        const outer = (y: number) => Math.max(ringAt(sk.torso, y).rx, y < 0.93 ? hipW : 0);
        for (let k = 0; k <= 10; k++) {
          const t = k / 10;
          const x = a.elbow[0] + (a.wrist[0] - a.elbow[0]) * t;
          const y = a.elbow[1] + (a.wrist[1] - a.elbow[1]) * t;
          expect(x - profileAt(pr.forearm, t)).toBeGreaterThan(outer(y) + Math.min(room.torso, room.hips) - 1e-6);
        }
        // La mano (de la muñeca 16 cm para abajo) queda afuera de la cadera.
        expect(a.wrist[0] - 0.018).toBeGreaterThan(hipW + room.hips - 1e-6);
      }
    }
  });

  it("con una remera los brazos cuelgan casi derechos (no en jarra)", async () => {
    for (const p of tipos) {
      const sk = buildSkeleton(dims(p));
      const a = sk.arm(1);
      const lean = Math.atan2(a.wrist[0] - a.shoulder[0], a.shoulder[1] - a.wrist[1]);
      expect(lean).toBeGreaterThan(0.05);
      expect(lean).toBeLessThan(0.33);
    }
  });

  it("un abrigo grueso separa más los brazos que una musculosa", async () => {
    const { armRoom } = await import("./skeleton");
    const { DEFAULT_TOP } = await import("./look");
    const base = { top: null, bottom: null, shoes: null, outerwear: null, accessory: null };
    const tank = armRoom({ ...base, top: { ...DEFAULT_TOP, sleeves: "none", neck: "straps" } });
    const puffer = armRoom({ ...base, outerwear: outer("puffer") });
    expect(puffer.torso).toBeGreaterThan(tank.torso + 0.03);
    const sk1 = buildSkeleton(dims({ gender: "hombre" }), tank);
    const sk2 = buildSkeleton(dims({ gender: "hombre" }), puffer);
    expect(sk2.arm(1).elbow[0]).toBeGreaterThan(sk1.arm(1).elbow[0] + 0.02);
  });
});

describe("capas de ropa", () => {
  it("cada prenda tapa a la de abajo donde se superponen (pantalón → remera → saco, pollera → saco)", async () => {
    const { bottomShell, outerShell, topShell } = await import("./skeleton");
    const { DEFAULT_TOP } = await import("./look");
    const sk = buildSkeleton(dims({ gender: "mujer", bodyType: "triangulo" }));
    const jean = bottomShell(sk, pants());
    const mini = bottomShell(sk, { ...pants(), kind: "skirt" });
    for (const below of [jean, mini]) {
      const top = topShell(sk, DEFAULT_TOP, [below]);
      const blazer = outerShell(sk, outer("blazer"), [top, below]);
      const check = (over: typeof top, under: typeof top) => {
        const lo = Math.max(over[0].y, under[0].y);
        const hi = Math.min(over[over.length - 1].y, under[under.length - 1].y);
        for (let y = lo; y <= hi; y += 0.005) {
          expect(ringAt(over, y).rx).toBeGreaterThan(ringAt(under, y).rx + 0.004);
          expect(ringAt(over, y).rz).toBeGreaterThan(ringAt(under, y).rz + 0.004);
        }
      };
      check(top, below);
      check(blazer, top);
      check(blazer, below);
    }
  });
});

describe("la remera tapa los muslos", () => {
  it("ningún punto de la pierna del pantalón (ni la bola de la cadera) queda fuera de la remera", async () => {
    const { bottomShell, jointBalls, legsEnvelope, limbProfiles, profileAt, topShell } = await import("./skeleton");
    const { DEFAULT_TOP } = await import("./look");
    for (const p of [{ gender: "hombre" as const }, { gender: "mujer" as const, bodyType: "triangulo" as const }]) {
      const sk = buildSkeleton(dims(p));
      const jean = pants();
      const inf = 0.012;
      const top = topShell(sk, DEFAULT_TOP, [bottomShell(sk, jean), legsEnvelope(sk, inf, 0.45, 0.99)]);
      const l = sk.leg(1);
      const ball = jointBalls(sk, inf).hip;
      const prof = limbProfiles(sk);
      for (let y = top[0].y + 0.004; y < 0.99; y += 0.01) {
        const ring = ringAt(top, y);
        const t = Math.max(0, (l.hip[1] - y) / (l.hip[1] - l.knee[1]));
        const tube = y <= l.hip[1] ? profileAt(prof.thigh, t) + inf : 0;
        const r = Math.max(tube, Math.sqrt(Math.max(0, ball.r ** 2 - (y - ball.at[1]) ** 2)));
        if (r === 0) continue;
        for (let k = 0; k < 36; k++) {
          const th = (Math.PI * 2 * k) / 36;
          const x = l.hip[0] + r * Math.cos(th);
          const z = l.hip[2] + r * Math.sin(th);
          expect((x / ring.rx) ** 2 + ((z - ring.z) / ring.rz) ** 2).toBeLessThan(1);
        }
      }
    }
  });
});

describe("detalles debajo del abrigo", () => {
  it("el ruedo elastizado, los botones y el bolsillo canguro quedan adentro del abrigo", async () => {
    const { outerShell, topEnvelope, topHemTube, topShell } = await import("./skeleton");
    const { DEFAULT_TOP } = await import("./look");
    const sk = buildSkeleton(dims({ gender: "hombre" }));
    const hoodie = { ...DEFAULT_TOP, ribbed: true, pocket: true, neck: "hood" as const, sleeves: "long" as const };
    const shirt = { ...DEFAULT_TOP, buttons: 5 as const, neck: "collar" as const };
    for (const top of [hoodie, shirt]) {
      const rings = topShell(sk, top);
      for (const kind of ["jacket", "blazer", "coat", "vest"] as const) {
        const coat = outerShell(sk, outer(kind), [topEnvelope(top, rings)]);
        // Ruedo: un toro de radio `tube` alrededor del borde de abajo.
        const tube = topHemTube(top);
        const hem = rings[0];
        if (coat[0].y < hem.y - tube) {
          const at = ringAt(coat, hem.y);
          expect(at.rx).toBeGreaterThan(hem.rx + tube);
          expect(at.rz).toBeGreaterThan(hem.rz + tube);
        }
        if (top.pocket) expect(ringAt(coat, 1.0).rz + ringAt(coat, 1.0).z).toBeGreaterThan(ringAt(rings, 1.0).rz + ringAt(rings, 1.0).z + 0.009);
        if (top.buttons) expect(ringAt(coat, 1.2).rz).toBeGreaterThan(ringAt(rings, 1.2).rz + 0.0045);
      }
    }
  });
});

describe("piernas del short", () => {
  it("un short ancho se abre hacia la boca y hacia afuera; uno más grande que tu talle, más largo y suelto", async () => {
    const { bottomInflate, bottomLegExtra, bottomLegShift, bottomLegT, bottomThighProfile } = await import("./skeleton");
    const sk = buildSkeleton(dims({ gender: "hombre" }));
    const short: BottomLook = { ...DEFAULT_BOTTOM, kind: "shorts", legT: 0.5 };
    const wide: BottomLook = { ...short, legWidth: 0.045 };
    const big: BottomLook = { ...short, ease: 2 };
    // Más ancho en la boca que arriba, y más que uno recto.
    expect(bottomLegExtra(sk, wide)(0.5)).toBeGreaterThan(bottomLegExtra(sk, short)(0.5));
    expect(bottomLegExtra(sk, wide)(0.05)).toBeLessThan(bottomLegExtra(sk, wide)(0.5));
    const prof = bottomThighProfile(sk, wide);
    expect(prof[prof.length - 1][1]).toBeGreaterThan(prof[Math.floor(prof.length / 2)][1] - 0.02);
    // Se corre hacia afuera (entre las piernas no hay lugar), pero nunca deja ver la pierna de adentro.
    expect(bottomLegShift(sk, wide)(0.5)).toBeGreaterThan(0);
    for (const t of [0.05, 0.15, 0.3, 0.5]) {
      expect(bottomInflate(wide) + bottomLegExtra(sk, wide)(t) - bottomLegShift(sk, wide)(t)).toBeGreaterThan(0.002);
    }
    // Talle más grande: más largo y más holgado.
    expect(bottomLegT(big)).toBeGreaterThan(bottomLegT(short));
    expect(bottomInflate(big)).toBeGreaterThan(bottomInflate(short));
    // Si se midió la boca de la pierna en la foto, manda esa medida.
    const measured: BottomLook = { ...short, hemR: 0.12 };
    expect(bottomLegExtra(sk, measured)(0.5)).toBeGreaterThan(bottomLegExtra(sk, short)(0.5));
  });
});
