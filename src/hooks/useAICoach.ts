// src/hooks/useAICoach.ts
// React Hook für den TrainQ AI Coach

import { useState, useCallback } from "react";
import {
  getWorkoutRecommendation,
  analyzeWorkout,
  generateMotivation,
  askAICoach,
  type AICoachUserContext,
  type AICoachResponse,
  type AICoachError,
} from "../services/AICoachService";

export interface UseAICoachState {
  response: AICoachResponse | null;
  loading: boolean;
  error: AICoachError | null;
}

export interface UseAICoachActions {
  fetchRecommendation: (ctx: AICoachUserContext) => Promise<void>;
  fetchWorkoutAnalysis: (ctx: AICoachUserContext, summary: string) => Promise<void>;
  fetchMotivation: (ctx: AICoachUserContext) => Promise<void>;
  ask: (ctx: AICoachUserContext, question: string) => Promise<void>;
  clearResponse: () => void;
  clearError: () => void;
}

export type UseAICoachReturn = UseAICoachState & UseAICoachActions;

function isAICoachError(e: unknown): e is AICoachError {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    "message" in e
  );
}

function toAICoachError(e: unknown): AICoachError {
  if (isAICoachError(e)) return e;
  return { code: "unknown", message: "An unexpected error occurred" };
}

export function useAICoach(): UseAICoachReturn {
  const [state, setState] = useState<UseAICoachState>({
    response: null,
    loading: false,
    error: null,
  });

  const startRequest = useCallback(() => {
    setState({ response: null, loading: true, error: null });
  }, []);

  const onSuccess = useCallback((res: AICoachResponse) => {
    setState({ response: res, loading: false, error: null });
  }, []);

  const onError = useCallback((e: unknown) => {
    setState({ response: null, loading: false, error: toAICoachError(e) });
  }, []);

  const fetchRecommendation = useCallback(
    async (ctx: AICoachUserContext) => {
      startRequest();
      try {
        const res = await getWorkoutRecommendation(ctx);
        onSuccess(res);
      } catch (e) {
        onError(e);
      }
    },
    [startRequest, onSuccess, onError]
  );

  const fetchWorkoutAnalysis = useCallback(
    async (ctx: AICoachUserContext, summary: string) => {
      startRequest();
      try {
        const res = await analyzeWorkout(ctx, summary);
        onSuccess(res);
      } catch (e) {
        onError(e);
      }
    },
    [startRequest, onSuccess, onError]
  );

  const fetchMotivation = useCallback(
    async (ctx: AICoachUserContext) => {
      startRequest();
      try {
        const res = await generateMotivation(ctx);
        onSuccess(res);
      } catch (e) {
        onError(e);
      }
    },
    [startRequest, onSuccess, onError]
  );

  const ask = useCallback(
    async (ctx: AICoachUserContext, question: string) => {
      startRequest();
      try {
        const res = await askAICoach(ctx, question);
        onSuccess(res);
      } catch (e) {
        onError(e);
      }
    },
    [startRequest, onSuccess, onError]
  );

  const clearResponse = useCallback(() => {
    setState((prev) => ({ ...prev, response: null }));
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    fetchRecommendation,
    fetchWorkoutAnalysis,
    fetchMotivation,
    ask,
    clearResponse,
    clearError,
  };
}
