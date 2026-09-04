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

  // Anything that on its own would get the label sent back.
  const problems: string[] = [];
  if (!warning.passes) problems.push(`Government warning: ${warning.note}`);
  for (const f of fields) {
    if (f.status === "mismatch") problems.push(`${f.label}: ${f.note}`);
  }

  // Things an agent should look at before approving.
  const concerns: string[] = [];
  for (const f of fields) {
    if (f.status !== "match" && f.status !== "mismatch") concerns.push(`${f.label}: ${f.note}`);
  }
  // Bold is required but the model is unreliable on it, so anything short of
  // a confident "bold" is a reason to look rather than a reason to reject.
  if (warning.passes && warning.boldStatus === "not_bold") {
    concerns.push("Government warning heading may not be bold. Confirm by eye.");
  } else if (warning.passes && warning.boldStatus === "unknown") {
    concerns.push("Could not tell whether the government warning heading is bold. Confirm by eye.");
  }

  const scopeNote =
    fields.length === 0
      ? ["No application details were entered, so only the government warning was checked."]
      : [];

  if (problems.length > 0) {
    return { verdict: "likely_reject", reasons: [...problems, ...scopeNote] };
  }
  if (concerns.length > 0) {
    return { verdict: "needs_review", reasons: [...concerns, ...scopeNote] };
  }
  return {
    verdict: "likely_approve",
    reasons: [
      fields.length === 0
        ? "The government warning is correct."
        : "Every field matches and the government warning is correct.",
      ...scopeNote,
    ],
  };
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
