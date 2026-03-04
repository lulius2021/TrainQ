// src/hooks/useAdaptiveWorkout.ts
/**
 * React Hook for Adaptive Workout Generation
 * 
 * Integrates the adaptive engine with React components
 * Provides loading states, error handling, and caching
 */

import { useState, useCallback } from "react";
import {
    calculateAdaptiveWorkout,
    recordExerciseFailure,
    recordExerciseSuccess,
    type AdaptiveConfig,
    type AdaptiveResult
} from "../features/adaptive/adaptiveEngine";
import type { LiveExercise } from "../types/training";

export interface UseAdaptiveWorkoutResult {
    /** Generate an adaptive workout */
    generateWorkout: (config: AdaptiveConfig) => Promise<AdaptiveResult | null>;

    /** Current adaptive result */
    result: AdaptiveResult | null;

    /** Loading state */
    loading: boolean;

    /** Error state */
    error: string | null;

    /** Record exercise completion status */
    recordCompletion: (exerciseId: string, success: boolean) => void;

    /** Clear current result */
    clear: () => void;
}

export function useAdaptiveWorkout(): UseAdaptiveWorkoutResult {
    const [result, setResult] = useState<AdaptiveResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const generateWorkout = useCallback(async (config: AdaptiveConfig) => {
        setLoading(true);
        setError(null);

        try {
            const adaptiveResult = await calculateAdaptiveWorkout(config);
            setResult(adaptiveResult);
            return adaptiveResult;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to generate adaptive workout";
            setError(errorMessage);
            if (import.meta.env.DEV) console.error("[useAdaptiveWorkout] Error:", err);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const recordCompletion = useCallback((exerciseId: string, success: boolean) => {
        if (success) {
            recordExerciseSuccess(exerciseId);
        } else {
            recordExerciseFailure(exerciseId);
        }
    }, []);

    const clear = useCallback(() => {
        setResult(null);
        setError(null);
    }, []);

    return {
        generateWorkout,
        result,
        loading,
        error,
        recordCompletion,
        clear
    };
}
