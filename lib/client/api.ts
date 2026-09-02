import type { Application, VerificationResult } from "../types";
import { prepareImage } from "./image";

export async function verifyLabel(
  image: File,
  application: Application,
  signal?: AbortSignal,
): Promise<VerificationResult> {
  const form = new FormData();
  form.append("image", await prepareImage(image));
  form.append("application", JSON.stringify(application));

  const response = await fetch("/api/verify", { method: "POST", body: form, signal });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) window.location.assign(new URL("/login", window.location.origin));
    throw new Error(body.error || `Request failed (${response.status}).`);
  }
  return body as VerificationResult;
}
