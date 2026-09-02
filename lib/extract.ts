/**
 * Stage one: ask the vision model to transcribe the label into a fixed JSON
 * shape. It reads; it does not judge. Matching happens in compare.ts.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { extractionSchema, type Extraction } from "./types";

export const MODEL = process.env.LABEL_MODEL || "claude-sonnet-5";

export type ImageMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

const SYSTEM_PROMPT = `You transcribe alcohol beverage labels for a TTB compliance reviewer.

Read the label image and fill in every field with the text exactly as printed. Do not correct spelling, expand abbreviations, or change capitalisation. If something is not on the label, use null. Give a confidence from 0 to 1 for how clearly you could read each value.

Fields:
- brandName: the brand name, usually the most prominent text.
- classType: the class or type designation, e.g. "Kentucky Straight Bourbon Whiskey", "Cabernet Sauvignon", "India Pale Ale", "Table Wine".
- alcoholContent: the alcohol statement as printed, e.g. "45% Alc./Vol. (90 Proof)" or "12.5% ALC. BY VOL.".
- netContents: the volume as printed, e.g. "750 mL", "12 FL. OZ.".
- bottlerNameAddress: the "bottled by" / "distilled by" / "produced by" / "imported by" line with the name and address, as printed.
- countryOfOrigin: e.g. "Product of France". Null for domestic products with no such statement.

governmentWarning:
- present: whether a government health warning statement appears at all.
- verbatimText: the complete warning statement copied exactly, including the "GOVERNMENT WARNING:" heading, preserving the original capitalisation of every word. This matters: if the heading is printed as "Government Warning" in mixed case, copy it that way.
- headingAllCaps: whether the words "GOVERNMENT WARNING" are printed entirely in capital letters.
- headingBold: whether that heading looks bolder than the sentence after it. Use null if you cannot tell.
- legible: whether the warning text is large and clear enough to read with confidence.

imageQuality:
- readable: false only if the image is so poor that most of the label cannot be read.
- issues: any of glare, angle, blur, low_resolution, partial (label cut off), dark.`;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) client = new Anthropic({ maxRetries: 1, timeout: 45_000 });
  return client;
}

export async function extractLabel(
  imageBase64: string,
  mediaType: ImageMediaType,
): Promise<{ extraction: Extraction; modelMs: number }> {
  const started = Date.now();
  const response = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    output_config: {
      effort: "low",
      format: zodOutputFormat(extractionSchema),
    },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text", text: "Transcribe this label." },
        ],
      },
    ],
  });
  const modelMs = Date.now() - started;

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to process this image.");
  }
  if (!response.parsed_output) {
    throw new Error("The model did not return a usable transcription. Try again.");
  }
  return { extraction: response.parsed_output, modelMs };
}
