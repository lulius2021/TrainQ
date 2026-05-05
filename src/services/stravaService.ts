// src/services/stravaService.ts
// Strava OAuth + Activity Push Integration

import { Browser } from "@capacitor/browser";
import { App } from "@capacitor/app";

const STRAVA_CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = import.meta.env.VITE_STRAVA_CLIENT_SECRET;
const STRAVA_REDIRECT_URI = "trainq://strava-callback";

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
  // 60s buffer
  return Date.now() / 1000 >= Number(expiresAt) - 60;
}

// ── OAuth Exchange ──

async function exchangeCode(code: string): Promise<void> {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Strava token exchange failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  storeTokens(data);
}

// ── Token Refresh ──

async function refreshAccessToken(): Promise<string> {
  const refreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken);
  if (!refreshToken) throw new Error("No Strava refresh token");

  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Strava token refresh failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  storeTokens(data);
  return data.access_token;
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
        if (!url.startsWith(STRAVA_REDIRECT_URI)) return;

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
    startDate: string; // ISO
    durationSeconds: number;
    description?: string;
    sportType?: string;
  }): Promise<{ id: number }> {
    const token = await this.getValidToken();

    const res = await fetch("https://www.strava.com/api/v3/activities", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: params.name,
        sport_type: params.sportType || "WeightTraining",
        start_date_local: params.startDate,
        elapsed_time: params.durationSeconds,
        description: params.description || "",
        type: "WeightTraining",
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Strava push failed (${res.status}): ${err}`);
    }

    return res.json();
  },

  /** Disconnect Strava */
  disconnect(): void {
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  },
};
