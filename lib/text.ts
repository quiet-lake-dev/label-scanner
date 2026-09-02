/** Small text helpers shared by the matching rules. No model calls here. */

/** Lowercase, straighten quotes, drop punctuation, collapse whitespace. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9%'\s]/g, " ")
    .replace(/'/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokens(s: string): string[] {
  const n = normalize(s);
  return n ? n.split(" ") : [];
}

/** Levenshtein edit distance between two strings. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

/** 1.0 for identical strings, 0.0 for nothing in common. */
export function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;
  return 1 - editDistance(a, b) / longest;
}

/** Share of `needle` tokens that also appear in `haystack`. */
export function tokenCoverage(needle: string[], haystack: string[]): number {
  if (needle.length === 0) return 1;
  const pool = new Set(haystack);
  const hit = needle.filter((t) => pool.has(t)).length;
  return hit / needle.length;
}

/** Pull "45%" style percentages out of text, returned as numbers. */
export function findPercent(s: string): number | null {
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (m) return parseFloat(m[1].replace(",", "."));
  // "45 ALC/VOL" with the % sign lost to OCR
  const m2 = s.match(/(\d+(?:[.,]\d+)?)\s*(?:alc|abv|alcohol)/i);
  return m2 ? parseFloat(m2[1].replace(",", ".")) : null;
}

export function findProof(s: string): number | null {
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*(?:°\s*)?proof/i);
  return m ? parseFloat(m[1].replace(",", ".")) : null;
}

const ML_PER_UNIT: [RegExp, number][] = [
  [/^(ml|mls|milliliters?|millilitres?)$/, 1],
  [/^(cl|centiliters?|centilitres?)$/, 10],
  [/^(l|ltr|liters?|litres?)$/, 1000],
  [/^(fl\.?\s?oz\.?|fluid\s?ounces?|oz\.?|ounces?)$/, 29.5735],
  [/^(pt\.?|pints?)$/, 473.176],
  [/^(qt\.?|quarts?)$/, 946.353],
  [/^(gal\.?|gallons?)$/, 3785.41],
];

/** First recognisable volume in the text, converted to millilitres. */
export function findVolumeMl(s: string): number | null {
  const cleaned = s.toLowerCase().replace(/,/g, "");
  const re =
    /(\d+(?:\.\d+)?)\s*(fl\.?\s?oz\.?|fluid\s?ounces?|oz\.?|ounces?|ml|mls|milliliters?|millilitres?|cl|centiliters?|centilitres?|l|ltr|liters?|litres?|pt\.?|pints?|qt\.?|quarts?|gal\.?|gallons?)(?![a-z])/g;
  for (const m of cleaned.matchAll(re)) {
    const qty = parseFloat(m[1]);
    const unit = m[2].replace(/\s+/g, " ");
    for (const [pattern, factor] of ML_PER_UNIT) {
      if (pattern.test(unit)) return qty * factor;
    }
  }
  return null;
}
