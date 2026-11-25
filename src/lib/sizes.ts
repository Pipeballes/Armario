// Talles: para comparar el de una prenda con el tuyo y saber si te queda grande o chica.
// Se comparan talles del mismo tipo (letras con letras, números con números).

const LETTERS = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];

export type ParsedSize = { system: "letter" | "number"; value: number };

/** Lee un talle escrito de cualquier forma ("L", "talle m", "2XL", "42", "W32 L30"). */
export function parseSize(raw: string | null | undefined): ParsedSize | null {
  if (!raw) return null;
  const s = raw.toUpperCase().replace(/TALLE|TALLA|SIZE|:/g, " ").trim();
  // Calzado (US 9.5): no es un talle de ropa.
  if (/^US\b/.test(s)) return null;
  const multi = /\b([2-5])\s*X\s*L\b/.exec(s);
  if (multi) {
    const i = LETTERS.indexOf("X".repeat(Number(multi[1])) + "L");
    return { system: "letter", value: i >= 0 ? i : LETTERS.length - 1 };
  }
  const word = /\b(XXXL|XXL|XL|XXS|XS|S|M|L)\b/.exec(s);
  if (word) return { system: "letter", value: LETTERS.indexOf(word[1]) };
  const num = /(\d{2})/.exec(s);
  if (num) {
    const n = Number(num[1]);
    if (n >= 20 && n <= 64) return { system: "number", value: n };
  }
  return null;
}

/**
 * Cuántos talles más grande (+) o más chica (−) es la prenda que el tuyo. null si no se pueden
 * comparar (falta alguno o son de tipos distintos). En números, cada talle es de a 2 (40, 42, 44).
 */
export function sizeDiff(garment: string | null | undefined, mine: string | null | undefined): number | null {
  const g = parseSize(garment);
  const m = parseSize(mine);
  if (!g || !m || g.system !== m.system) return null;
  const d = g.system === "letter" ? g.value - m.value : (g.value - m.value) / 2;
  return Math.max(-3, Math.min(3, Math.round(d)));
}

/** Cómo te queda, en palabras. */
export function fitNote(diff: number): string {
  if (diff >= 2) return "te queda grande";
  if (diff === 1) return "te queda un poco grande";
  if (diff === 0) return "es tu talle";
  if (diff === -1) return "te queda un poco justa";
  return "te queda chica";
}

export const SIZE_LETTERS = ["XS", "S", "M", "L", "XL", "XXL"];
