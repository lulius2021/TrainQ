import { useState } from "react";

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
      className="space-y-4 rounded-xl border border-gray-700 bg-gray-800/50 p-4 text-left"
    >
      <h2 className="text-lg font-semibold mb-1">Workout erstellen</h2>

      {/* Sportart */}
      <div className="flex flex-col">
        <label className="text-xs text-gray-400 mb-1">Sportart</label>
        <select
          value={sportart}
          onChange={(e) => {
            const value = e.target.value as Sportart;
            setSportart(value);
            setSessionType(null);
          }}
          className="rounded-md bg-gray-900 border border-gray-700 px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="REST">REST</option>
          <option value="GYM">GYM</option>
          <option value="LAUFEN">LAUFEN</option>
          <option value="RADFAHREN">RADFAHREN</option>
          <option value="BOXEN">BOXEN</option>
        </select>
      </div>

      {/* Untertyp für Laufen / Rad */}
      {sessionOptions.length > 0 && (
        <div className="flex flex-col">
          <label className="text-xs text-gray-400 mb-1">Typ</label>
          <select
            value={sessionType || ""}
            onChange={(e) =>
              setSessionType(
                (e.target.value as SessionType) || null
              )
            }
            className="rounded-md bg-gray-900 border border-gray-700 px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="">Bitte wählen…</option>
            <option value="LONGRUN">Longrun</option>
            <option value="INTERVALLE">Intervalle</option>
            <option value="RECOVERY">Recovery</option>
          </select>
        </div>
      )}

      {/* Titel */}
      <div className="flex flex-col">
        <label className="text-xs text-gray-400 mb-1">Titel (optional)</label>
        <input
          type="text"
          placeholder="z.B. Brust & Rücken, 15km Longrun…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-md bg-gray-900 border border-gray-700 px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Dynamische Felder für Laufen & Rad */}
      {(sportart === "LAUFEN" || sportart === "RADFAHREN") && (
        <div className="grid grid-cols-3 gap-3">
          <Field
            label="Dauer (min)"
            value={duration}
            onChange={setDuration}
          />
          <Field
            label="Distanz (km)"
            value={distance}
            onChange={setDistance}
          />
          <Field
            label={
              sessionType === "RECOVERY"
                ? "Intensität (1–10)"
                : sportart === "LAUFEN"
                ? "Pace (min/km)"
                : "Ø-Tempo / Watt"
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
            <span className="text-sm font-semibold">Übungen</span>
            <button
              type="button"
              onClick={addExercise}
              className="text-xs px-2 py-1 rounded-md border border-gray-600 hover:bg-gray-700"
            >
              + Übung hinzufügen
            </button>
          </div>

          <div className="space-y-3">
            {exercises.map((ex) => (
              <div
                key={ex.id}
                className="rounded-lg border border-gray-700 bg-gray-900/60 p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    placeholder="z.B. Bankdrücken"
                    value={ex.name}
                    onChange={(e) =>
                      updateExerciseName(ex.id, e.target.value)
                    }
                    className="flex-1 rounded-md bg-gray-900 border border-gray-700 px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeExercise(ex.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Löschen
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
                        placeholder="Wdh."
                        value={s.reps}
                        onChange={(e) =>
                          updateSetField(
                            ex.id,
                            s.id,
                            "reps",
                            e.target.value
                          )
                        }
                        className="rounded-md bg-gray-900 border border-gray-700 px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                      />
                      <input
                        type="number"
                        placeholder="Gewicht (kg)"
                        value={s.weight}
                        onChange={(e) =>
                          updateSetField(
                            ex.id,
                            s.id,
                            "weight",
                            e.target.value
                          )
                        }
                        className="rounded-md bg-gray-900 border border-gray-700 px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          removeSetFromExercise(ex.id, s.id)
                        }
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => addSetToExercise(ex.id)}
                    className="text-xs px-2 py-1 rounded-md border border-gray-600 hover:bg-gray-700"
                  >
                    + Satz hinzufügen
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notizen */}
      <div className="flex flex-col">
        <label className="text-xs text-gray-400 mb-1">
          Notizen (optional)
        </label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="rounded-md bg-gray-900 border border-gray-700 px-2 py-1 text-sm focus:outline-none focus:border-blue-500 resize-none"
          placeholder="z.B. locker, Technikfokus, RPE 7/10…"
        />
      </div>

      <button
        type="submit"
        className="w-full rounded-md bg-blue-600 py-2 text-sm font-semibold hover:bg-blue-500 transition"
      >
        Workout zum Tag hinzufügen
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
        className="rounded-md bg-gray-900 border border-gray-700 px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
      />
    </div>
  );
}
