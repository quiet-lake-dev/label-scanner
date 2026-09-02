/**
 * Shared-password gate for the deployed prototype. One password for the whole
 * app, handed to reviewers out of band. Not a real auth system, and not meant
 * to be one; it just keeps the API bill from strangers.
 *
 * Runs in the proxy (edge runtime), so only Web Crypto is used.
 */

export const SESSION_COOKIE = "label_session";

export function appPassword(): string | undefined {
  const p = process.env.APP_PASSWORD;
  return p && p.length > 0 ? p : undefined;
}

/** The cookie holds a hash of the password, never the password itself. */
export async function sessionToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`label-scanner:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function isValidSession(cookieValue: string | undefined): Promise<boolean> {
  const password = appPassword();
  if (!password) return true; // no password configured: open (local dev)
  if (!cookieValue) return false;
  return cookieValue === (await sessionToken(password));
}
