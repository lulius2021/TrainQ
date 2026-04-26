import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { LiveWorkout } from '../types/training';

interface LiveTrainingStore {
    activeWorkout: LiveWorkout | null;
    activeExerciseIndex: number;

    startWorkout: (workout: LiveWorkout) => void;
    updateWorkout: (workout: LiveWorkout) => void;
    setExerciseIndex: (index: number) => void;
    cancelWorkout: () => void;
    finishWorkout: () => void;
}

const MAX_WORKOUT_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours — clear stale state faster

export const useLiveTrainingStore = create(
    persist<LiveTrainingStore>(
        (set, get) => ({
            activeWorkout: null,
            activeExerciseIndex: 0,

            startWorkout: (workout) => set({ activeWorkout: workout, activeExerciseIndex: 0 }),
            updateWorkout: (workout) => set({ activeWorkout: workout }),
            setExerciseIndex: (index) => set({ activeExerciseIndex: index }),
            cancelWorkout: () => set({ activeWorkout: null, activeExerciseIndex: 0 }),
            finishWorkout: () => set({ activeWorkout: null, activeExerciseIndex: 0 }),
        }),
        {
            name: 'trainq-active-workout-storage',
            storage: createJSONStorage(() => localStorage),
            onRehydrateStorage: () => (state: LiveTrainingStore | undefined, error) => {
                if (error || !state) return;
                try {
                    const workout = state.activeWorkout;
                    if (!workout) return;

                    // Clear if no valid startedAt (corrupt state)
                    if (!workout.startedAt) {
                        useLiveTrainingStore.setState({ activeWorkout: null, activeExerciseIndex: 0 });
                        return;
                    }

                    // Clear if older than MAX_WORKOUT_AGE_MS
                    const age = Date.now() - new Date(workout.startedAt).getTime();
                    if (age > MAX_WORKOUT_AGE_MS || isNaN(age)) {
                        useLiveTrainingStore.setState({ activeWorkout: null, activeExerciseIndex: 0 });
                    }
                } catch {
                    useLiveTrainingStore.setState({ activeWorkout: null, activeExerciseIndex: 0 });
                }
            },
        }
    )
);
