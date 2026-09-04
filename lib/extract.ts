/**
 * Stage one: ask the vision model to transcribe the label into fixed JSON
 * shapes. It reads; it does not judge. Matching happens in compare.ts.
 *
 * Two calls run in parallel against the same image: one for the label fields,
 * one for the government warning. A call's duration is dominated by how much
 * JSON it writes, so splitting the output roughly halves the wait.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { BEVERAGE_TYPES, fieldsSchema, warningSchema, type BeverageType, type Extraction } from "./types";

export const MODEL = process.env.LABEL_MODEL || "claude-sonnet-5";

export type ImageMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

const COMMON = `You transcribe alcohol beverage labels for a TTB compliance reviewer. Copy text exactly as printed. Do not correct spelling, expand abbreviations, or change capitalisation. If something is not on the label, use null.`;

const FIELDS_PROMPT = `${COMMON}

Fields:
- brandName: the brand name, usually the most prominent text. Include a secondary line printed as part of the name directly with it (e.g. "RIVERSTONE" over "DISTILLING CO." is "RIVERSTONE DISTILLING CO.").
- classType: the class or type designation line only, e.g. "Kentucky Straight Bourbon Whiskey", "Dry Gin", "India Pale Ale", "Table Wine". For wine this is the varietal name when one is printed (e.g. "Reserve Pinot Noir"), otherwise the class name (e.g. "Red Wine"). Leave out taglines, descriptive lines, and appellation or colour statements printed on a separate line (e.g. "Small Batch American Gin" under "DRY GIN", or "CALIFORNIA RED WINE" under a varietal). If the designation genuinely spans several lines, join them with " / ".
- alcoholContent: the alcohol statement as printed, e.g. "45% Alc./Vol. (90 Proof)" or "12.5% ALC. BY VOL.".
- netContents: the volume as printed, e.g. "750 mL", "12 FL. OZ.".
- bottlerNameAddress: the "bottled by" / "distilled by" / "produced by" / "imported by" line with the name and address, as printed.
- countryOfOrigin: e.g. "Product of France". Null for domestic products with no such statement.
- uncertain: the names of any fields above you could only read with difficulty (small, blurred, glare, cut off). Empty if all were clear.
- imageQuality.readable: false only if the image is so poor that most of the label cannot be read.
- imageQuality.issues: any of glare, angle, blur, low_resolution, partial (label cut off), dark.`;

const WARNING_PROMPT = `${COMMON}

Find the government health warning statement.
- present: whether a government health warning statement appears at all.
- verbatimText: the complete statement copied exactly, including the "GOVERNMENT WARNING:" heading, preserving the original capitalisation of every word. This matters: if the heading is printed as "Government Warning" in mixed case, copy it that way.
- headingBold: whether the heading looks bolder than the sentence after it. Use null if you cannot tell.
- legible: whether the warning text is large and clear enough to read with confidence.`;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) client = new Anthropic({ maxRetries: 1, timeout: 45_000 });
  return client;
}

function beverageLabel(t: BeverageType): string {
  return BEVERAGE_TYPES.find((b) => b.value === t)?.label ?? t;
}

export async function extractLabel(
  imageBase64: string,
  mediaType: ImageMediaType,
  beverageType: BeverageType,
): Promise<{ extraction: Extraction; modelMs: number }> {
  // The application says what kind of product this is. Telling the model helps
  // it pick the right designation line (varietal for wine, style for beer).
  const context = `The application says this is a ${beverageLabel(beverageType).toLowerCase()} label.`;
  const image = {
    type: "image" as const,
    source: { type: "base64" as const, media_type: mediaType, data: imageBase64 },
  };
  // Haiku-class models reject the effort setting; everything current accepts it.
  const effort = /haiku/.test(MODEL) ? {} : { effort: "low" as const };

  const started = Date.now();
  const [fields, warning] = await Promise.all([
    getClient().messages.parse({
      model: MODEL,
      max_tokens: 1500,
      system: FIELDS_PROMPT,
      output_config: { ...effort, format: zodOutputFormat(fieldsSchema) },
      messages: [{ role: "user", content: [image, { type: "text", text: `${context} Transcribe the label fields.` }] }],
    }),
    getClient().messages.parse({
      model: MODEL,
      max_tokens: 1000,
      system: WARNING_PROMPT,
      output_config: { ...effort, format: zodOutputFormat(warningSchema) },
      messages: [{ role: "user", content: [image, { type: "text", text: "Transcribe the government warning." }] }],
    }),
  ]);
  const modelMs = Date.now() - started;

  for (const r of [fields, warning]) {
    if (r.stop_reason === "refusal") throw new Error("The model declined to process this image.");
    if (!r.parsed_output) throw new Error("The model did not return a usable transcription. Try again.");
  }

  return {
    extraction: { ...fields.parsed_output!, governmentWarning: warning.parsed_output! },
    modelMs,
  };
}
