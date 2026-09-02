import { z } from "zod";

export type BeverageType = "distilled_spirits" | "wine" | "malt_beverage";

export const BEVERAGE_TYPES: { value: BeverageType; label: string }[] = [
  { value: "distilled_spirits", label: "Distilled spirits" },
  { value: "wine", label: "Wine" },
  { value: "malt_beverage", label: "Malt beverage (beer)" },
];

/** What the agent enters from the COLA application. */
export interface Application {
  beverageType: BeverageType;
  brandName: string;
  classType: string;
  alcoholContent: string;
  netContents: string;
  bottlerNameAddress?: string;
  countryOfOrigin?: string;
}

export const applicationSchema = z.object({
  beverageType: z.enum(["distilled_spirits", "wine", "malt_beverage"]),
  brandName: z.string().trim().min(1, "Brand name is required"),
  classType: z.string().trim().default(""),
  alcoholContent: z.string().trim().default(""),
  netContents: z.string().trim().default(""),
  bottlerNameAddress: z.string().trim().default(""),
  countryOfOrigin: z.string().trim().default(""),
});

/**
 * Shape the vision model must return. Structured outputs guarantee the JSON
 * matches this schema, so the rest of the pipeline can trust it.
 *
 * Every text field is transcribed exactly as printed, no normalisation.
 * `confidence` is the model's own estimate of how clearly it could read it.
 */
const readField = z.object({
  value: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export const extractionSchema = z.object({
  brandName: readField,
  classType: readField,
  alcoholContent: readField,
  netContents: readField,
  bottlerNameAddress: readField,
  countryOfOrigin: readField,
  governmentWarning: z.object({
    present: z.boolean(),
    verbatimText: z.string().nullable(),
    headingAllCaps: z.boolean().nullable(),
    headingBold: z.boolean().nullable(),
    legible: z.boolean().nullable(),
  }),
  imageQuality: z.object({
    readable: z.boolean(),
    issues: z.array(
      z.enum(["glare", "angle", "blur", "low_resolution", "partial", "dark"]),
    ),
  }),
});

export type Extraction = z.infer<typeof extractionSchema>;
export type ReadField = z.infer<typeof readField>;

export type FieldStatus =
  | "match"
  | "minor_discrepancy"
  | "mismatch"
  | "not_found"
  | "unreadable";

export type FieldName =
  | "brandName"
  | "classType"
  | "alcoholContent"
  | "netContents"
  | "bottlerNameAddress"
  | "countryOfOrigin";

export const FIELD_LABELS: Record<FieldName, string> = {
  brandName: "Brand name",
  classType: "Class / type",
  alcoholContent: "Alcohol content",
  netContents: "Net contents",
  bottlerNameAddress: "Bottler name and address",
  countryOfOrigin: "Country of origin",
};

export interface FieldResult {
  field: FieldName;
  label: string;
  status: FieldStatus;
  expected: string;
  found: string | null;
  confidence: number;
  /** Plain-English explanation of why this status was chosen. */
  note: string;
}

export type WarningStatus =
  | "ok"
  | "missing"
  | "heading_missing"
  | "heading_not_caps"
  | "wording_differs"
  | "unreadable";

export interface DiffToken {
  kind: "same" | "added" | "removed";
  text: string;
}

export interface WarningResult {
  status: WarningStatus;
  /** Whether the text passes the mandatory checks (present, heading, wording). */
  passes: boolean;
  found: string | null;
  /** Word-level diff of the found text against the required text. */
  diff: DiffToken[];
  /** Things the agent should eyeball; the model is not reliable on these. */
  advisories: string[];
  note: string;
}

export type Verdict =
  | "likely_approve"
  | "needs_review"
  | "likely_reject"
  | "cannot_verify";

export const VERDICT_LABELS: Record<Verdict, string> = {
  likely_approve: "Likely approve",
  needs_review: "Needs review",
  likely_reject: "Likely reject",
  cannot_verify: "Cannot verify",
};

export interface VerificationResult {
  verdict: Verdict;
  reasons: string[];
  fields: FieldResult[];
  warning: WarningResult;
  imageQuality: Extraction["imageQuality"];
  /** Wall-clock time spent on the model call, in milliseconds. */
  modelMs: number;
  /** Total server time for the request, in milliseconds. */
  totalMs: number;
}
