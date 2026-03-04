// src/services/challengeService.ts
import { getSupabaseClient } from "../lib/supabaseClient";
import type { ServerChallenge, ServerParticipation, ServerProGrant, ChallengeGoalType } from "../types/challenge";

function client() {
  const c = getSupabaseClient();
  if (!c) throw new Error("No Supabase client");
  return c;
}

function mapRowToServerChallenge(row: Record<string, unknown>, lang: string): ServerChallenge {
  const titleKey = lang === "de" ? "title_de" : "title_en";
  const descKey = lang === "de" ? "description_de" : "description_en";
  return {
    id: row.id as string,
    slug: row.slug as string,
    title: (row[titleKey] || row.title_en) as string,
    description: (row[descKey] || row.description_en) as string,
    emoji: row.emoji as string,
    goal: {
      type: row.goal_type as ChallengeGoalType,
      target: Number(row.goal_target),
      sportFilter: (row.goal_sport_filter as string) || undefined,
    },
    durationDays: row.duration_days as number,
    reward: row.reward_type === "pro_days" && row.reward_days
      ? { type: "pro_days", days: row.reward_days as number }
      : undefined,
    activeFrom: row.active_from as string,
    activeUntil: row.active_until as string,
    maxWinners: row.max_winners as number,
    currentWinners: row.current_winners as number,
  };
}

function mapRowToParticipation(row: Record<string, unknown>): ServerParticipation {
  return {
    id: row.id as string,
    challengeId: row.challenge_id as string,
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    progressCurrent: Number(row.progress_current),
    progressTarget: Number(row.progress_target),
    completed: row.completed as boolean,
    completedAt: row.completed_at as string | undefined,
    rewardEligible: row.reward_eligible as boolean,
    rewardClaimed: row.reward_claimed as boolean,
    rewardExpiresAt: row.reward_expires_at as string | undefined,
  };
}

function mapRowToGrant(row: Record<string, unknown>): ServerProGrant {
  return {
    id: row.id as string,
    grantedAt: row.granted_at as string,
    expiresAt: row.expires_at as string,
    sourceChallengeId: row.source_challenge_id as string,
    isActive: row.is_active as boolean,
  };
}

export async function fetchMonthlyChallenges(lang = "de"): Promise<ServerChallenge[]> {
  try {
    const c = client();
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await c
      .from("monthly_challenges")
      .select("*")
      .eq("is_active", true)
      .lte("active_from", today)
      .gte("active_until", today)
      .order("active_from", { ascending: false });

    if (error) throw error;
    return (data || []).map((row: Record<string, unknown>) => mapRowToServerChallenge(row, lang));
  } catch {
    return [];
  }
}

export async function fetchMyParticipations(): Promise<ServerParticipation[]> {
  try {
    const c = client();
    const { data, error } = await c
      .from("challenge_participations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []).map(mapRowToParticipation);
  } catch {
    return [];
  }
}

export async function fetchMyUnclaimedRewards(): Promise<ServerParticipation[]> {
  try {
    const c = client();
    const { data, error } = await c
      .from("challenge_participations")
      .select("*")
      .eq("completed", true)
      .eq("reward_eligible", true)
      .eq("reward_claimed", false)
      .order("completed_at", { ascending: false });

    if (error) throw error;
    return (data || []).map(mapRowToParticipation);
  } catch {
    return [];
  }
}

export async function fetchMyActiveProGrants(): Promise<ServerProGrant[]> {
  try {
    const c = client();
    const { data, error } = await c
      .from("challenge_pro_grants")
      .select("*")
      .eq("is_active", true)
      .gte("expires_at", new Date().toISOString());

    if (error) throw error;
    return (data || []).map(mapRowToGrant);
  } catch {
    return [];
  }
}

export async function joinServerChallenge(challengeId: string): Promise<{ ok: boolean; participation_id?: string; error?: string }> {
  try {
    const c = client();
    const { data: session } = await c.auth.getSession();
    const token = session?.session?.access_token;
    if (!token) return { ok: false, error: "not_authenticated" };

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/challenge-join`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ challenge_id: challengeId }),
    });
    return await res.json();
  } catch {
    return { ok: false, error: "network_error" };
  }
}

export async function submitProgress(participationId: string, current: number): Promise<{ ok: boolean; completed?: boolean; error?: string }> {
  try {
    const c = client();
    const { data: session } = await c.auth.getSession();
    const token = session?.session?.access_token;
    if (!token) return { ok: false, error: "not_authenticated" };

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/challenge-progress`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ participation_id: participationId, progress_current: current }),
    });
    return await res.json();
  } catch {
    return { ok: false, error: "network_error" };
  }
}

export async function claimServerReward(participationId: string): Promise<{ ok: boolean; grant_id?: string; expires_at?: string; error?: string }> {
  try {
    const c = client();
    const { data: session } = await c.auth.getSession();
    const token = session?.session?.access_token;
    if (!token) return { ok: false, error: "not_authenticated" };

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/challenge-claim`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ participation_id: participationId }),
    });
    return await res.json();
  } catch {
    return { ok: false, error: "network_error" };
  }
}
