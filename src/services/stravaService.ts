// src/services/stravaService.ts
// Strava OAuth + Activity Push Integration
// Token exchange & refresh happen server-side via Edge Function (secret never in frontend).

import { Browser } from "@capacitor/browser";
import { App } from "@capacitor/app";
import { getSupabaseClient } from "../lib/supabaseClient";

const STRAVA_CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID;
const STRAVA_REDIRECT_URI = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/strava-callback`;

const STORAGE_KEYS = {
  accessToken: "trainq_strava_access_token",
  refreshToken: "trainq_strava_refresh_token",
  expiresAt: "trainq_strava_expires_at",
  athleteName: "trainq_strava_athlete_name",
  athleteId: "trainq_strava_athlete_id",
} as const;

// ── Helpers ──

function storeTokens(data: {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { firstname?: string; lastname?: string; id?: number };
}) {
  localStorage.setItem(STORAGE_KEYS.accessToken, data.access_token);
  localStorage.setItem(STORAGE_KEYS.refreshToken, data.refresh_token);
  localStorage.setItem(STORAGE_KEYS.expiresAt, String(data.expires_at));
  if (data.athlete) {
    const name = [data.athlete.firstname, data.athlete.lastname].filter(Boolean).join(" ");
    localStorage.setItem(STORAGE_KEYS.athleteName, name);
    if (data.athlete.id) localStorage.setItem(STORAGE_KEYS.athleteId, String(data.athlete.id));
  }
}

function isTokenExpired(): boolean {
  const expiresAt = localStorage.getItem(STORAGE_KEYS.expiresAt);
  if (!expiresAt) return true;
  return Date.now() / 1000 >= Number(expiresAt) - 60;
}

/** Call the server-side strava-token Edge Function */
async function callTokenEndpoint(body: Record<string, string>): Promise<Record<string, unknown>> {
  const supabase = getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/strava-token`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Strava token request failed (${res.status}): ${err}`);
  }

  return res.json();
}

// ── OAuth Exchange (server-side) ──

async function exchangeCode(code: string): Promise<void> {
  const data = await callTokenEndpoint({
    grant_type: "authorization_code",
    code,
  });
  storeTokens(data as Parameters<typeof storeTokens>[0]);
}

// ── Token Refresh (server-side) ──

async function refreshAccessToken(): Promise<string> {
  const refreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken);
  if (!refreshToken) throw new Error("No Strava refresh token");

  const data = await callTokenEndpoint({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  storeTokens(data as Parameters<typeof storeTokens>[0]);
  return (data as { access_token: string }).access_token;
}

// ── Public API ──

export const stravaService = {
  /** Check if Strava is connected */
  isConnected(): boolean {
    return !!localStorage.getItem(STORAGE_KEYS.accessToken);
  },

  /** Get athlete display name */
  getAthleteName(): string | null {
    return localStorage.getItem(STORAGE_KEYS.athleteName);
  },

  /** Get a valid access token, refreshing if needed */
  async getValidToken(): Promise<string> {
    const token = localStorage.getItem(STORAGE_KEYS.accessToken);
    if (!token) throw new Error("Not connected to Strava");

    if (isTokenExpired()) {
      return refreshAccessToken();
    }
    return token;
  },

  /** Start OAuth connect flow */
  async connect(): Promise<void> {
    if (!STRAVA_CLIENT_ID) {
      throw new Error("VITE_STRAVA_CLIENT_ID not configured");
    }

    return new Promise<void>((resolve, reject) => {
      let resolved = false;

      const cleanup = () => {
        listenerHandle?.remove();
      };

      // Listen for deep link callback
      const listenerHandle = App.addListener("appUrlOpen", async ({ url }) => {
        if (resolved) return;
        if (!url.includes("strava-callback")) return;

        resolved = true;
        cleanup();

        try {
          await Browser.close();
        } catch { /* browser may already be closed */ }

        try {
          const urlObj = new URL(url);
          const code = urlObj.searchParams.get("code");
          const error = urlObj.searchParams.get("error");

          if (error || !code) {
            reject(new Error(error || "OAuth cancelled"));
            return;
          }

          await exchangeCode(code);
          resolve();
        } catch (e) {
          reject(e);
        }
      });

      // Open Strava OAuth page
      const authUrl =
        `https://www.strava.com/oauth/mobile/authorize` +
        `?client_id=${STRAVA_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(STRAVA_REDIRECT_URI)}` +
        `&response_type=code` +
        `&approval_prompt=auto` +
        `&scope=activity:write,read`;

      Browser.open({ url: authUrl }).catch((e) => {
        resolved = true;
        cleanup();
        reject(e);
      });

      // Timeout after 2 minutes
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          reject(new Error("OAuth timeout"));
        }
      }, 120_000);
    });
  },

  /** Push a completed workout to Strava */
  async pushWorkout(params: {
    name: string;
    startDate: string;
    durationSeconds: number;
    description?: string;
    sportType?: string;
    distanceMeters?: number;
  }): Promise<{ id: number }> {
    const token = await this.getValidToken();

    const typeMap: Record<string, string> = {
      WeightTraining: "WeightTraining",
      Run: "Run",
      Ride: "Ride",
      Workout: "Workout",
    };

    const body: Record<string, string | number> = {
      name: params.name,
      sport_type: params.sportType || "WeightTraining",
      type: typeMap[params.sportType || "WeightTraining"] || "Workout",
      start_date_local: params.startDate,
      elapsed_time: params.durationSeconds,
      description: params.description || "",
    };
    if (params.distanceMeters && params.distanceMeters > 0) {
      body.distance = params.distanceMeters;
    }

    const res = await fetch("https://www.strava.com/api/v3/activities", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Strava push failed (${res.status}): ${err}`);
    }

    return res.json();
  },

  /** Check if a sport should be exported to Strava */
  shouldExportSport(sport: string): boolean {
    const raw = localStorage.getItem("trainq_pref_strava_sports");
    if (!raw) return true;
    try {
      const allowed: string[] = JSON.parse(raw);
      return allowed.includes(sport.toLowerCase());
    } catch { return true; }
  },

  /** Get/Set which sports to export */
  getExportSports(): string[] {
    const raw = localStorage.getItem("trainq_pref_strava_sports");
    if (!raw) return ["gym", "laufen", "radfahren"];
    try { return JSON.parse(raw); } catch { return ["gym", "laufen", "radfahren"]; }
  },

  setExportSports(sports: string[]): void {
    localStorage.setItem("trainq_pref_strava_sports", JSON.stringify(sports));
  },

  /** Disconnect Strava */
  disconnect(): void {
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  },
};
