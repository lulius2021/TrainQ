// src/services/appleLocalAuth.ts
import { Capacitor } from "@capacitor/core";

type SignInWithAppleOptions = {
  clientId: string;
  redirectURI: string;
  scopes: string;
  state: string;
  nonce: string;
};

type SignInWithAppleResponse = {
  response?: {
    user?: string;
    email?: string;
    givenName?: string;
    familyName?: string;
    identityToken?: string;
    authorizationCode?: string;
    state?: string;
  };
};

export type AppleAuthPayload = {
  appleSub: string; // response.user
  email?: string; // oft nur beim ersten Consent
  givenName?: string;
  familyName?: string;
  identityToken?: string;
  authorizationCode?: string;
  state?: string;
  nonce?: string;
};

function env(key: string): string {
  // Vite env (zur Build-/Dev-Server-Zeit eingebacken)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v = (import.meta as any)?.env?.[key];
  return String(v ?? "").trim();
}

export function isNativeIOS(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
  } catch {
    return false;
  }
}

function rand(prefix = "t") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeAppleError(e: any): string {
  const msg = String(e?.message ?? e ?? "Apple Login fehlgeschlagen.");
  const low = msg.toLowerCase();
  if (low.includes("canceled") || low.includes("cancelled") || low.includes("abgebrochen")) return "Abgebrochen.";
  return msg;
}

export async function signInWithApple(): Promise<AppleAuthPayload> {
  if (typeof window === "undefined") throw new Error("Apple Login ist hier nicht verfügbar.");

  if (!isNativeIOS()) {
    // Du kannst hier später einen Web-Flow ergänzen. Für jetzt: klarer Fehler.
    throw new Error("Apple Login funktioniert aktuell nur in der iOS-App (native).");
  }

  const clientId = env("VITE_APPLE_CLIENT_ID");
  const redirectURI = env("VITE_APPLE_REDIRECT_URI");

  if (!clientId) throw new Error("Apple Login: VITE_APPLE_CLIENT_ID fehlt.");
  if (!redirectURI) throw new Error("Apple Login: VITE_APPLE_REDIRECT_URI fehlt.");

  // WICHTIG: Bei dir ist scopes laut typings ein STRING, nicht string[]
  const options: SignInWithAppleOptions = {
    clientId,
    redirectURI,
    scopes: "email name",
    state: rand("state"),
    nonce: rand("nonce"),
  };

  try {
    const plugin = (window as any)?.Capacitor?.Plugins?.SignInWithApple;
    if (!plugin?.authorize) {
      throw new Error("Apple Login Plugin ist nicht verfügbar.");
    }
    const result: SignInWithAppleResponse = await plugin.authorize(options);
    const r: any = result?.response;

    const appleSub = String(r?.user ?? "").trim();
    if (!appleSub) throw new Error("Apple Login: Keine User-ID erhalten.");

    return {
      appleSub,
      email: r?.email ?? undefined,
      givenName: r?.givenName ?? undefined,
      familyName: r?.familyName ?? undefined,
      identityToken: r?.identityToken ?? undefined,
      authorizationCode: r?.authorizationCode ?? undefined,
      state: r?.state ?? options.state,
      nonce: options.nonce,
    };
  } catch (e: any) {
    throw new Error(normalizeAppleError(e));
  }
}
