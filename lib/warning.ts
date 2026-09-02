/**
 * Government health warning check (27 CFR 16.21).
 *
 * The statement has to appear word for word, and the words "GOVERNMENT
 * WARNING" have to be in capitals and bold. Title case is a rejection.
 */
import type { DiffToken, Extraction, WarningResult } from "./types";

export const HEADING = "GOVERNMENT WARNING:";

export const REQUIRED_TEXT =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not " +
  "drink alcoholic beverages during pregnancy because of the risk of birth " +
  "defects. (2) Consumption of alcoholic beverages impairs your ability to " +
  "drive a car or operate machinery, and may cause health problems.";

/** Words only, lower case, so punctuation and line breaks do not count as differences. */
export function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Word-level diff (longest common subsequence). `removed` = required word missing, `added` = extra word on the label. */
export function diffWords(required: string[], actual: string[]): DiffToken[] {
  const n = required.length;
  const m = actual.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] =
        required[i] === actual[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (required[i] === actual[j]) {
      out.push({ kind: "same", text: required[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ kind: "removed", text: required[i] });
      i++;
    } else {
      out.push({ kind: "added", text: actual[j] });
      j++;
    }
  }
  while (i < n) out.push({ kind: "removed", text: required[i++] });
  while (j < m) out.push({ kind: "added", text: actual[j++] });
  return out;
}

export function checkWarning(gw: Extraction["governmentWarning"]): WarningResult {
  const found = gw.verbatimText?.trim() || null;
  const advisories: string[] = [];

  if (!gw.present || !found) {
    return {
      status: "missing",
      passes: false,
      found,
      diff: [],
      advisories,
      note: "No government warning statement was found on the label.",
    };
  }

  if (gw.legible === false) {
    advisories.push("The model reported the warning text as hard to read. Check it against the image.");
  }

  // Heading: must be the exact capitalised string with a colon.
  const headingMatch = found.match(/government\s+warning\s*:?/i);
  if (!headingMatch) {
    return {
      status: "heading_missing",
      passes: false,
      found,
      diff: diffWords(words(REQUIRED_TEXT), words(found)),
      advisories,
      note: 'The statement does not start with "GOVERNMENT WARNING:".',
    };
  }
  const headingAsPrinted = headingMatch[0].replace(/\s+/g, " ").trim();
  if (headingAsPrinted !== HEADING) {
    const reason = !headingAsPrinted.endsWith(":")
      ? "is missing the colon"
      : "is not in all capital letters";
    return {
      status: "heading_not_caps",
      passes: false,
      found,
      diff: diffWords(words(REQUIRED_TEXT), words(found)),
      advisories,
      note: `The heading reads "${headingAsPrinted}" and ${reason}. It must be exactly "GOVERNMENT WARNING:".`,
    };
  }

  // Body: word for word.
  const diff = diffWords(words(REQUIRED_TEXT), words(found));
  const changed = diff.filter((t) => t.kind !== "same");
  if (changed.length > 0) {
    const missing = changed.filter((t) => t.kind === "removed").length;
    const extra = changed.filter((t) => t.kind === "added").length;
    const parts: string[] = [];
    if (missing) parts.push(`${missing} required word${missing === 1 ? "" : "s"} missing`);
    if (extra) parts.push(`${extra} extra word${extra === 1 ? "" : "s"}`);
    return {
      status: "wording_differs",
      passes: false,
      found,
      diff,
      advisories,
      note: `Wording differs from the required statement: ${parts.join(", ")}. Small differences can also be misreads of the image, so compare with the label before rejecting.`,
    };
  }

  // Bold and prominence are visual judgements a vision model is not reliable on,
  // so they are surfaced as things to look at rather than pass/fail.
  if (gw.headingBold === false) {
    advisories.push('The model thinks "GOVERNMENT WARNING:" is not in bold type. Confirm by eye; bold is required.');
  } else if (gw.headingBold === null) {
    advisories.push("Could not tell whether the heading is bold. Confirm by eye; bold is required.");
  }

  return {
    status: "ok",
    passes: true,
    found,
    diff,
    advisories,
    note: "Statement is present, the heading is in capitals, and the wording matches word for word.",
  };
}
