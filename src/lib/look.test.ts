import { describe, expect, it } from "vitest";
import { selectionFrom } from "./avatar";
import { adjust, contrast, lightness, lookFrom } from "./look";
import type { Garment, GarmentFit } from "./types";

const g = (p: Partial<Garment> & Pick<Garment, "id" | "category" | "color">): Garment => ({
  photo: "",
  name: "prenda",
  pattern: "liso",
  styles: [],
  formality: 2,
  warmth: "medium",
  createdAt: 0,
  ...p,
});

describe("lookFrom", () => {
  const ropa = [
    g({ id: "t", category: "top", color: "blanco", name: "Remera blanca", warmth: "light" }),
    g({ id: "b", category: "bottom", color: "denim", name: "Jean" }),
    g({ id: "s", category: "bottom", color: "beige", name: "Bermuda beige" }),
    g({ id: "d", category: "dress", color: "rojo", name: "Vestido de fiesta", formality: 5 }),
    g({ id: "z", category: "shoes", color: "marron", name: "Botas marrones" }),
    g({ id: "c", category: "accessory", color: "negro", name: "Gorra negra" }),
  ];

  it("pone cada prenda en su lugar con su color", () => {
    const look = lookFrom(selectionFrom([ropa[0], ropa[1], ropa[4], ropa[5]]), ropa);
    expect(look.top).toMatchObject({ color: "#f7f7f5", sleeves: "short", dress: "none" });
    expect(look.bottom).toMatchObject({ kind: "pants" });
    expect(look.shoes).toMatchObject({ kind: "boot" });
    expect(look.accessory).toMatchObject({ kind: "cap" });
  });

  it("reconoce bermudas y vestidos largos, y el vestido tapa lo de abajo", () => {
    expect(lookFrom({ bottom: "s" }, ropa).bottom?.kind).toBe("bermuda");
    const look = lookFrom({ top: "d", bottom: "b" }, ropa);
    expect(look.top?.dress).toBe("long");
    expect(look.bottom).toBeNull();
  });
});

describe("detalles de cada tipo de prenda", () => {
  const k = (p: Partial<Garment> & Pick<Garment, "category" | "kind">) =>
    g({ id: p.kind!, color: "negro", name: p.kind!, ...p });
  const ropa = [
    k({ category: "top", kind: "camisa" }),
    k({ category: "top", kind: "hoodie" }),
    k({ category: "top", kind: "polera" }),
    k({ category: "top", kind: "musculosa" }),
    k({ category: "top", kind: "chomba" }),
    k({ category: "top", kind: "crop-top" }),
    k({ category: "bottom", kind: "jogging" }),
    k({ category: "bottom", kind: "palazzo" }),
    k({ category: "bottom", kind: "pollera-midi" }),
    k({ category: "bottom", kind: "calza" }),
    k({ category: "shoes", kind: "tacos" }),
    k({ category: "shoes", kind: "botas-altas" }),
    k({ category: "shoes", kind: "ojotas" }),
    k({ category: "shoes", kind: "mocasines" }),
    k({ category: "outerwear", kind: "saco" }),
    k({ category: "outerwear", kind: "campera-inflable" }),
    k({ category: "outerwear", kind: "parka" }),
    k({ category: "accessory", kind: "gorro" }),
    k({ category: "accessory", kind: "sombrero" }),
    k({ category: "dress", kind: "enterito" }),
    k({ category: "interior", kind: "calzon" }),
    k({ category: "malla", kind: "bikini-arriba" }),
  ];
  const look = (slot: string, id: string) => lookFrom({ [slot]: id }, ropa);

  it("partes de arriba", () => {
    expect(look("top", "camisa").top).toMatchObject({ neck: "collar", placket: "full", buttons: 7, sleeves: "long", cuffs: true, chestPocket: true });
    expect(look("top", "hoodie").top).toMatchObject({ neck: "hood", pocket: true, ribbed: true });
    expect(look("top", "polera").top).toMatchObject({ neck: "turtle", sleeves: "long" });
    expect(look("top", "musculosa").top).toMatchObject({ sleeves: "none", neck: "straps" });
    expect(look("top", "chomba").top).toMatchObject({ neck: "polo", placket: "short", buttons: 3, sleeves: "short" });
    expect(look("top", "crop-top").top?.cut).toBe("crop");
    expect(look("top", "bikini-arriba").top?.cut).toBe("bra");
  });

  it("partes de abajo", () => {
    expect(look("bottom", "jogging").bottom).toMatchObject({ kind: "pants", cuffs: true });
    expect(look("bottom", "palazzo").bottom).toMatchObject({ kind: "pants", wide: true });
    expect(look("bottom", "pollera-midi").bottom).toMatchObject({ kind: "skirt", length: "midi" });
    expect(look("bottom", "calza").bottom).toMatchObject({ tight: true });
    expect(look("bottom", "calzon").bottom?.kind).toBe("brief");
  });

  it("calzado, abrigos y accesorios", () => {
    expect(look("shoes", "tacos").shoes?.kind).toBe("heel");
    expect(look("shoes", "botas-altas").shoes?.kind).toBe("tallboot");
    expect(look("shoes", "ojotas").shoes?.kind).toBe("flipflop");
    expect(look("shoes", "mocasines").shoes?.kind).toBe("loafer");
    expect(look("outerwear", "saco").outerwear?.kind).toBe("blazer");
    expect(look("outerwear", "campera-inflable").outerwear?.kind).toBe("puffer");
    expect(look("outerwear", "parka").outerwear).toMatchObject({ kind: "coat", hood: true });
    expect(look("accessory", "gorro").accessory?.kind).toBe("beanie");
    expect(look("accessory", "sombrero").accessory?.kind).toBe("hat");
  });

  it("el enterito es arriba y pantalón del mismo color", () => {
    const l = look("top", "enterito");
    expect(l.top?.dress).toBe("none");
    expect(l.bottom?.kind).toBe("pants");
  });
});

describe("prenda digital: cómo se ve cada tipo", () => {
  const fit = (details: GarmentFit["details"], extra: Partial<GarmentFit> = {}): GarmentFit => ({
    v: 3,
    angle: 0,
    box: [0, 0, 1, 1],
    fabric: "#161b24",
    details,
    ...extra,
  });

  it("el short deportivo con logo: color real de la tela, sin rayas, elástico, cordón y corto", () => {
    const short = g({
      id: "s",
      category: "bottom",
      kind: "short",
      color: "azul-marino",
      pattern: "estampado",
      name: "Short deportivo Nike",
      sport: "general",
      photo: "data:image/jpeg;base64,xx",
      fit: { front: fit(undefined, { print: { box: [0.2, 0.6, 0.3, 0.7], x: -0.55, y: 0.8, width: 0.12 } }) },
    });
    const b = lookFrom({ bottom: "s" }, [short]).bottom!;
    expect(b.color).toBe("#161b24");
    expect(b.pattern).toBeNull();
    expect(b).toMatchObject({ kind: "shorts", waist: "elastic", drawstring: true, fly: false });
    expect(b.legT).toBeLessThan(0.5);
    expect(b.print?.fitFront?.print?.x).toBe(-0.55);
  });

  it("una camisa siempre tiene tira de botones, aunque la IA no los haya visto, y botones que se ven", () => {
    const blanca = g({ id: "c", category: "top", kind: "camisa-manga-corta", color: "blanco", name: "Camisa de lino" });
    const t = lookFrom({ top: "c" }, [blanca]).top!;
    expect(t).toMatchObject({ neck: "collar", placket: "full", sleeves: "short", chestPocket: true, cuffs: false });
    expect(t.buttons).toBeGreaterThanOrEqual(6);
    // Botones blancos sobre camisa blanca no se verían: van un poco más oscuros.
    expect(lightness(t.buttonColor)).toBeLessThan(lightness(t.color) - 0.15);
  });

  it("lo que vio la IA suma detalles: capucha, franjas, dibujo de la tela, bolsillos cargo", () => {
    const campera = g({ id: "o", category: "outerwear", kind: "campera", color: "negro", name: "Campera", fit: { front: fit({ hood: true }) } });
    const jogging = g({ id: "j", category: "bottom", kind: "jogging", color: "negro", fit: { back: fit({ sideStripes: true, trim: "#ffffff" }) } });
    const cuadros = g({ id: "q", category: "top", kind: "camisa", color: "rojo", fit: { front: fit({ pattern: "cuadros", patternColor: "#000000" }) } });
    const cargo = g({ id: "k", category: "bottom", kind: "pantalon-vestir", color: "verde", fit: { front: fit({ pockets: "cargo" }) } });
    const all = [campera, jogging, cuadros, cargo];
    expect(lookFrom({ outerwear: "o" }, all).outerwear?.hood).toBe(true);
    expect(lookFrom({ bottom: "j" }, all).bottom).toMatchObject({ sideStripes: true, trim: "#ffffff", waist: "elastic", cuffs: true });
    expect(lookFrom({ top: "q" }, all).top?.pattern).toEqual({ kind: "cuadros", color: "#000000" });
    expect(lookFrom({ bottom: "k" }, all).bottom?.pockets).toBe("cargo");
  });

  it("la ojota de tira ancha es chancla; la de tiras, sandalia", () => {
    const o = (strap: "dedo" | "ancha" | "tiras") =>
      lookFrom({ shoes: "x" }, [g({ id: "x", category: "shoes", kind: "ojotas", color: "azul", fit: { front: fit({ strap }) } })]).shoes!.kind;
    expect(o("dedo")).toBe("flipflop");
    expect(o("ancha")).toBe("slide");
    expect(o("tiras")).toBe("sandal");
  });

  it("la malla de abajo es short de baño para él y bikini para ella", () => {
    const m = [g({ id: "m", category: "malla", kind: "malla-abajo", color: "azul" })];
    expect(lookFrom({ bottom: "m" }, m, "hombre").bottom).toMatchObject({ kind: "shorts", waist: "elastic", drawstring: true });
    expect(lookFrom({ bottom: "m" }, m, "mujer").bottom?.kind).toBe("brief");
    const boxer = [g({ id: "b", category: "interior", kind: "boxer", color: "blanco" })];
    expect(lookFrom({ bottom: "b" }, boxer, "hombre").bottom).toMatchObject({ kind: "shorts", waist: "elastic" });
    expect(lookFrom({ bottom: "b" }, boxer, "hombre").bottom!.legT).toBeLessThan(0.3);
  });

  it("con cinturón la remera va metida (si no, no se vería)", () => {
    const ropa = [
      g({ id: "t", category: "top", kind: "camisa", color: "celeste" }),
      g({ id: "p", category: "bottom", kind: "jean", color: "denim" }),
      g({ id: "c", category: "accessory", kind: "cinturon", color: "marron" }),
    ];
    expect(lookFrom({ top: "t", bottom: "p", accessory: "c" }, ropa).top?.tucked).toBe(true);
    expect(lookFrom({ top: "t", bottom: "p" }, ropa).top?.tucked).toBe(false);
    const jean = lookFrom({ bottom: "p" }, ropa).bottom!;
    expect(jean).toMatchObject({ waist: "belt", fly: true, pockets: "jean", trim: "#c98a3a" });
  });

  it("cada accesorio tiene su forma (antes muchos no se dibujaban)", () => {
    const kinds: [string, string][] = [
      ["cinturon", "belt"],
      ["reloj", "watch"],
      ["anteojos-sol", "sunglasses"],
      ["collar", "necklace"],
      ["corbata", "tie"],
      ["mochila", "backpack"],
      ["cartera", "bag"],
      ["rinonera", "waistbag"],
      ["guantes", "gloves"],
      ["tiradores", "suspenders"],
    ];
    for (const [kind, want] of kinds) {
      const a = lookFrom({ accessory: "a" }, [g({ id: "a", category: "accessory", kind, color: "negro" })]).accessory!;
      expect(a.kind).toBe(want);
    }
  });

  it("colores: contraste para que los detalles se vean", () => {
    expect(lightness("#ffffff")).toBeCloseTo(1);
    expect(lightness(adjust("#808080", -0.5))).toBeLessThan(lightness("#808080"));
    expect(lightness(contrast("#ffffff"))).toBeLessThan(0.8);
    expect(lightness(contrast("#000000"))).toBeGreaterThan(0.2);
  });
});

describe("shorts: talle, ancho, terminación y bolsillos", () => {
  const fit = (details: GarmentFit["details"]): Garment["fit"] => ({ front: { v: 4, angle: 0, box: [0, 0, 1, 1], fabric: "#202020", details } });
  const ropa = [
    g({ id: "run", category: "bottom", kind: "short", color: "negro", name: "Short de correr", sport: "running", size: "L" }),
    g({ id: "jean", category: "bottom", kind: "short", color: "denim", name: "Short de jean", size: "M", fit: fit({ pockets: "jean", hem: "doblado" }) }),
    g({ id: "bask", category: "bottom", kind: "short", color: "rojo", name: "Short de básquet", fit: fit({ width: "muy-holgado", hem: "tajo" }) }),
    g({ id: "remera", category: "top", kind: "remera", color: "blanco", size: "XS" }),
  ];

  it("cada short sale distinto: ancho, bolsillos y terminación", () => {
    const run = lookFrom({ bottom: "run" }, ropa).bottom!;
    const jean = lookFrom({ bottom: "jean" }, ropa).bottom!;
    const bask = lookFrom({ bottom: "bask" }, ropa).bottom!;
    // El deportivo tiene bolsillos en la costura del costado y es más suelto que el de jean.
    expect(run.pockets).toBe("side");
    expect(run.legWidth).toBeGreaterThan(jean.legWidth);
    expect(jean).toMatchObject({ pockets: "jean", hem: "doblado" });
    expect(bask).toMatchObject({ hem: "tajo" });
    expect(bask.legWidth).toBeGreaterThan(run.legWidth);
  });

  it("compara el talle de la prenda con el tuyo", () => {
    const sizes = { top: "M", bottom: "M" };
    expect(lookFrom({ bottom: "run" }, ropa, null, { sizes }).bottom!.ease).toBe(1);
    expect(lookFrom({ bottom: "jean" }, ropa, null, { sizes }).bottom!.ease).toBe(0);
    expect(lookFrom({ top: "remera" }, ropa, null, { sizes }).top!.ease).toBe(-2);
    // Sin tu talle no se cambia nada.
    expect(lookFrom({ bottom: "run" }, ropa).bottom!.ease).toBe(0);
  });

  it("guarda la foto de adelante para medir el largo y el ancho", () => {
    const withPhoto = [g({ id: "p", category: "bottom", kind: "short", color: "negro", photo: "data:x", fit: fit({}) })];
    expect(lookFrom({ bottom: "p" }, withPhoto).bottom!.source).toMatchObject({ src: "data:x" });
  });
});

describe("remeras: cuello, ancho, largo y mangas", () => {
  const fit = (details: GarmentFit["details"]): Garment["fit"] => ({ front: { v: 5, angle: 0, box: [0, 0, 1, 1], fabric: "#202020", details } });
  const ropa = [
    g({ id: "v", category: "top", kind: "remera", color: "rojo", fit: fit({ neck: "v", width: "ajustado" }) }),
    g({ id: "h", category: "top", kind: "remera", color: "verde", fit: fit({ neck: "henley" }) }),
    g({ id: "b", category: "top", kind: "remera", color: "blanco", fit: fit({ sleeveColor: "#1e3278", bodyLength: "largo", width: "holgado" }) }),
    g({ id: "c", category: "top", kind: "camisa", color: "celeste", fit: fit({ neck: "v" }) }),
  ];

  it("el cuello sale de lo que vio la IA (en una remera); una camisa sigue con su cuello", () => {
    expect(lookFrom({ top: "v" }, ropa).top).toMatchObject({ neck: "v", width: "ajustado" });
    expect(lookFrom({ top: "h" }, ropa).top).toMatchObject({ neck: "henley", placket: "short", buttons: 3 });
    expect(lookFrom({ top: "c" }, ropa).top!.neck).toBe("collar");
  });

  it("mangas de otro color, largo y ancho", () => {
    const b = lookFrom({ top: "b" }, ropa).top!;
    expect(b).toMatchObject({ sleeveColor: "#1e3278", length: "largo", width: "holgado" });
    // Sin nada dicho, las mangas son del color del cuerpo.
    const v = lookFrom({ top: "v" }, ropa).top!;
    expect(v.sleeveColor).toBe(v.color);
  });
});
