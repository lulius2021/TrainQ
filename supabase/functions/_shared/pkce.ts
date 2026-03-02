// PKCE (Proof Key for Code Exchange) helpers for OAuth2

const encoder = new TextEncoder();

/** Generate a random code_verifier (43-128 chars, URL-safe). */
export function generateCodeVerifier(length = 64): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64url(bytes).slice(0, length);
}

/** Generate a random state parameter for CSRF protection. */
export function generateState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

/** Compute S256 code_challenge from code_verifier: base64url(sha256(verifier)). */
export async function computeCodeChallenge(verifier: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(verifier));
  return base64url(new Uint8Array(hash));
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
