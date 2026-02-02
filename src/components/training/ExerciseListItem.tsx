import type { LiveExercise, TrainingSet } from "../../types/training";
import type { ExerciseHistoryEntry } from "../../types/training";
import { useI18n } from "../../i18n/useI18n";

type Props = {
  exercise: LiveExercise;
  history?: ExerciseHistoryEntry | null;

  onChange: (patch: Partial<LiveExercise>) => void;
  onRemove: () => void;

  onAddSet: () => void;
  onRemoveSet: (setId: string) => void;
  onSetChange: (setId: string, patch: Partial<TrainingSet>) => void;
  onToggleSet: (setId: string) => void;
};

export default function ExerciseListItem({
  exercise,
  history,
  onChange,
  onRemove,
  onAddSet,
  onRemoveSet,
  onSetChange,
  onToggleSet,
}: Props) {
  const { t } = useI18n();
  return (
    <div className="rounded-2xl bg-black/30 border border-white/10 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <input
            value={exercise.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="w-full rounded-2xl bg-black/40 border border-white/15 px-3 py-2 text-sm"
            placeholder={t("training.exercise.placeholder")}
          />

          {/* History (grau) */}
          {history && (
            <div className="mt-1 text-[11px] text-white/40">
              {t("training.exercise.lastTime")}:{" "}
              {history.sets
                .map(
                  (s) =>
                    `${s.reps ?? "-"}×${s.weight ?? "-"}`
                )
                .join(" · ")}
            </div>
          )}
        </div>

        <button
          onClick={onRemove}
          className="rounded-2xl bg-red-500/10 border border-red-500/30 px-3 py-1 text-[11px] text-red-200"
        >
          {t("common.remove")}
        </button>
      </div>

      {/* Rest */}
      <div className="flex items-center gap-3">
        <span className="text-[11px] text-white/60">{t("training.exercise.rest")}</span>
        <select
          value={exercise.restSeconds}
          onChange={(e) =>
            onChange({ restSeconds: Number(e.target.value) })
          }
          className="rounded-2xl bg-black/40 border border-white/15 px-2 py-1 text-xs"
        >
          {[30, 45, 60, 90, 120, 180, 300].map((s) => (
            <option key={s} value={s}>
              {s} {t("training.units.secShort")}
            </option>
          ))}
        </select>
      </div>

      {/* Sets */}
      <div className="space-y-2">
        {exercise.sets.map((set, idx) => (
          <div
            key={set.id}
            className="flex items-center gap-2 rounded-2xl bg-black/40 border border-white/10 p-2"
          >
            <span className="w-6 text-xs text-white/40">
              {idx + 1}
            </span>

            <input
              value={set.weight ?? ""}
              onChange={(e) =>
                onSetChange(set.id, {
                  weight:
                    e.target.value === ""
                      ? undefined
                      : Number(e.target.value),
                })
              }
              placeholder={t("training.units.kg")}
              className="w-16 rounded bg-black/40 border border-white/15 px-2 py-1 text-xs"
            />

            <input
              value={set.reps ?? ""}
              onChange={(e) =>
                onSetChange(set.id, {
                  reps:
                    e.target.value === ""
                      ? undefined
                      : Number(e.target.value),
                })
              }
              placeholder={t("training.units.reps")}
              className="w-16 rounded bg-black/40 border border-white/15 px-2 py-1 text-xs"
            />

            <button
              onClick={() => onToggleSet(set.id)}
              className={`ml-auto rounded px-2 py-1 text-xs ${
                set.completed
                  ? "bg-sky-500 text-black"
                  : "bg-black/40 border border-white/20"
              }`}
            >
              ✓
            </button>

            <button
              onClick={() => onRemoveSet(set.id)}
              className="text-xs text-red-300"
            >
              ✕
            </button>
          </div>
        ))}

        <button
          onClick={onAddSet}
          className="text-xs text-sky-300"
        >
          {t("training.exercise.addSet")}
        </button>
      </div>
    </div>
  );
}
