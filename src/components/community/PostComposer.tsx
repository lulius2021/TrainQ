import React, { useState, useEffect } from "react";
import { X, ChevronDown, ChevronRight, Dumbbell } from "lucide-react";
import { AppButton } from "../ui/AppButton";
import { createPost } from "../../services/community/api";
import type { PostType, Visibility, WorkoutData } from "../../services/community/types";
import { DEFAULT_VISIBILITY, POST_TYPE_KEYS, VISIBILITY_KEYS } from "../../services/community/types";
import { useI18n } from "../../i18n/useI18n";
import { loadWorkoutHistory } from "../../utils/workoutHistory";
import { computeWorkoutShareStats } from "../../utils/workoutShare";
import WorkoutCard from "./WorkoutCard";

interface RecentWorkout {
  refId: string;
  title: string;
  dateLabel: string;
  data: WorkoutData;
}

interface Props {
  userId: string;
  onClose: () => void;
  onCreated: () => void;
}

export default function PostComposer({ userId, onClose, onCreated }: Props) {
  const { t } = useI18n();
  const [postType, setPostType] = useState<PostType>("text_post");
  const [text, setText] = useState("");
  const [visibility, setVisibility] = useState<Visibility>(DEFAULT_VISIBILITY.text_post);
  const [showVisMenu, setShowVisMenu] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Workout share state
  const [recentWorkouts, setRecentWorkouts] = useState<RecentWorkout[]>([]);
  const [selectedWorkout, setSelectedWorkout] = useState<RecentWorkout | null>(null);
  const [showWorkoutPicker, setShowWorkoutPicker] = useState(false);

  const isValid = text.trim().length > 0 && text.length <= 1000;

  // Load last 5 workouts when workout_share is selected
  useEffect(() => {
    if (postType !== "workout_share") return;
    const history = loadWorkoutHistory().slice(0, 5);
    const workouts: RecentWorkout[] = history.map((entry) => {
      const stats = computeWorkoutShareStats(entry);
      return {
        refId: entry.id,
        title: stats.title,
        dateLabel: stats.dateLabel,
        data: {
          title: stats.title,
          sport: stats.sport,
          durationMin: stats.durationMin,
          durationLabel: stats.durationLabel,
          totalVolumeKg: stats.totalVolumeKg,
          totalSets: stats.totalSets,
          totalExercises: stats.totalExercises,
          topExercises: stats.topExercises,
          muscleGroups: stats.muscleGroups,
        },
      };
    });
    setRecentWorkouts(workouts);
    setSelectedWorkout(workouts[0] ?? null);
  }, [postType]);

  const handleTypeChange = (type: PostType) => {
    setPostType(type);
    setVisibility(DEFAULT_VISIBILITY[type]);
    if (type !== "workout_share") {
      setSelectedWorkout(null);
      setShowWorkoutPicker(false);
    }
  };

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await createPost(userId, {
        type: postType,
        text: text.trim(),
        visibility,
        workoutRefId: selectedWorkout?.refId,
        workoutData: selectedWorkout?.data,
      });
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("community.composer.error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: "var(--bg-color)" }} data-overlay-open="true">
      {/* Header */}
      <div className="pt-safe">
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border-color)" }}>
        <button onClick={onClose} className="p-1" style={{ color: "var(--text-color)" }}>
          <X size={24} />
        </button>
        <span className="font-semibold" style={{ color: "var(--text-color)" }}>{t("community.composer.title")}</span>
        <AppButton onClick={handleSubmit} variant="primary" size="sm" disabled={!isValid || submitting} isLoading={submitting}>
          {t("community.composer.post")}
        </AppButton>
      </div>
      </div>

      {/* Post type picker */}
      <div className="flex gap-2 px-4 pt-3">
        {(["text_post", "workout_share", "progress_update"] as PostType[]).map((type) => (
          <button
            key={type}
            onClick={() => handleTypeChange(type)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${postType === type ? "text-white" : ""}`}
            style={{
              background: postType === type ? "var(--accent-color)" : "var(--border-color)",
              color: postType === type ? "#fff" : "var(--text-secondary)",
            }}
          >
            {t(POST_TYPE_KEYS[type])}
          </button>
        ))}
      </div>

      {/* Visibility selector */}
      <div className="px-4 pt-2 relative">
        <button
          onClick={() => setShowVisMenu(!showVisMenu)}
          className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg"
          style={{ background: "var(--border-color)", color: "var(--text-secondary)" }}
        >
          {t(VISIBILITY_KEYS[visibility])} <ChevronDown size={12} />
        </button>
        {showVisMenu && (
          <div className="absolute left-4 top-full mt-1 z-10 rounded-xl border shadow-lg p-1" style={{ background: "var(--card-bg)", borderColor: "var(--border-color)" }}>
            {(["public", "followers", "private"] as Visibility[]).map((v) => (
              <button
                key={v}
                onClick={() => { setVisibility(v); setShowVisMenu(false); }}
                className="block w-full text-left px-3 py-2 text-sm rounded-lg"
                style={{ color: visibility === v ? "var(--accent-color)" : "var(--text-color)" }}
              >
                {t(VISIBILITY_KEYS[v])}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Text area */}
      <div className="flex-1 px-4 pt-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("community.composer.placeholder")}
          maxLength={1000}
          className="w-full h-48 resize-none bg-transparent text-base outline-none"
          style={{ color: "var(--text-color)" }}
          autoFocus
        />
        <div className="text-xs text-right" style={{ color: text.length > 950 ? "#E63946" : "var(--text-secondary)" }}>
          {text.length}/1000
        </div>
      </div>

      {/* Workout picker (workout_share only) */}
      {postType === "workout_share" && (
        <div className="px-4 pb-3">
          {recentWorkouts.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {t("community.composer.noWorkouts")}
            </p>
          ) : (
            <>
              {/* Selector button */}
              <button
                onClick={() => setShowWorkoutPicker(!showWorkoutPicker)}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-medium"
                style={{ background: "var(--border-color)", color: "var(--text-color)" }}
              >
                <Dumbbell size={14} style={{ color: "var(--accent-color)" }} />
                <span className="flex-1 text-left truncate">
                  {selectedWorkout ? `${selectedWorkout.title} · ${selectedWorkout.dateLabel}` : t("community.composer.selectWorkout")}
                </span>
                <ChevronRight size={14} className={`transition-transform ${showWorkoutPicker ? "rotate-90" : ""}`} style={{ color: "var(--text-secondary)" }} />
              </button>

              {/* Dropdown list */}
              {showWorkoutPicker && (
                <div className="mt-1 rounded-xl border overflow-hidden" style={{ borderColor: "var(--border-color)", background: "var(--card-bg)" }}>
                  {recentWorkouts.map((w) => (
                    <button
                      key={w.refId}
                      onClick={() => { setSelectedWorkout(w); setShowWorkoutPicker(false); }}
                      className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-left border-b last:border-b-0"
                      style={{
                        borderColor: "var(--border-color)",
                        color: selectedWorkout?.refId === w.refId ? "var(--accent-color)" : "var(--text-color)",
                        background: selectedWorkout?.refId === w.refId ? "var(--bg-color)" : "transparent",
                      }}
                    >
                      <span className="flex-1 truncate font-medium">{w.title}</span>
                      <span className="text-xs shrink-0" style={{ color: "var(--text-secondary)" }}>{w.dateLabel}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected workout preview */}
              {selectedWorkout && !showWorkoutPicker && (
                <WorkoutCard data={selectedWorkout.data} />
              )}
            </>
          )}
        </div>
      )}

      {error && (
        <div className="mx-4 mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
