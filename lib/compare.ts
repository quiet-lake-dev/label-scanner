/**
 * Deterministic comparison of what the model read off the label against what
 * the agent typed in from the application. Each rule returns a status and a
 * note that says which rule fired, so the agent can see the reasoning.
 */
import {
  findPercent,
  findProof,
  findVolumeMl,
  normalize,
  similarity,
  tokenCoverage,
  tokens,
} from "./text";
import type { Extraction, FieldName, FieldResult } from "./types";
import { FIELD_LABELS, FIELD_NAMES } from "./types";

type Rule = (expected: string, found: string) => Pick<FieldResult, "status" | "note">;

function nameRule(expected: string, found: string): Pick<FieldResult, "status" | "note"> {
  const e = normalize(expected);
  const f = normalize(found);
  if (expected.trim() === found.trim()) {
    return { status: "match", note: "Exact match." };
  }
  if (e === f) {
    return {
      status: "match",
      note: "Same wording; only capitalisation or punctuation differs.",
    };
  }
  if (e.includes(f) || f.includes(e)) {
    return {
      status: "minor_discrepancy",
      note: "One is a shorter form of the other. Check that the label is not dropping part of the name.",
    };
  }
  const score = similarity(e, f);
  if (score >= 0.85) {
    return {
      status: "minor_discrepancy",
      note: "Nearly the same text. Could be a typo on one side or a misread character in the image.",
    };
  }
  return { status: "mismatch", note: "Label text does not match the application." };
}

function classTypeRule(expected: string, found: string): Pick<FieldResult, "status" | "note"> {
  const e = normalize(expected);
  const f = normalize(found);
  if (e === f) {
    return {
      status: "match",
      note: expected.trim() === found.trim() ? "Exact match." : "Same designation; only capitalisation or punctuation differs.",
    };
  }
  // The model joins a multi-line designation with " / ". If one of the lines
  // is the designation applied for, the others are extra statements printed
  // with it (an appellation, a colour class), not a different designation.
  const segments = found.split(" / ").map((s) => s.trim()).filter(Boolean);
  if (segments.length > 1) {
    const others = segments.filter((s) => normalize(s) !== e);
    if (others.length < segments.length) {
      return {
        status: "match",
        note: `Same designation. Label also prints ${others.map((s) => `"${s}"`).join(" and ")}.`,
      };
    }
  }
  const coverage = tokenCoverage(tokens(expected), tokens(found));
  if (coverage === 1) {
    return {
      status: "minor_discrepancy",
      note: "Label contains every word of the application's designation plus extra wording. Confirm the extra words are allowed.",
    };
  }
  if (coverage >= 0.6 || similarity(e, f) >= 0.85) {
    return {
      status: "minor_discrepancy",
      note: "Designations overlap but are not identical. Confirm the label's class/type is the one applied for.",
    };
  }
  return { status: "mismatch", note: "Class/type on the label does not match the application." };
}

function alcoholRule(expected: string, found: string): Pick<FieldResult, "status" | "note"> {
  const expectedPct = findPercent(expected) ?? proofToPercent(findProof(expected));
  const foundPct = findPercent(found);
  const foundProof = findProof(found);

  if (expectedPct === null) {
    return {
      status: "minor_discrepancy",
      note: "Could not read a percentage from the application value. Compare by eye.",
    };
  }
  const labelPct = foundPct ?? proofToPercent(foundProof);
  if (labelPct === null) {
    return {
      status: "minor_discrepancy",
      note: "Label shows alcohol text but no percentage or proof figure could be read from it.",
    };
  }
  if (Math.abs(labelPct - expectedPct) > 0.05) {
    return {
      status: "mismatch",
      note: `Label shows ${labelPct}% alcohol by volume; application says ${expectedPct}%.`,
    };
  }
  if (foundPct !== null && foundProof !== null && Math.abs(foundProof - foundPct * 2) > 0.1) {
    return {
      status: "minor_discrepancy",
      note: `Percentage matches, but the label's proof (${foundProof}) does not equal twice the percentage.`,
    };
  }
  return { status: "match", note: `${expectedPct}% alcohol by volume on both.` };
}

function proofToPercent(proof: number | null): number | null {
  return proof === null ? null : proof / 2;
}

function netContentsRule(expected: string, found: string): Pick<FieldResult, "status" | "note"> {
  const e = findVolumeMl(expected);
  const f = findVolumeMl(found);
  if (e === null || f === null) {
    if (normalize(expected) === normalize(found)) {
      return { status: "match", note: "Same text on both." };
    }
    return {
      status: "minor_discrepancy",
      note: "Could not read a volume from one of the values. Compare by eye.",
    };
  }
  // 1% covers rounding between fl oz and mL (12 fl oz is 354.9 mL, labels print 355).
  if (Math.abs(e - f) / Math.max(e, f) <= 0.01) {
    const sameUnits = normalize(expected) === normalize(found);
    return {
      status: "match",
      note: sameUnits ? "Exact match." : `Same volume (${Math.round(f)} mL) written differently.`,
    };
  }
  return {
    status: "mismatch",
    note: `Label shows about ${Math.round(f)} mL; application says about ${Math.round(e)} mL.`,
  };
}

const BOTTLER_NOISE = /\b(distilled|produced|bottled|brewed|made|vinted|cellared|blended|imported|packed|and|by|for)\b/g;

function bottlerRule(expected: string, found: string): Pick<FieldResult, "status" | "note"> {
  const e = normalize(expected).replace(BOTTLER_NOISE, " ").replace(/\s+/g, " ").trim();
  const f = normalize(found).replace(BOTTLER_NOISE, " ").replace(/\s+/g, " ").trim();
  if (e === f) return { status: "match", note: "Same name and address." };
  const coverage = tokenCoverage(e.split(" "), f.split(" "));
  if (coverage >= 0.8) {
    return {
      status: "match",
      note: "Name and address agree; formatting or abbreviations differ.",
    };
  }
  if (coverage >= 0.5) {
    return {
      status: "minor_discrepancy",
      note: "Partial agreement. Check the parts that differ (often a suite number or abbreviated street).",
    };
  }
  return { status: "mismatch", note: "Bottler name/address on the label does not match the application." };
}

const COUNTRY_ALIASES: Record<string, string> = {
  usa: "united states",
  "u s a": "united states",
  us: "united states",
  "united states of america": "united states",
  america: "united states",
  uk: "united kingdom",
  "great britain": "united kingdom",
  england: "united kingdom",
  scotland: "united kingdom",
};

function countryName(s: string): string {
  const n = normalize(s)
    .replace(/\b(product|produce|products)\s+of\b/g, "")
    .replace(/\b(imported\s+from|made\s+in|bottled\s+in|distilled\s+in)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return COUNTRY_ALIASES[n] ?? n;
}

function countryRule(expected: string, found: string): Pick<FieldResult, "status" | "note"> {
  const e = countryName(expected);
  const f = countryName(found);
  if (e === f) return { status: "match", note: "Same country." };
  if (f.includes(e) || e.includes(f)) {
    return { status: "match", note: "Same country, written differently." };
  }
  return { status: "mismatch", note: "Country on the label does not match the application." };
}

const RULES: Record<FieldName, Rule> = {
  brandName: nameRule,
  classType: classTypeRule,
  alcoholContent: alcoholRule,
  netContents: netContentsRule,
  bottlerNameAddress: bottlerRule,
  countryOfOrigin: countryRule,
};

export function compareField(
  field: FieldName,
  expected: string,
  found: string | null,
  uncertain: boolean,
  imageReadable: boolean,
): FieldResult {
  const base = { field, label: FIELD_LABELS[field], expected, found, uncertain };

  if (found === null || found.trim() === "") {
    if (!imageReadable || uncertain) {
      return {
        ...base,
        status: "unreadable",
        note: "Could not be read from this image. A clearer photo may help.",
      };
    }
    return { ...base, status: "not_found", note: "Not found on the label." };
  }

  const outcome = RULES[field](expected, found);
  const note = uncertain ? `${outcome.note} Hard to read; confirm against the image.` : outcome.note;
  return { ...base, ...outcome, note };
}

/**
 * Compare every field the application supplied. Fields left blank on the
 * application are skipped rather than reported as missing.
 */
export function compareAll(app: Partial<Record<FieldName, string>>, ex: Extraction): FieldResult[] {
  const readable = ex.imageQuality.readable;
  return FIELD_NAMES.filter((field) => app[field]?.trim()).map((field) =>
    compareField(field, app[field]!.trim(), ex[field], ex.uncertain.includes(field), readable),
  );
}
