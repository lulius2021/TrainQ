// src/utils/shareProfile.ts
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";

export function shortenId(id: string): string {
  const s = String(id || "").trim();
  if (s.length <= 10) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

export function buildProfileLinks(userId: string) {
  const id = String(userId || "").trim();
  const deepLink = `trainq://u/${id}`;
  const webLink = `https://trainq.app/u/${id}`;
  return { deepLink, webLink };
}

export async function copyText(text: string): Promise<boolean> {
  if (!text) return false;
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    return true;
  } catch {
    return false;
  }
}

export async function shareProfile(params: {
  userId: string;
  displayName?: string;
}): Promise<"shared" | "copied" | "failed"> {
  const { userId, displayName } = params;
  const { deepLink, webLink } = buildProfileLinks(userId);
  const shortId = shortenId(userId);
  const title = "TrainQ Profil";
  const text = `${displayName ?? "Mein TrainQ Profil"} – TrainQ ID: ${shortId}\n${webLink}`;

  if (Capacitor.isNativePlatform()) {
    await Share.share({ title, text, url: webLink });
    return "shared";
  }

  if (navigator.share) {
    await navigator.share({ title, text, url: webLink });
    return "shared";
  }

  const ok = await copyText(webLink);
  return ok ? "copied" : "failed";
}
