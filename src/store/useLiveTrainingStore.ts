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
            name: 'trainq-active-workout-storage', // Unique name in localStorage
            storage: createJSONStorage(() => localStorage),
        }
    )
);
