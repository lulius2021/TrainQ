import { useState } from "react";
import { useI18n } from "../i18n/useI18n";

type Sportart = "REST" | "GYM" | "LAUFEN" | "RADFAHREN" | "BOXEN";
type SessionType = "INTERVALLE" | "LONGRUN" | "RECOVERY" | null;

interface SetData {
  id: number;
  reps: string;
  weight: string;
}

interface Exercise {
  id: number;
  name: string;
  sets: SetData[];
}

interface Workout {
  id: number;
  sportart: Sportart;
  sessionType?: SessionType;
  title?: string;
  notes?: string;
  duration?: string;
  distance?: string;
  paceOrIntensity?: string;
  exercises?: Exercise[]; // nur für Gym
}

interface WorkoutEditorProps {
  onAdd: (workout: Workout) => void;
}

export default function WorkoutEditor({ onAdd }: WorkoutEditorProps) {
  const { t } = useI18n();
  const [sportart, setSportart] = useState<Sportart>("GYM");
  const [sessionType, setSessionType] = useState<SessionType>(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  // Lauf / Rad
  const [duration, setDuration] = useState("");
  const [distance, setDistance] = useState("");
  const [paceOrIntensity, setPaceOrIntensity] = useState("");

  // Gym: Übungen + Sätze
  const [exercises, setExercises] = useState<Exercise[]>([
    {
      id: Date.now(),
      name: "",
      sets: [{ id: Date.now() + 1, reps: "", weight: "" }],
    },
  ]);

  // Hilfsfunktionen für Gym
  const addExercise = () => {
    setExercises((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        name: "",
        sets: [{ id: Date.now() + Math.random(), reps: "", weight: "" }],
      },
    ]);
  };

  const removeExercise = (id: number) => {
    setExercises((prev) => prev.filter((ex) => ex.id !== id));
  };

  const updateExerciseName = (id: number, name: string) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.id === id ? { ...ex, name } : ex))
    );
  };

  const addSetToExercise = (exerciseId: number) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? {
            ...ex,
            sets: [
              ...ex.sets,
              { id: Date.now() + Math.random(), reps: "", weight: "" },
            ],
          }
          : ex
      )
    );
  };

  const removeSetFromExercise = (exerciseId: number, setId: number) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? { ...ex, sets: ex.sets.filter((s) => s.id !== setId) }
          : ex
      )
    );
  };

  const updateSetField = (
    exerciseId: number,
    setId: number,
    field: "reps" | "weight",
    value: string
  ) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? {
            ...ex,
            sets: ex.sets.map((s) =>
              s.id === setId ? { ...s, [field]: value } : s
            ),
          }
          : ex
      )
    );
  };

  // Session-Type-Optionen für Laufen / Rad
  const sessionOptions: SessionType[] =
    sportart === "LAUFEN" || sportart === "RADFAHREN"
      ? ["LONGRUN", "INTERVALLE", "RECOVERY"]
      : [];

  const handleSubmit = (e: any) => {
    e.preventDefault();

    if (!sportart) return;

    const workout: Workout = {
      id: Date.now(),
      sportart,
      sessionType,
      title: title || undefined,
      notes: notes || undefined,
      duration: duration || undefined,
      distance: distance || undefined,
      paceOrIntensity: paceOrIntensity || undefined,
      exercises: sportart === "GYM" ? exercises : undefined,
    };

    onAdd(workout);

    // Reset
    setTitle("");
    setNotes("");
    setDuration("");
    setDistance("");
    setPaceOrIntensity("");
    setSessionType(null);
    if (sportart === "GYM") {
      setExercises([
        {
          id: Date.now(),
          name: "",
          sets: [{ id: Date.now() + 1, reps: "", weight: "" }],
        },
      ]);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] backdrop-blur-xl p-4 text-left"
    >
      <h2 className="text-lg font-semibold mb-1">{t("workoutEditor.title")}</h2>

      {/* Titel */}
      <div className="flex flex-col">
        <label className="text-xs text-gray-400 mb-1">{t("workoutEditor.titleOptional")}</label>
        <input
          type="text"
          placeholder={t("workoutEditor.titlePlaceholder")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-md bg-[var(--surface2)] border border-[var(--border)] px-2 py-1 text-sm focus:outline-none focus:border-[var(--primary)] text-[var(--text)]"
        />
      </div>

      {/* Sportart */}
      <div className="flex flex-col">
        <label className="text-xs text-gray-400 mb-1">{t("workoutEditor.sport")}</label>
        <select
          value={sportart}
          onChange={(e) => {
            const value = e.target.value as Sportart;
            setSportart(value);
            setSessionType(null);
          }}
          className="rounded-md bg-[var(--surface2)] border border-[var(--border)] px-2 py-1 text-sm focus:outline-none focus:border-[var(--primary)] text-[var(--text)]"
        >
          <option value="REST">{t("training.sport.rest")}</option>
          <option value="GYM">{t("training.sport.gym")}</option>
          <option value="LAUFEN">{t("training.sport.run")}</option>
          <option value="RADFAHREN">{t("training.sport.bike")}</option>
          <option value="BOXEN">{t("training.sport.boxing")}</option>
        </select>
      </div>

      {/* Untertyp für Laufen / Rad */}
      {sessionOptions.length > 0 && (
        <div className="flex flex-col">
          <label className="text-xs text-gray-400 mb-1">{t("workoutEditor.sessionType")}</label>
          <select
            value={sessionType || ""}
            onChange={(e) =>
              setSessionType(
                (e.target.value as SessionType) || null
              )
            }
            className="rounded-md bg-[var(--surface2)] border border-[var(--border)] px-2 py-1 text-sm focus:outline-none focus:border-[var(--primary)] text-[var(--text)]"
          >
            <option value="">{t("workoutEditor.selectPlaceholder")}</option>
            <option value="LONGRUN">{t("workoutEditor.longrun")}</option>
            <option value="INTERVALLE">{t("workoutEditor.intervals")}</option>
            <option value="RECOVERY">{t("workoutEditor.recovery")}</option>
          </select>
        </div>
      )}

      {/* Dynamische Felder für Laufen & Rad */}
      {(sportart === "LAUFEN" || sportart === "RADFAHREN") && (
        <div className="grid grid-cols-3 gap-3">
          <Field label={t("workoutEditor.duration")} value={duration} onChange={setDuration} />
          <Field label={t("workoutEditor.distance")} value={distance} onChange={setDistance} />
          <Field
            label={
              sessionType === "RECOVERY"
                ? t("workoutEditor.intensity")
                : sportart === "LAUFEN"
                  ? t("workoutEditor.pace")
                  : t("workoutEditor.avgTempo")
            }
            value={paceOrIntensity}
            onChange={setPaceOrIntensity}
          />
        </div>
      )}

      {/* GYM: Übungen + Sätze */}
      {sportart === "GYM" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{t("workoutEditor.exercises")}</span>
            <button
              type="button"
              onClick={addExercise}
              className="text-xs px-2 py-1 rounded-md border border-[var(--border)] hover:bg-[var(--surface2)]"
            >
              {t("workoutEditor.addExercise")}
            </button>
          </div>

          <div className="space-y-3">
            {exercises.map((ex) => (
              <div
                key={ex.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface2)] p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    placeholder={t("workoutEditor.exercisePlaceholder")}
                    value={ex.name}
                    onChange={(e) =>
                      updateExerciseName(ex.id, e.target.value)
                    }
                    className="flex-1 rounded-md bg-[var(--surface2)] border border-[var(--border)] px-2 py-1 text-sm focus:outline-none focus:border-[var(--primary)]"
                  />
                  <button
                    type="button"
                    onClick={() => removeExercise(ex.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    {t("common.delete")}
                  </button>
                </div>

                <div className="space-y-2">
                  {ex.sets.map((s) => (
                    <div
                      key={s.id}
                      className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center"
                    >
                      <input
                        type="number"
                        placeholder={t("workoutEditor.reps")}
                        value={s.reps}
                        onChange={(e) =>
                          updateSetField(
                            ex.id,
                            s.id,
                            "reps",
                            e.target.value
                          )
                        }
                        className="rounded-md bg-[var(--surface2)] border border-[var(--border)] px-2 py-1 text-sm focus:outline-none focus:border-[var(--primary)]"
                      />
                      <input
                        type="number"
                        placeholder={t("workoutEditor.weightKg")}
                        value={s.weight}
                        onChange={(e) =>
                          updateSetField(
                            ex.id,
                            s.id,
                            "weight",
                            e.target.value
                          )
                        }
                        className="rounded-md bg-[var(--surface2)] border border-[var(--border)] px-2 py-1 text-sm focus:outline-none focus:border-[var(--primary)]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          removeSetFromExercise(ex.id, s.id)
                        }
                        className="text-xs text-red-400 hover:text-red-300"
                        aria-label={t("workoutEditor.removeSet")}
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => addSetToExercise(ex.id)}
                    className="text-xs px-2 py-1 rounded-md border border-[var(--border)] hover:bg-[var(--surface2)]"
                  >
                    {t("workoutEditor.addSet")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notizen */}
      <div className="flex flex-col">
        <label className="text-xs text-gray-400 mb-1">{t("workoutEditor.notesOptional")}</label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="rounded-md bg-[var(--surface2)] border border-[var(--border)] px-2 py-1 text-sm focus:outline-none focus:border-[var(--primary)] resize-none"
          placeholder={t("workoutEditor.notesPlaceholder")}
        />
      </div>

      <button
        type="submit"
        className="w-full rounded-md bg-[var(--primary)] py-2 text-sm font-semibold text-white hover:opacity-90 transition"
      >
        {t("workoutEditor.addToDay")}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col">
      <label className="text-xs text-gray-400 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md bg-[var(--surface2)] border border-[var(--border)] px-2 py-1 text-sm focus:outline-none focus:border-[var(--primary)]"
      />
    </div>
  );
}
