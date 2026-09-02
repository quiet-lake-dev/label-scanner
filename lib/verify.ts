/**
 * Ties the two stages together: the model reads the label (extract.ts), then
 * plain code decides what matches (compare.ts, warning.ts) and rolls it up
 * into a verdict the agent can act on.
 */
import { compareAll } from "./compare";
import { checkWarning } from "./warning";
import type { Application, Extraction, FieldResult, Verdict, VerificationResult, WarningResult } from "./types";
import { VERDICT_LABELS } from "./types";

export function decideVerdict(
  fields: FieldResult[],
  warning: WarningResult,
  imageQuality: Extraction["imageQuality"],
): { verdict: Verdict; reasons: string[] } {
  const reasons: string[] = [];

  const unreadable = fields.filter((f) => f.status === "unreadable");
  if (!imageQuality.readable || (fields.length > 0 && unreadable.length >= Math.ceil(fields.length / 2))) {
    const issues = imageQuality.issues.length ? ` (${imageQuality.issues.join(", ").replace(/_/g, " ")})` : "";
    reasons.push(`The image is too hard to read${issues}. Ask for a clearer photo.`);
    return { verdict: "cannot_verify", reasons };
  }

  if (!warning.passes) reasons.push(`Government warning: ${warning.note}`);
  for (const f of fields) {
    if (f.status === "mismatch") reasons.push(`${f.label}: ${f.note}`);
  }
  if (reasons.length > 0) return { verdict: "likely_reject", reasons };

  for (const f of fields) {
    if (f.status === "minor_discrepancy") reasons.push(`${f.label}: ${f.note}`);
    if (f.status === "not_found") reasons.push(`${f.label}: ${f.note}`);
    if (f.status === "unreadable") reasons.push(`${f.label}: ${f.note}`);
  }
  if (warning.advisories.some((a) => a.includes("not in bold"))) {
    reasons.push("Government warning heading may not be bold.");
  }
  if (reasons.length > 0) return { verdict: "needs_review", reasons };

  reasons.push("Every field matches and the government warning is correct.");
  return { verdict: "likely_approve", reasons };
}

export function buildResult(
  app: Application,
  extraction: Extraction,
  timing: { modelMs: number; totalMs: number },
): VerificationResult {
  const fields = compareAll(app, extraction);
  const warning = checkWarning(extraction.governmentWarning);
  const { verdict, reasons } = decideVerdict(fields, warning, extraction.imageQuality);
  return {
    verdict,
    reasons,
    fields,
    warning,
    imageQuality: extraction.imageQuality,
    ...timing,
  };
}

export function verdictLabel(v: Verdict): string {
  return VERDICT_LABELS[v];
}
