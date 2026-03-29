import { useState, useEffect, useCallback } from "react";
import { getActiveUserId } from "../utils/session";
import { computeDeloadScore } from "../services/DeloadScoreService";
import type { DeloadScoreResult } from "../types/wellness";

export function useDeloadScore(): { result: DeloadScoreResult | null; refresh: () => void } {
  const [result, setResult] = useState<DeloadScoreResult | null>(null);

  const refresh = useCallback(() => {
    try {
      const userId = getActiveUserId();
      setResult(computeDeloadScore(userId));
    } catch {
      setResult(null);
    }
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener("trainq:workoutHistoryUpdated", refresh);
    window.addEventListener("trainq:wellness_updated", refresh);
    return () => {
      window.removeEventListener("trainq:workoutHistoryUpdated", refresh);
      window.removeEventListener("trainq:wellness_updated", refresh);
    };
  }, [refresh]);

  return { result, refresh };
}
