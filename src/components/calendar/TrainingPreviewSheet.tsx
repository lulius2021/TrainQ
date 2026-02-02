import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useDragControls } from "framer-motion";

type DragInfo = { offset: { y: number }; velocity: { y: number } };

import type { CalendarEvent, LiveExercise, LiveSet, TrainingType } from "../../types/training";
import type { LiveTrainingSeed } from "../../utils/liveTrainingSeed";
import { resolveLiveSeed } from "../../utils/liveTrainingSeed";

import ExerciseEditor from "../training/ExerciseEditor";
import ExerciseLibraryModal from "../training/ExerciseLibraryModal";
import type { Exercise } from "../../data/exerciseLibrary";
import { useI18n } from "../../i18n/useI18n";

type Props = {
  open: boolean;
  event: CalendarEvent | null;
  onClose: () => void;
  onSave: (nextEvent: CalendarEvent, seed: LiveTrainingSeed) => void;
  onStart: (nextEvent: CalendarEvent, seed: LiveTrainingSeed) => void;
};

const CLOSE_OFFSET_PX = 120;
const CLOSE_VELOCITY_PX = 800;

function ClockPlusIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 5v4M17 7h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MinusCircleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PencilIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M4 20l4.5-1 9.5-9.5-3.5-3.5L5 15.5 4 20z" stroke="currentColor" strokeWidth="2" />
      <path d="M14.5 6l3.5 3.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function normalizeTitle(title: unknown): string {
  return String(title ?? "").trim().replace(/\s+/g, " ");
}

function normalizeTrainingType(raw: unknown): TrainingType | null {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!v) return null;
  const lower = v.toLowerCase();
  if (lower === "gym") return "gym";
  if (lower === "laufen") return "laufen";
  if (lower === "radfahren") return "radfahren";
  if (lower === "custom") return "custom";
  if (lower === "run" || lower === "running") return "laufen";
  if (lower === "bike" || lower === "cycling") return "radfahren";
  return null;
}

function getTrainingType(ev: CalendarEvent): TrainingType | null {
  return normalizeTrainingType((ev as any).trainingType);
}

function isGymTraining(ev: CalendarEvent): boolean {
  return getTrainingType(ev) === "gym";
}

function isCardioType(tt: TrainingType | null): boolean {
  return tt === "laufen" || tt === "radfahren";
}

function makeId(prefix = "id"): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return `${prefix}_${crypto.randomUUID()}`;
    }
  } catch {
    // ignore
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function roundTo5Minutes(date: Date): string {
  const ms = 1000 * 60 * 5;
  const rounded = new Date(Math.round(date.getTime() / ms) * ms);
  const h = String(rounded.getHours()).padStart(2, "0");
  const m = String(rounded.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function defaultStartTime(dateISO: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (dateISO === today) return roundTo5Minutes(new Date());
  return "08:00";
}

function seedForEvent(ev: CalendarEvent, existing: LiveTrainingSeed | null): { seed: LiveTrainingSeed; missingSeed: boolean } {
  if (existing) return { seed: existing, missingSeed: false };

  const tt = getTrainingType(ev);
  const sport: LiveTrainingSeed["sport"] =
    tt === "laufen" ? "Laufen" : tt === "radfahren" ? "Radfahren" : tt === "custom" ? "Custom" : "Gym";

  return {
    seed: {
      title: normalizeTitle(ev.title) || "Training",
      sport,
      isCardio: isCardioType(tt),
      exercises: [],
    },
    missingSeed: isGymTraining(ev),
  };
}

function seedToExercises(seed: LiveTrainingSeed): LiveExercise[] {
  const exercises = Array.isArray(seed.exercises) ? seed.exercises : [];
  return exercises.map((ex) => ({
    id: String(ex.id ?? makeId("ex")),
    exerciseId: ex.exerciseId,
    name: ex.name || "Übung",
    restSeconds: undefined,
    sets: (ex.sets || []).map((s) => ({
      id: String(s.id ?? makeId("set")),
      reps: typeof s.reps === "number" ? s.reps : undefined,
      weight: typeof s.weight === "number" ? s.weight : undefined,
      notes: typeof s.notes === "string" ? s.notes : "",
      completed: false,
      completedAt: undefined,
    })) as LiveSet[],
  })) as LiveExercise[];
}

function exercisesToSeed(seedBase: LiveTrainingSeed, exercises: LiveExercise[], titleOverride?: string): LiveTrainingSeed {
  return {
    title: normalizeTitle(titleOverride ?? seedBase.title) || "Training",
    sport: seedBase.sport,
    isCardio: seedBase.isCardio,
    exercises: (exercises || []).map((ex) => ({
      id: ex.id,
      exerciseId: ex.exerciseId,
      name: normalizeTitle(ex.name) || "Übung",
      sets: (ex.sets || []).map((s) => ({
        id: s.id,
        reps: typeof s.reps === "number" ? s.reps : undefined,
        weight: typeof s.weight === "number" ? s.weight : undefined,
        notes: typeof (s as any).notes === "string" ? (s as any).notes : undefined,
      })),
    })),
  };
}

function countSeed(seed: LiveTrainingSeed | null): { exercises: number; sets: number } {
  if (!seed || !Array.isArray(seed.exercises)) return { exercises: 0, sets: 0 };
  const exercises = seed.exercises.length;
  const sets = seed.exercises.reduce((acc, ex) => acc + (Array.isArray(ex.sets) ? ex.sets.length : 0), 0);
  return { exercises, sets };
}

export default function TrainingPreviewSheet({ open, event, onClose, onSave, onStart }: Props) {
  const { t } = useI18n();
  const dragControls = useDragControls();
  const [isEditing, setIsEditing] = useState(false);
  const [draftEvent, setDraftEvent] = useState<CalendarEvent | null>(null);
  const [draftSeed, setDraftSeed] = useState<LiveTrainingSeed | null>(null);
  const [draftExercises, setDraftExercises] = useState<LiveExercise[]>([]);
  const [seedMissing, setSeedMissing] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const scrollLockRef = useRef<{ scrollY: number; htmlOverflow: string; body: CSSStyleDeclaration } | null>(null);

  useEffect(() => {
    if (!open || !event) return;
    const existingSeed = resolveLiveSeed({ eventId: event.id, dateISO: event.date, title: event.title });
    const seeded = seedForEvent(event, existingSeed);
    setDraftEvent({ ...event });
    setDraftSeed(seeded.seed);
    setDraftExercises(seedToExercises(seeded.seed));
    setSeedMissing(seeded.missingSeed);
    setIsEditing(false);
    setLibraryOpen(false);
  }, [open, event?.id]);

  useEffect(() => {
    if (!open) setLibraryOpen(false);
  }, [open]);


  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY || window.pageYOffset;
    scrollLockRef.current = {
      scrollY,
      htmlOverflow: document.documentElement.style.overflow,
      body: { ...document.body.style },
    };
    document.documentElement.classList.add("modal-open");
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    return () => {
      const prev = scrollLockRef.current;
      document.documentElement.classList.remove("modal-open");
      document.documentElement.style.overflow = prev?.htmlOverflow ?? "";
      if (prev?.body) {
        document.body.style.overflow = prev.body.overflow;
        document.body.style.position = prev.body.position;
        document.body.style.top = prev.body.top;
        document.body.style.width = prev.body.width;
      }
      window.scrollTo(0, prev?.scrollY ?? 0);
      scrollLockRef.current = null;
    };
  }, [open]);

  const canStartPreview = useMemo(() => {
    if (!draftEvent) return false;
    if (!isGymTraining(draftEvent)) return true;
    return !!draftSeed;
  }, [draftEvent, draftSeed]);

  const previewCounts = useMemo(() => countSeed(draftSeed), [draftSeed]);
  const existingExerciseIds = useMemo(
    () => draftExercises.map((ex) => ex.exerciseId).filter(Boolean) as string[],
    [draftExercises]
  );

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: DragInfo) => {
    if (info.offset.y > CLOSE_OFFSET_PX || info.velocity.y > CLOSE_VELOCITY_PX) {
      handleClose();
    }
  };

  const updateExercise = (exerciseId: string, patch: Partial<LiveExercise>) => {
    setDraftExercises((prev) =>
      prev.map((ex) => (ex.id === exerciseId ? { ...ex, ...patch } : ex))
    );
  };

  const removeExercise = (exerciseId: string) => {
    setDraftExercises((prev) => prev.filter((ex) => ex.id !== exerciseId));
  };

  const addSet = (exerciseId: string, isCardio: boolean) => {
    setDraftExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId
          ? {
            ...ex,
            sets: [
              ...(Array.isArray(ex.sets) ? ex.sets : []),
              {
                id: makeId("set"),
                completed: false,
                reps: isCardio ? 10 : undefined,
                weight: undefined,
                notes: "",
              } as LiveSet,
            ],
          }
          : ex
      )
    );
  };

  const removeSet = (exerciseId: string, setId: string) => {
    setDraftExercises((prev) =>
      prev.map((ex) =>
        ex.id === exerciseId ? { ...ex, sets: (ex.sets || []).filter((s) => s.id !== setId) } : ex
      )
    );
  };

  const updateSet = (exerciseId: string, setId: string, patch: Partial<LiveSet>) => {
    setDraftExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        const sets = Array.isArray(ex.sets) ? ex.sets : [];
        return { ...ex, sets: sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) };
      })
    );
  };

  const toggleSetCompleted = (exerciseId: string, setId: string) => {
    setDraftExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        const sets = Array.isArray(ex.sets) ? ex.sets : [];
        return {
          ...ex,
          sets: sets.map((s) =>
            s.id === setId
              ? { ...s, completed: !s.completed, completedAt: !s.completed ? new Date().toISOString() : undefined }
              : s
          ),
        };
      })
    );
  };

  const moveExercise = (exerciseId: string, direction: "up" | "down") => {
    setDraftExercises((prev) => {
      const idx = prev.findIndex((ex) => ex.id === exerciseId);
      if (idx === -1) return prev;
      const nextIdx = direction === "up" ? idx - 1 : idx + 1;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[nextIdx]] = [next[nextIdx], next[idx]];
      return next;
    });
  };

  const addExerciseFromLibrary = (exercise?: Exercise, isCardio?: boolean) => {
    if (!draftEvent || !draftSeed) return;
    const cardio = Boolean(isCardio);
    const newExercise: LiveExercise = {
      id: makeId("ex"),
      exerciseId: exercise?.id,
      name: exercise?.name || (cardio ? "Neue Einheit" : "Neue Übung"),
      sets: [
        {
          id: makeId("set"),
          completed: false,
          reps: cardio ? 30 : undefined,
          weight: undefined,
          notes: "",
        } as LiveSet,
      ],
    } as LiveExercise;
    setDraftExercises((prev) => [...prev, newExercise]);
  };

  const handleSave = () => {
    if (!draftEvent || !draftSeed) return;
    const nextSeed = exercisesToSeed(draftSeed, draftExercises, draftEvent.title);
    onSave(draftEvent, nextSeed);
    setDraftSeed(nextSeed);
    setSeedMissing(false);
    setIsEditing(false);
  };

  const handleStart = () => {
    if (!draftEvent || !draftSeed) return;
    const nextSeed = exercisesToSeed(draftSeed, draftExercises, draftEvent.title);
    onSave(draftEvent, nextSeed);
    onStart(draftEvent, nextSeed);
  };

  const handleClose = () => {
    if (isEditing) handleSave();
    onClose();
  };

  const canEdit = open && !!draftEvent && !!draftSeed;
  const isCardio = isCardioType(getTrainingType(draftEvent || ({} as CalendarEvent)));
  const hasTime = Boolean(draftEvent?.startTime);
  const MotionDiv = motion.div as unknown as React.ComponentType<any>;

  return (
    <AnimatePresence>
      {open && draftEvent && draftSeed && (
        <MotionDiv
          className="fixed inset-0 z-[80]"
          data-overlay-open="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="fixed inset-0 z-[60] flex flex-col bg-black">
            {/* Header (fixiert) */}
            <div className="flex-none">
              {/* Drag Handle Area - Optional, kept for visual consistency if needed, or remove if no longer draggable */}
              <div
                className="w-full flex justify-center pt-4 pb-2"
              >
                <div className="h-1.5 w-12 rounded-full bg-white/20" />
              </div>


              {/* Header Area - Draggable if not editing */}
              <div
                className="flex items-start justify-between gap-2 px-4 pb-2 touch-none"
                onPointerDown={(e: React.PointerEvent) => !isEditing && dragControls.start(e)}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm" style={{ color: "var(--muted)" }}>
                    {t("calendar.preview.title")}
                  </div>
                  <input
                    type="text"
                    value={draftEvent.title}
                    onChange={(e) => canEdit && setDraftEvent({ ...draftEvent, title: e.target.value })}
                    disabled={!isEditing}
                    className="w-full bg-transparent text-lg font-semibold outline-none"
                  />
                  <div className="mt-1 flex gap-2">
                    <input
                      type="date"
                      value={draftEvent.date}
                      onChange={(e) => canEdit && setDraftEvent({ ...draftEvent, date: e.target.value })}
                      disabled={!isEditing}
                      className="rounded px-2 py-1 text-sm"
                      style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}
                    />
                    {hasTime ? (
                      isEditing ? (
                        <div className="relative">
                          <input
                            type="time"
                            value={draftEvent.startTime || ""}
                            onChange={(e) => canEdit && setDraftEvent({ ...draftEvent, startTime: e.target.value })}
                            disabled={!isEditing}
                            className="rounded px-2 py-1 text-sm pr-7"
                            style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              canEdit &&
                              setDraftEvent({
                                ...draftEvent,
                                startTime: "",
                                endTime: "",
                              })
                            }
                            className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 hover:opacity-90"
                            style={{ color: "var(--muted)" }}
                            aria-label={t("calendar.preview.removeTime")}
                            title={t("calendar.preview.removeTime")}
                          >
                            <MinusCircleIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div
                          className="rounded px-2 py-1 text-sm"
                          style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}
                        >
                          {draftEvent.startTime}
                        </div>
                      )
                    ) : isEditing ? (
                      <button
                        type="button"
                        onClick={() =>
                          canEdit &&
                          setDraftEvent({
                            ...draftEvent,
                            startTime: defaultStartTime(draftEvent.date),
                          })
                        }
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-sm hover:opacity-95"
                        style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}
                        aria-label={t("calendar.preview.addTime")}
                        title={t("calendar.preview.addTime")}
                      >
                        <ClockPlusIcon className="h-4 w-4" />
                        <span>{t("calendar.preview.addTime")}</span>
                      </button>
                    ) : (
                      <div className="rounded px-2 py-1 text-sm" style={{ color: "var(--muted)" }}>
                        {t("calendar.preview.noTime")}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
                  className="h-9 w-9 rounded-full border flex items-center justify-center hover:opacity-95"
                  style={{ borderColor: "var(--border)", color: "var(--text)" }}
                  aria-label={isEditing ? t("calendar.preview.saveEdit") : t("calendar.preview.edit")}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <PencilIcon />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain px-4 pt-3" style={{ WebkitOverflowScrolling: "touch" }}>
                <div className="space-y-4">
                  <div className="rounded-3xl px-3 py-3" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium" style={{ color: "var(--muted)" }}>
                        {t("calendar.preview.scope")}
                      </div>
                      <div className="text-sm">
                        {t("calendar.preview.scopeCounts", { exercises: previewCounts.exercises, sets: previewCounts.sets })}
                      </div>
                    </div>

                    {seedMissing && (
                      <div className="mt-2 text-sm" style={{ color: "rgba(245,158,11,0.95)" }}>
                        {t("calendar.preview.seedMissing")}
                      </div>
                    )}
                  </div>

                  <div className={isEditing ? "" : "pointer-events-none opacity-80"}>
                    {draftExercises.length === 0 ? (
                      <div className="rounded-3xl p-3 text-sm" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                        {isCardio ? t("calendar.preview.emptyCardio") : t("calendar.preview.emptyStrength")}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {draftExercises.map((ex, exIdx) => (
                          <ExerciseEditor
                            key={ex.id}
                            exercise={ex}
                            isCardio={isCardio}
                            onChange={(patch: Partial<LiveExercise>) => updateExercise(ex.id, patch)}
                            onRemove={() => removeExercise(ex.id)}
                            onAddSet={() => addSet(ex.id, isCardio)}
                            onRemoveSet={(setId: string) => removeSet(ex.id, setId)}
                            onSetChange={(setId: string, patch: Partial<LiveSet>) => updateSet(ex.id, setId, patch)}
                            onToggleSet={(setId: string) => toggleSetCompleted(ex.id, setId)}
                            onMoveUp={isEditing && exIdx > 0 ? () => moveExercise(ex.id, "up") : undefined}
                            onMoveDown={isEditing && exIdx < draftExercises.length - 1 ? () => moveExercise(ex.id, "down") : undefined}
                          />
                        ))}
                      </div>
                    )}

                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => setLibraryOpen(true)}
                        className="mt-3 w-full rounded-2xl border px-4 py-3 text-sm font-semibold hover:opacity-95"
                        style={{ background: "var(--surface2)", borderColor: "var(--border)", color: "var(--text)" }}
                      >
                        {isCardio ? t("calendar.preview.addCardio") : t("calendar.preview.addExercise")}
                      </button>
                    )}
                  </div>

                  {/* Footer actions moved inside scroll area */}
                  <div className="pt-6 pb-4 flex gap-2">
                    {isEditing ? (
                      <button
                        type="button"
                        onClick={handleSave}
                        className="flex-1 px-4 py-3 rounded-2xl text-base font-semibold shadow hover:opacity-95"
                        style={{ background: "rgba(16,185,129,0.95)", color: "#06120c" }}
                      >
                        {t("common.save")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleStart}
                        disabled={!canStartPreview}
                        className="flex-1 px-4 py-3 rounded-2xl text-base font-semibold shadow hover:opacity-95 disabled:cursor-not-allowed"
                        style={
                          canStartPreview
                            ? { background: "rgba(16,185,129,0.95)", color: "#06120c" }
                            : { background: "rgba(148,163,184,0.25)", color: "var(--muted)" }
                        }
                      >
                        {t("calendar.preview.startTraining")}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleClose}
                      className="px-4 py-3 rounded-2xl text-sm hover:opacity-95"
                      style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
                    >
                      {t("common.close")}
                    </button>
                  </div>

                  {/* Spacer um unter der Navbar hervorzukommen */}
                  <div className="h-40 w-full shrink-0" aria-hidden="true" />
                </div>
              </div>
            </div>
          </div>
        </MotionDiv>
      )}
      <ExerciseLibraryModal
        open={open && libraryOpen}
        isCardioLibrary={isCardio}
        title={isCardio ? t("training.exerciseLibrary.cardioTitle") : t("training.exerciseLibrary.title")}
        onClose={() => setLibraryOpen(false)}
        existingExerciseIds={existingExerciseIds}
        onPick={(exercise: Exercise) => addExerciseFromLibrary(exercise, isCardio)}
        onPickCustom={() => addExerciseFromLibrary(undefined, isCardio)}
      />
    </AnimatePresence>
  );
}
