// src/context/LiveTrainingContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type LiveTrainingMode = "strength" | "cardio";

export interface LiveTrainingSet {
  id: string;
  targetReps?: number;
  targetWeight?: number;
  doneReps?: number;
  doneWeight?: number;
  notes?: string;
  completed: boolean;
}

export interface LiveTrainingExercise {
  id: string;
  name: string;
  muscleGroups?: string[];
  sets: LiveTrainingSet[];
}

export interface LiveTrainingSession {
  id: string;
  title: string;
  mode: LiveTrainingMode;
  startedAt: string; // ISO-String
  plannedDurationMinutes?: number;
  exercises: LiveTrainingExercise[];
  currentExerciseIndex: number;
  isPaused: boolean;
  pauseUntil?: string | null; // ISO-String, falls Countdown läuft
}

export interface StartLiveTrainingPayload {
  title: string;
  mode: LiveTrainingMode;
  plannedDurationMinutes?: number;
  exercises: {
    name: string;
    muscleGroups?: string[];
    sets?: {
      targetReps?: number;
      targetWeight?: number;
      notes?: string;
    }[];
  }[];
}

interface LiveTrainingContextValue {
  session: LiveTrainingSession | null;
  isActive: boolean;

  startSession: (payload: StartLiveTrainingPayload) => void;
  finishSession: (options?: { saveToHistory?: boolean }) => void;

  // Navigation
  currentExercise: LiveTrainingExercise | null;
  goToExercise: (index: number) => void;
  nextExercise: () => void;
  prevExercise: () => void;

  // Sets
  updateSet: (
    exerciseId: string,
    setId: string,
    patch: Partial<Pick<LiveTrainingSet, "doneReps" | "doneWeight" | "notes">>
  ) => void;
  toggleSetCompleted: (exerciseId: string, setId: string) => void;
  addSetToExercise: (
    exerciseId: string,
    initial?: Partial<LiveTrainingSet>
  ) => void;
  removeSetFromExercise: (exerciseId: string, setId: string) => void;

  // Pause / Timer
  togglePause: (pauseSeconds?: number) => void;
}

const LiveTrainingContext = createContext<LiveTrainingContextValue | null>(
  null
);

interface LiveTrainingProviderProps {
  children: React.ReactNode;
  /**
   * Optional: wird aufgerufen, wenn ein Training beendet wird.
   * trainingHistory kann sich hier einklinken und die Session speichern.
   */
  onSessionFinish?: (
    session: LiveTrainingSession,
    options: { saveToHistory: boolean }
  ) => void;
}

function generateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return String(Date.now()) + "_" + Math.random().toString(36).slice(2, 8);
}

export const LiveTrainingProvider: React.FC<LiveTrainingProviderProps> = ({
  children,
  onSessionFinish,
}) => {
  const [session, setSession] = useState<LiveTrainingSession | null>(null);

  const isActive = !!session;

  const startSession = useCallback((payload: StartLiveTrainingPayload) => {
    const now = new Date();

    const exercises: LiveTrainingExercise[] = payload.exercises.map((ex) => ({
      id: generateId(),
      name: ex.name,
      muscleGroups: ex.muscleGroups,
      sets:
        ex.sets && ex.sets.length > 0
          ? ex.sets.map((s) => ({
              id: generateId(),
              targetReps: s.targetReps,
              targetWeight: s.targetWeight,
              notes: s.notes,
              completed: false,
            }))
          : [
              {
                id: generateId(),
                targetReps: 8,
                targetWeight: undefined,
                notes: "",
                completed: false,
              },
            ],
    }));

    const newSession: LiveTrainingSession = {
      id: generateId(),
      title: payload.title,
      mode: payload.mode,
      startedAt: now.toISOString(),
      plannedDurationMinutes: payload.plannedDurationMinutes,
      exercises,
      currentExerciseIndex: 0,
      isPaused: false,
      pauseUntil: null,
    };

    setSession(newSession);
  }, []);

  const finishSession = useCallback(
    (options?: { saveToHistory?: boolean }) => {
      if (!session) return;
      const saveToHistory = options?.saveToHistory ?? true;

      if (onSessionFinish) {
        onSessionFinish(session, { saveToHistory });
      }

      setSession(null);
    },
    [session, onSessionFinish]
  );

  const currentExercise = useMemo(() => {
    if (!session) return null;
    return session.exercises[session.currentExerciseIndex] ?? null;
  }, [session]);

  const goToExercise = useCallback((index: number) => {
    setSession((prev) => {
      if (!prev) return prev;
      const clampedIndex = Math.min(
        Math.max(index, 0),
        prev.exercises.length - 1
      );
      return {
        ...prev,
        currentExerciseIndex: clampedIndex,
      };
    });
  }, []);

  const nextExercise = useCallback(() => {
    setSession((prev) => {
      if (!prev) return prev;
      const nextIndex = Math.min(
        prev.currentExerciseIndex + 1,
        prev.exercises.length - 1
      );
      return {
        ...prev,
        currentExerciseIndex: nextIndex,
      };
    });
  }, []);

  const prevExercise = useCallback(() => {
    setSession((prev) => {
      if (!prev) return prev;
      const prevIndex = Math.max(prev.currentExerciseIndex - 1, 0);
      return {
        ...prev,
        currentExerciseIndex: prevIndex,
      };
    });
  }, []);

  const updateSet = useCallback(
    (
      exerciseId: string,
      setId: string,
      patch: Partial<Pick<LiveTrainingSet, "doneReps" | "doneWeight" | "notes">>
    ) => {
      setSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          exercises: prev.exercises.map((ex) => {
            if (ex.id !== exerciseId) return ex;
            return {
              ...ex,
              sets: ex.sets.map((set) =>
                set.id === setId ? { ...set, ...patch } : set
              ),
            };
          }),
        };
      });
    },
    []
  );

  const toggleSetCompleted = useCallback((exerciseId: string, setId: string) => {
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map((ex) => {
          if (ex.id !== exerciseId) return ex;
          return {
            ...ex,
            sets: ex.sets.map((set) =>
              set.id === setId
                ? { ...set, completed: !set.completed }
                : set
            ),
          };
        }),
      };
    });
  }, []);

  const addSetToExercise = useCallback(
    (exerciseId: string, initial?: Partial<LiveTrainingSet>) => {
      setSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          exercises: prev.exercises.map((ex) => {
            if (ex.id !== exerciseId) return ex;
            const newSet: LiveTrainingSet = {
              id: generateId(),
              targetReps: initial?.targetReps ?? 8,
              targetWeight: initial?.targetWeight,
              doneReps: initial?.doneReps,
              doneWeight: initial?.doneWeight,
              notes: initial?.notes ?? "",
              completed: false,
            };
            return {
              ...ex,
              sets: [...ex.sets, newSet],
            };
          }),
        };
      });
    },
    []
  );

  const removeSetFromExercise = useCallback(
    (exerciseId: string, setId: string) => {
      setSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          exercises: prev.exercises.map((ex) => {
            if (ex.id !== exerciseId) return ex;
            return {
              ...ex,
              sets: ex.sets.filter((set) => set.id !== setId),
            };
          }),
        };
      });
    },
    []
  );

  const togglePause = useCallback((pauseSeconds?: number) => {
    setSession((prev) => {
      if (!prev) return prev;

      // Wenn keine Zeit angegeben → nur Pause-Flag umschalten.
      if (!pauseSeconds || pauseSeconds <= 0) {
        return {
          ...prev,
          isPaused: !prev.isPaused,
          pauseUntil: null,
        };
      }

      if (prev.isPaused) {
        // Wenn bereits pausiert → Pause beenden
        return {
          ...prev,
          isPaused: false,
          pauseUntil: null,
        };
      }

      const now = new Date();
      const until = new Date(now.getTime() + pauseSeconds * 1000);

      return {
        ...prev,
        isPaused: true,
        pauseUntil: until.toISOString(),
      };
    });
  }, []);

  const value: LiveTrainingContextValue = useMemo(
    () => ({
      session,
      isActive,
      startSession,
      finishSession,
      currentExercise,
      goToExercise,
      nextExercise,
      prevExercise,
      updateSet,
      toggleSetCompleted,
      addSetToExercise,
      removeSetFromExercise,
      togglePause,
    }),
    [
      session,
      isActive,
      startSession,
      finishSession,
      currentExercise,
      goToExercise,
      nextExercise,
      prevExercise,
      updateSet,
      toggleSetCompleted,
      addSetToExercise,
      removeSetFromExercise,
      togglePause,
    ]
  );

  return (
    <LiveTrainingContext.Provider value={value}>
      {children}
    </LiveTrainingContext.Provider>
  );
};

export const useLiveTrainingContext = (): LiveTrainingContextValue => {
  const ctx = useContext(LiveTrainingContext);
  if (!ctx) {
    throw new Error(
      "useLiveTrainingContext muss innerhalb von <LiveTrainingProvider> verwendet werden."
    );
  }
  return ctx;
};
