// src/services/AICoachService.ts
// TrainQ AI Coach – kommuniziert ausschließlich über die Supabase Edge Function
// API Keys sind NIEMALS im Client-Code – nur als Supabase Secret serverseitig

import { getSupabaseClient } from "../lib/supabaseClient";

// ---------- Types ----------

export type AICoachAction =
  | "workout_recommendation"
  | "analyze_workout"
  | "generate_motivation"
  | "general_chat";

export interface AICoachUserContext {
  fitnessLevel?: string;
  goals?: string[];
  recentWorkouts?: Array<{ sport: string; durationMin: number; date: string }>;
  recoveryScore?: number;
  streak?: number;
}

export interface AICoachRequest {
  action: AICoachAction;
  userContext: AICoachUserContext;
  payload?: {
    workoutSummary?: string;
    question?: string;
  };
}

export interface AICoachResponse {
  text: string;
  action: AICoachAction;
}

export interface AICoachError {
  code: "unauthorized" | "rate_limit" | "not_configured" | "network" | "unknown";
  message: string;
}

// ---------- Internal ----------

const EDGE_FUNCTION = "ai-coach";

async function getAuthHeader(): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? `Bearer ${token}` : null;
}

function mapErrorCode(status: number, body: string): AICoachError["code"] {
  if (status === 401) return "unauthorized";
  if (status === 429) return "rate_limit";
  if (status === 503) return "not_configured";
  if (body.includes("network") || status === 0) return "network";
  return "unknown";
}

// ---------- Core method ----------

async function callAICoach(req: AICoachRequest): Promise<AICoachResponse> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw { code: "not_configured", message: "Supabase not available" } satisfies AICoachError;
  }

  const authHeader = await getAuthHeader();
  if (!authHeader) {
    throw { code: "unauthorized", message: "No active session" } satisfies AICoachError;
  }

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${EDGE_FUNCTION}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(req),
    });
  } catch {
    throw { code: "network", message: "Network request failed" } satisfies AICoachError;
  }

  if (!response.ok) {
    let body = "";
    try { body = await response.text(); } catch { /* ignore */ }
    throw {
      code: mapErrorCode(response.status, body),
      message: "AI Coach request failed",
    } satisfies AICoachError;
  }

  const data = await response.json() as AICoachResponse;
  return data;
}

// ---------- Public API ----------

export async function getWorkoutRecommendation(
  userContext: AICoachUserContext
): Promise<AICoachResponse> {
  return callAICoach({ action: "workout_recommendation", userContext });
}

export async function analyzeWorkout(
  userContext: AICoachUserContext,
  workoutSummary: string
): Promise<AICoachResponse> {
  return callAICoach({
    action: "analyze_workout",
    userContext,
    payload: { workoutSummary },
  });
}

export async function generateMotivation(
  userContext: AICoachUserContext
): Promise<AICoachResponse> {
  return callAICoach({ action: "generate_motivation", userContext });
}

export async function askAICoach(
  userContext: AICoachUserContext,
  question: string
): Promise<AICoachResponse> {
  return callAICoach({
    action: "general_chat",
    userContext,
    payload: { question },
  });
}
