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

const MAX_WORKOUT_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

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
            onRehydrateStorage: () => (state: LiveTrainingStore | undefined) => {
                // Auto-clear zombie sessions older than 12 hours
                if (state?.activeWorkout?.startedAt) {
                    const age = Date.now() - new Date(state.activeWorkout.startedAt).getTime();
                    if (age > MAX_WORKOUT_AGE_MS) {
                        state.activeWorkout = null;
                        state.activeExerciseIndex = 0;
                    }
                }
            },
        }
    )
);
