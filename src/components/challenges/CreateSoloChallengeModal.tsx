// src/components/challenges/CreateSoloChallengeModal.tsx
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useI18n } from "../../i18n/useI18n";

// Workaround for Framer Motion typing issues with motion.div
const MotionDiv = motion.div as any;
import { AppButton } from "../ui/AppButton";
import type { ChallengeGoalType, ChallengeDefinition } from "../../types/challenge";

interface CreateSoloChallengeModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (def: Omit<ChallengeDefinition, "id" | "isAdmin">) => void;
}

const GOAL_TYPE_KEYS: { value: ChallengeGoalType; key: string }[] = [
  { value: "workout_count", key: "challenges.goalType.workoutCount" },
  { value: "distance_km", key: "challenges.goalType.distance" },
  { value: "volume_kg", key: "challenges.goalType.volume" },
];

const DURATIONS = [7, 14, 30, 60, 90];

const EMOJIS = [
  "\u{1F3AF}",
  "\u{1F4AA}",
  "\u{1F525}",
  "\u{2B50}",
  "\u{1F3C6}",
  "\u{26A1}",
  "\u{1F680}",
  "\u{1F48E}",
];

const CreateSoloChallengeModal: React.FC<CreateSoloChallengeModalProps> = ({
  open,
  onClose,
  onCreate,
}) => {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [goalType, setGoalType] = useState<ChallengeGoalType>("workout_count");
  const [target, setTarget] = useState("");
  const [durationDays, setDurationDays] = useState(30);
  const [emoji, setEmoji] = useState(EMOJIS[0]);

  const canCreate = title.trim().length > 0 && Number(target) > 0;

  const handleCreate = () => {
    if (!canCreate) return;
    onCreate({
      title: title.trim(),
      description: t("createChallenge.descriptionTemplate", { title: title.trim() }),
      goal: { type: goalType, target: Number(target) },
      durationDays,
      emoji,
    });
    // Reset
    setTitle("");
    setTarget("");
    setGoalType("workout_count");
    setDurationDays(30);
    setEmoji(EMOJIS[0]);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <MotionDiv
          className="fixed inset-0 z-[300] flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          <MotionDiv
            className="relative w-full max-w-lg bg-[var(--card-bg)] border-t border-[var(--border-color)] rounded-t-3xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl max-h-[85vh] overflow-y-auto"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--text-color)]">
                {t("challenges.createSolo")}
              </h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-[var(--button-bg)] flex items-center justify-center"
              >
                <X size={18} className="text-[var(--text-secondary)]" />
              </button>
            </div>

            {/* Emoji picker */}
            <div className="mb-5">
              <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 block">
                Emoji
              </label>
              <div className="flex gap-2 flex-wrap">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => setEmoji(e)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${
                      emoji === e
                        ? "bg-[var(--accent-color)]/20 ring-2 ring-[var(--accent-color)]"
                        : "bg-[var(--button-bg)]"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div className="mb-5">
              <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 block">
                {t("challenges.form.title")}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("challenges.form.titlePlaceholder")}
                maxLength={50}
                className="w-full px-4 py-3 rounded-2xl bg-[var(--button-bg)] border border-[var(--border-color)] text-[var(--text-color)] placeholder:text-[var(--text-secondary)]/50 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
              />
            </div>

            {/* Goal type */}
            <div className="mb-5">
              <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 block">
                {t("challenges.form.goalType")}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {GOAL_TYPE_KEYS.map((gt) => (
                  <button
                    key={gt.value}
                    onClick={() => setGoalType(gt.value)}
                    className={`px-3 py-2.5 rounded-xl text-xs font-semibold transition-all border ${
                      goalType === gt.value
                        ? "bg-[var(--accent-color)] text-white border-[var(--accent-color)]"
                        : "bg-[var(--button-bg)] text-[var(--text-color)] border-[var(--border-color)]"
                    }`}
                  >
                    {t(gt.key)}
                  </button>
                ))}
              </div>
            </div>

            {/* Target value */}
            <div className="mb-5">
              <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 block">
                {t("challenges.form.targetValue")}
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder={
                  goalType === "workout_count"
                    ? t("createChallenge.placeholder.workoutCount")
                    : goalType === "distance_km"
                    ? t("createChallenge.placeholder.distanceKm")
                    : t("createChallenge.placeholder.volumeKg")
                }
                className="w-full px-4 py-3 rounded-2xl bg-[var(--button-bg)] border border-[var(--border-color)] text-[var(--text-color)] placeholder:text-[var(--text-secondary)]/50 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
              />
            </div>

            {/* Duration */}
            <div className="mb-6">
              <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 block">
                {t("challenges.form.duration")}
              </label>
              <div className="flex gap-2 flex-wrap">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDurationDays(d)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                      durationDays === d
                        ? "bg-[var(--accent-color)] text-white border-[var(--accent-color)]"
                        : "bg-[var(--button-bg)] text-[var(--text-color)] border-[var(--border-color)]"
                    }`}
                  >
                    {t("challenges.form.days", { count: d })}
                  </button>
                ))}
              </div>
            </div>

            {/* Create button */}
            <AppButton
              variant="primary"
              fullWidth
              disabled={!canCreate}
              onClick={handleCreate}
            >
              {t("challenges.create")}
            </AppButton>
          </MotionDiv>
        </MotionDiv>
      )}
    </AnimatePresence>
  );
};

export default CreateSoloChallengeModal;
