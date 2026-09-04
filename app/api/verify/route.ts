import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { extractLabel, type ImageMediaType } from "@/lib/extract";
import { allowRequest } from "@/lib/ratelimit";
import { applicationSchema } from "@/lib/types";
import { buildResult } from "@/lib/verify";

export const maxDuration = 60;

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ACCEPTED: ImageMediaType[] = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function clientKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
}

export async function POST(request: Request) {
  const started = Date.now();

  if (!allowRequest(clientKey(request))) {
    return NextResponse.json({ error: "Too many requests. Wait a minute and try again." }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart form." }, { status: 400 });
  }

  const image = form.get("image");
  if (!(image instanceof File) || image.size === 0) {
    return NextResponse.json({ error: "Please choose a label image." }, { status: 400 });
  }
  if (!ACCEPTED.includes(image.type as ImageMediaType)) {
    return NextResponse.json({ error: "Image must be a JPEG, PNG, WebP, or GIF." }, { status: 400 });
  }
  if (image.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image is over 4 MB. Please use a smaller file." }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("application") ?? "{}"));
  } catch {
    return NextResponse.json({ error: "Application details were not valid JSON." }, { status: 400 });
  }
  const parsed = applicationSchema.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join(" ");
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "The server has no model API key configured." }, { status: 500 });
  }

  try {
    const base64 = Buffer.from(await image.arrayBuffer()).toString("base64");
    const { extraction, modelMs } = await extractLabel(base64, image.type as ImageMediaType, parsed.data.beverageType);
    const result = buildResult(parsed.data, extraction, { modelMs, totalMs: Date.now() - started });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: describeError(err) }, { status: statusFor(err) });
  }
}

function statusFor(err: unknown): number {
  if (err instanceof Anthropic.RateLimitError) return 429;
  if (err instanceof Anthropic.AuthenticationError) return 500;
  if (err instanceof Anthropic.APIConnectionTimeoutError) return 504;
  return 502;
}

function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "The server's model API key is missing or invalid.";
  if (err instanceof Anthropic.RateLimitError) return "The model service is busy. Try again in a moment.";
  if (err instanceof Anthropic.APIConnectionTimeoutError) return "The model took too long to respond. Try again.";
  if (err instanceof Anthropic.BadRequestError) return "The model service rejected the image. Try a different file.";
  if (err instanceof Anthropic.APIError) return "The model service returned an error. Try again.";
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}
