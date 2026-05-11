// src/components/calendar/TrainingPreviewSheet.tsx
// Bottom sheet for calendar training preview with actions

import React, { useState, useMemo } from "react";
import {
  Calendar,
  ArrowLeftRight,
  ArrowUpDown,
  Play,
  Clock,
  Dumbbell,
  ChevronRight,
  ChevronLeft,
  Check,
  Bike,
  Repeat,
  Plus,
  Minus,
} from "lucide-react";
import {
  format,
  addDays,
  isSameDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
} from "date-fns";
import { de } from "date-fns/locale";
import { BottomSheet } from "../common/BottomSheet";
import { useI18n } from "../../i18n/useI18n";
import { hapticLight, hapticSuccess } from "../../native/haptics";
import { AiSparklesIcon } from "../icons/AiSparklesIcon";
import { IconFigureRun } from "../../assets/icons/IconFigureRun";
import { IconDumbbellFill } from "../../assets/icons/IconDumbbellFill";
import { IconFigureStrengthtrainingFunctional } from "../../assets/icons/IconFigureStrengthtrainingFunctional";
import { getTemplates } from "../../utils/trainingTemplatesStore";
import type { TrainingTemplateLite } from "../../utils/trainingTemplatesStore";
import type { ExerciseType } from "../../types";

// ── Types ──

export interface PreviewEvent {
  id: string;
  title: string;
  date: Date;
  type: ExerciseType;
  status: "planned" | "completed" | "skipped" | "open";
  workoutData?: any;
  adaptiveProfile?: string;
  durationSec?: number;
  exerciseCount?: number;
  distanceKm?: number;
  fromHistory?: boolean;
  trainingType?: string;
}

export interface ManualWorkoutLog {
  durationMin: number;
  exerciseCount: number;
  setCount: number;
  volumeKg: number;
  sport: string;
}

export interface TrainingPreviewSheetProps {
  open: boolean;
  onClose: () => void;
  event: PreviewEvent | null;
  allEvents: PreviewEvent[];
  onStartTraining: (event: PreviewEvent) => void;
  onMoveTraining: (eventId: string, newDate: string) => void;
  onSwapDays: (eventIdA: string, eventIdB: string) => void;
  onMovePlan: (eventId: string, offset: number) => void;
  onReplaceWithAdaptive: (event: PreviewEvent) => void;
  onReplaceWithTemplate: (eventId: string, template: TrainingTemplateLite) => void;
  onMarkCompleted: (event: PreviewEvent, log?: ManualWorkoutLog) => void;
}

type SheetView = "main" | "move" | "swap" | "movePlan" | "replaceTemplate" | "logWorkout";

// ── Helpers ──

function sportColor(type: ExerciseType): { color: string; bg: string } {
  switch (type) {
    case "strength": return { color: "#007AFF", bg: "rgba(0,122,255,0.12)" };
    case "run":      return { color: "#34C759", bg: "rgba(52,199,89,0.12)" };
    case "cycle":    return { color: "#FF9500", bg: "rgba(255,149,0,0.12)" };
    default:         return { color: "#AF52DE", bg: "rgba(175,82,222,0.12)" };
  }
}

function sportIconNode(type: ExerciseType, size = 20): React.ReactNode {
  switch (type) {
    case "strength": return <IconDumbbellFill width={size} height={Math.round(size * 0.64)} />;
    case "run":      return <IconFigureRun width={size} height={size} />;
    case "cycle":    return <Bike size={size} />;
    default:         return <IconFigureStrengthtrainingFunctional width={size} height={Math.round(size * 1.2)} />;
  }
}

function fmtDuration(sec: number): string {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h} h` : `${h} h ${rem} min`;
}

// ── Component ──

export default function TrainingPreviewSheet({
  open,
  onClose,
  event,
  allEvents,
  onStartTraining,
  onMoveTraining,
  onSwapDays,
  onMovePlan,
  onReplaceWithAdaptive,
  onReplaceWithTemplate,
  onMarkCompleted,
}: TrainingPreviewSheetProps) {
  const { t } = useI18n();
  const [view, setView] = useState<SheetView>("main");
  const [selectedMoveDate, setSelectedMoveDate] = useState<Date | null>(null);
  const [selectedSwapEvent, setSelectedSwapEvent] = useState<PreviewEvent | null>(null);
  const [moveCalMonth, setMoveCalMonth] = useState(() => new Date());

  // Log workout state
  const [logDuration, setLogDuration] = useState(45);
  const [logExerciseCount, setLogExerciseCount] = useState(5);
  const [logSetCount, setLogSetCount] = useState(15);
  const [logVolumeKg, setLogVolumeKg] = useState(0);

  const handleClose = () => {
    setView("main");
    setSelectedMoveDate(null);
    setSelectedSwapEvent(null);
    setLogDuration(45);
    setLogExerciseCount(5);
    setLogSetCount(15);
    setLogVolumeKg(0);
    onClose();
  };

  // Hooks before early return
  const nearbyEvents = useMemo(() => {
    if (!event) return [];
    return allEvents.filter(
      (e) =>
        e.id !== event.id &&
        (e.status === "planned" || e.status === "open") &&
        !e.fromHistory &&
        Math.abs(e.date.getTime() - event.date.getTime()) <= 7 * 24 * 60 * 60 * 1000 &&
        !isSameDay(e.date, event.date),
    );
  }, [allEvents, event]);

  const moveDates = useMemo(() => {
    if (!event) return [];
    const dates: Date[] = [];
    for (let i = -3; i <= 14; i++) {
      const d = addDays(new Date(), i);
      if (!isSameDay(d, event.date)) dates.push(d);
    }
    return dates;
  }, [event?.date]);

  const templates = useMemo(() => {
    if (view !== "replaceTemplate") return [];
    return getTemplates();
  }, [view]);

  if (!event) return null;

  const isCompleted = event.status === "completed";
  const isPlanned = (event.status === "planned" || event.status === "open") && !event.fromHistory;
  const canStart = isPlanned && !!event.workoutData?.exercises?.length;
  const { color, bg } = sportColor(event.type);

  const exercises = event.workoutData?.exercises ?? [];
  const totalSets = exercises.reduce(
    (sum: number, ex: any) => sum + (Array.isArray(ex.sets) ? ex.sets.length : 0),
    0,
  );

  // ── Main View ──
  const renderMainView = () => (
    <div className="px-4 pb-6">
      {/* Header */}
      <div className="flex items-center gap-3.5 mb-5">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: bg, color }}
        >
          {sportIconNode(event.type, 18)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[17px] font-bold truncate" style={{ color: "var(--text-color)" }}>
            {event.title}
          </h3>
          <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
            {format(event.date, "EEEE, d. MMMM", { locale: de })}
          </p>
        </div>
        {isCompleted && (
          <span
            className="text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0"
            style={{ backgroundColor: "rgba(52,199,89,0.12)", color: "#34C759" }}
          >
            {t("calendar.completed")}
          </span>
        )}
      </div>

      {/* Exercise preview */}
      {exercises.length > 0 && (
        <div className="rounded-2xl overflow-hidden mb-4" style={{ border: "1px solid var(--border-color)" }}>
          <div className="flex items-center gap-4 px-4 py-3" style={{ backgroundColor: "var(--button-bg)" }}>
            <div className="flex items-center gap-1.5">
              <Dumbbell size={13} style={{ color: "var(--text-secondary)" }} />
              <span className="text-[13px] font-semibold" style={{ color: "var(--text-color)" }}>
                {exercises.length} {t("calendarSheet.exercises")}
              </span>
            </div>
            {totalSets > 0 && (
              <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                {totalSets} {t("calendarSheet.sets")}
              </span>
            )}
            {event.durationSec && event.durationSec > 0 && (
              <div className="flex items-center gap-1.5 ml-auto">
                <Clock size={13} style={{ color: "var(--text-secondary)" }} />
                <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                  {fmtDuration(event.durationSec)}
                </span>
              </div>
            )}
          </div>
          {exercises.slice(0, 4).map((ex: any, i: number) => (
            <div key={ex.id || i} className="flex items-center justify-between px-4 py-2.5" style={{ borderTop: "1px solid var(--border-color)" }}>
              <span className="text-[13px] truncate flex-1" style={{ color: "var(--text-color)" }}>{ex.name}</span>
              <span className="text-[12px] shrink-0 ml-3 tabular-nums" style={{ color: "var(--text-secondary)" }}>
                {ex.sets?.length ?? 0} x {ex.sets?.[0]?.reps ?? "–"}
              </span>
            </div>
          ))}
          {exercises.length > 4 && (
            <div className="px-4 py-2" style={{ borderTop: "1px solid var(--border-color)" }}>
              <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>+{exercises.length - 4} {t("calendarSheet.more")}</span>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {isPlanned && (
        <>
          {canStart && (
            <button
              onClick={() => { hapticLight(); onStartTraining(event); handleClose(); }}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl mb-3 active:scale-[0.97] transition-transform"
              style={{ backgroundColor: "var(--accent-color, #007AFF)", color: "#fff" }}
            >
              <Play size={16} fill="#fff" />
              <span className="text-[15px] font-bold">{t("calendarSheet.startTraining")}</span>
            </button>
          )}

          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
            <Row icon={<AiSparklesIcon size={18} />} label={t("calendarSheet.replaceAdaptive")}
              onClick={() => { hapticLight(); onReplaceWithAdaptive(event); handleClose(); }} />
            <RowDivider />
            <Row icon={<Repeat size={16} />} label={t("calendarSheet.replaceTemplate")}
              onClick={() => { hapticLight(); setView("replaceTemplate"); }} />
            <RowDivider />
            <Row icon={<Calendar size={16} />} label={t("calendarSheet.moveTraining")}
              onClick={() => { hapticLight(); setMoveCalMonth(event.date); setView("move"); }} />
            {nearbyEvents.length > 0 && (
              <>
                <RowDivider />
                <Row icon={<ArrowLeftRight size={16} />} label={t("calendarSheet.swapDay")}
                  onClick={() => { hapticLight(); setView("swap"); }} />
              </>
            )}
            <RowDivider />
            <Row icon={<ArrowUpDown size={16} />} label={t("calendarSheet.movePlan")}
              onClick={() => { hapticLight(); setView("movePlan"); }} />
          </div>

          <div className="rounded-2xl overflow-hidden mt-3" style={{ border: "1px solid var(--border-color)" }}>
            <Row icon={<Check size={16} />} label={t("calendarSheet.logAndComplete")} labelColor="#34C759" hideChevron
              onClick={() => {
                hapticLight();
                // Pre-fill from event data
                setLogExerciseCount(exercises.length || 5);
                setLogSetCount(totalSets || 15);
                setLogVolumeKg(0);
                setLogDuration(event.durationSec ? Math.round(event.durationSec / 60) : 45);
                setView("logWorkout");
              }} />
          </div>
        </>
      )}
    </div>
  );

  // ── Move Training View (with mini calendar) ──
  const renderMoveView = () => {
    const monthStart = startOfMonth(moveCalMonth);
    const monthEnd = endOfMonth(monthStart);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const calDays = eachDayOfInterval({ start: calStart, end: calEnd });

    return (
      <div className="px-4 pb-6">
        <NavBack onClick={() => setView("main")} label={t("calendarSheet.back")} />

        {/* Mini calendar */}
        <div className="rounded-2xl p-3 mb-4" style={{ border: "1px solid var(--border-color)" }}>
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setMoveCalMonth(addDays(monthStart, -15))} className="p-1 active:opacity-60">
              <ChevronLeft size={16} style={{ color: "#007AFF" }} />
            </button>
            <span className="text-[13px] font-bold" style={{ color: "var(--text-color)" }}>
              {format(moveCalMonth, "MMMM yyyy", { locale: de })}
            </span>
            <button onClick={() => setMoveCalMonth(addDays(monthEnd, 5))} className="p-1 active:opacity-60">
              <ChevronRight size={16} style={{ color: "#007AFF" }} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
              <div key={d} className="text-center text-[9px] font-semibold py-0.5" style={{ color: "var(--text-secondary)" }}>{d}</div>
            ))}
            {calDays.map((day) => {
              const selected = selectedMoveDate && isSameDay(day, selectedMoveDate);
              const isEventDay = isSameDay(day, event.date);
              const hasOther = allEvents.some((e) => isSameDay(e.date, day) && e.id !== event.id);
              const inMonth = isSameMonth(day, moveCalMonth);
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => { if (!isEventDay) { hapticLight(); setSelectedMoveDate(day); } }}
                  disabled={isEventDay}
                  className="flex flex-col items-center justify-center py-1"
                  style={{ opacity: inMonth ? 1 : 0.3 }}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium"
                    style={{
                      backgroundColor: selected ? "#007AFF" : isEventDay ? "rgba(0,122,255,0.15)" : isToday(day) ? "rgba(0,122,255,0.08)" : "transparent",
                      color: selected ? "#fff" : isEventDay ? "#007AFF" : "var(--text-color)",
                    }}
                  >
                    {format(day, "d")}
                  </div>
                  {hasOther && !selected && <div className="w-1 h-1 rounded-full mt-0.5" style={{ backgroundColor: "var(--text-secondary)" }} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Date list below */}
        <div className="rounded-2xl overflow-hidden max-h-[30vh] overflow-y-auto" style={{ border: "1px solid var(--border-color)" }} data-sheet-content>
          {moveDates.map((d, i) => {
            const selected = selectedMoveDate && isSameDay(d, selectedMoveDate);
            const hasEvent = allEvents.some((e) => isSameDay(e.date, d) && e.id !== event.id);
            return (
              <React.Fragment key={d.toISOString()}>
                {i > 0 && <RowDivider />}
                <button
                  onClick={() => { hapticLight(); setSelectedMoveDate(d); }}
                  className="w-full flex items-center justify-between px-4 py-2.5 active:bg-[var(--button-bg)] transition-colors"
                  style={{ backgroundColor: selected ? "rgba(0,122,255,0.08)" : "transparent" }}
                >
                  <span className="text-[13px] font-medium" style={{ color: selected ? "#007AFF" : "var(--text-color)" }}>
                    {format(d, "EEE, d. MMM", { locale: de })}
                  </span>
                  <div className="flex items-center gap-2">
                    {hasEvent && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "rgba(255,149,0,0.12)", color: "#FF9500" }}>{t("calendarSheet.hasTraining")}</span>}
                    {selected && <Check size={14} style={{ color: "#007AFF" }} />}
                  </div>
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {selectedMoveDate && (
          <button
            onClick={() => { hapticLight(); onMoveTraining(event.id, format(selectedMoveDate, "yyyy-MM-dd")); handleClose(); }}
            className="w-full mt-4 py-3.5 rounded-2xl text-[15px] font-bold active:scale-[0.97] transition-transform"
            style={{ backgroundColor: "var(--accent-color, #007AFF)", color: "#fff" }}
          >
            {t("calendarSheet.confirmMove")}
          </button>
        )}
      </div>
    );
  };

  // ── Swap View ──
  const renderSwapView = () => (
    <div className="px-4 pb-6">
      <NavBack onClick={() => setView("main")} label={t("calendarSheet.back")} />
      <h3 className="text-[15px] font-bold mb-1" style={{ color: "var(--text-color)" }}>{t("calendarSheet.swapDay")}</h3>
      <p className="text-[13px] mb-4" style={{ color: "var(--text-secondary)" }}>{t("calendarSheet.swapHint")}</p>

      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
        {nearbyEvents.map((ne, i) => {
          const selected = selectedSwapEvent?.id === ne.id;
          return (
            <React.Fragment key={ne.id}>
              {i > 0 && <RowDivider />}
              <button
                onClick={() => { hapticLight(); setSelectedSwapEvent(ne); }}
                className="w-full flex items-center gap-3 px-4 py-3 active:bg-[var(--button-bg)] transition-colors"
                style={{ backgroundColor: selected ? "rgba(0,122,255,0.08)" : "transparent" }}
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(0,122,255,0.1)", color: "#007AFF" }}>
                  {sportIconNode(ne.type, 14)}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[14px] font-semibold truncate" style={{ color: "var(--text-color)" }}>{ne.title}</p>
                  <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{format(ne.date, "EEE, d. MMM", { locale: de })}</p>
                </div>
                {selected && <Check size={16} style={{ color: "#007AFF" }} />}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {selectedSwapEvent && (
        <button
          onClick={() => { hapticLight(); onSwapDays(event.id, selectedSwapEvent.id); handleClose(); }}
          className="w-full mt-4 py-3.5 rounded-2xl text-[15px] font-bold active:scale-[0.97] transition-transform"
          style={{ backgroundColor: "var(--accent-color, #007AFF)", color: "#fff" }}
        >
          {t("calendarSheet.confirmSwap")}
        </button>
      )}
    </div>
  );

  // ── Move Plan View ──
  const renderMovePlanView = () => (
    <div className="px-4 pb-6">
      <NavBack onClick={() => setView("main")} label={t("calendarSheet.back")} />
      <h3 className="text-[15px] font-bold mb-1" style={{ color: "var(--text-color)" }}>{t("calendarSheet.movePlan")}</h3>
      <p className="text-[13px] mb-4" style={{ color: "var(--text-secondary)" }}>{t("calendarSheet.movePlanHint")}</p>
      <div className="grid grid-cols-2 gap-2">
        {[-2, -1, 1, 2].map((offset) => (
          <button key={offset} onClick={() => { hapticLight(); onMovePlan(event.id, offset); handleClose(); }}
            className="flex flex-col items-center gap-1.5 py-5 rounded-2xl active:scale-[0.96] transition-transform"
            style={{ backgroundColor: "var(--button-bg)", border: "1px solid var(--border-color)" }}>
            <ArrowUpDown size={18} style={{ color: offset < 0 ? "#FF9500" : "#007AFF", transform: offset < 0 ? "scaleY(-1)" : "none" }} />
            <span className="text-[15px] font-bold" style={{ color: "var(--text-color)" }}>
              {offset > 0 ? `+${offset}` : offset} {Math.abs(offset) === 1 ? t("calendarSheet.day") : t("calendarSheet.days")}
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  // ── Replace with Template View ──
  const renderReplaceTemplateView = () => (
    <div className="px-4 pb-6">
      <NavBack onClick={() => setView("main")} label={t("calendarSheet.back")} />
      <h3 className="text-[15px] font-bold mb-1" style={{ color: "var(--text-color)" }}>{t("calendarSheet.replaceTemplate")}</h3>
      <p className="text-[13px] mb-4" style={{ color: "var(--text-secondary)" }}>{t("calendarSheet.replaceTemplateHint")}</p>

      {templates.length === 0 ? (
        <div className="rounded-2xl py-8 flex flex-col items-center gap-2" style={{ border: "1px dashed var(--border-color)" }}>
          <Dumbbell size={24} style={{ color: "var(--text-secondary)" }} />
          <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>{t("calendarSheet.noTemplates")}</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
          {templates.map((tpl, i) => {
            const tplType: ExerciseType = tpl.sportType === "gym" ? "strength" : tpl.sportType === "laufen" ? "run" : tpl.sportType === "radfahren" ? "cycle" : "custom";
            const exCount = tpl.exercises?.length ?? 0;
            return (
              <React.Fragment key={tpl.id}>
                {i > 0 && <RowDivider />}
                <button
                  onClick={() => { hapticLight(); onReplaceWithTemplate(event.id, tpl); handleClose(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 active:bg-[var(--button-bg)] transition-colors"
                >
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(0,122,255,0.1)", color: "#007AFF" }}>
                    {sportIconNode(tplType, 14)}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[14px] font-semibold truncate" style={{ color: "var(--text-color)" }}>{tpl.title}</p>
                    {exCount > 0 && <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{exCount} {t("calendarSheet.exercises")}</p>}
                  </div>
                  <ChevronRight size={16} style={{ color: "var(--text-secondary)", opacity: 0.5 }} />
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── Log Workout View ──
  const renderLogWorkoutView = () => {
    const handleSubmit = () => {
      hapticSuccess();
      const log: ManualWorkoutLog = {
        durationMin: logDuration,
        exerciseCount: logExerciseCount,
        setCount: logSetCount,
        volumeKg: logVolumeKg,
        sport: event.type === "strength" ? "Gym" : event.type === "run" ? "Laufen" : event.type === "cycle" ? "Radfahren" : "Custom",
      };
      onMarkCompleted(event, log);
      handleClose();
    };

    return (
      <div className="px-4 pb-6">
        <NavBack onClick={() => setView("main")} label={t("calendarSheet.back")} />
        <h3 className="text-[15px] font-bold mb-4" style={{ color: "var(--text-color)" }}>{t("calendarSheet.logWorkout")}</h3>

        <div className="rounded-2xl overflow-hidden mb-4" style={{ border: "1px solid var(--border-color)" }}>
          {/* Duration */}
          <div className="flex items-center justify-between px-4 py-3.5">
            <div className="flex items-center gap-2">
              <Clock size={16} style={{ color: "var(--text-secondary)" }} />
              <span className="text-[15px] font-medium" style={{ color: "var(--text-color)" }}>{t("calendarSheet.duration")}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setLogDuration((d) => Math.max(5, d - 5))}
                className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-90"
                style={{ backgroundColor: "var(--button-bg)" }}>
                <Minus size={14} style={{ color: "var(--text-color)" }} />
              </button>
              <input type="number" inputMode="numeric" value={logDuration}
                onChange={(e) => setLogDuration(Math.max(1, parseInt(e.target.value) || 0))}
                className="w-14 text-center rounded-lg py-1.5 text-[15px] font-bold"
                style={{ backgroundColor: "var(--button-bg)", color: "var(--text-color)" }} />
              <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>min</span>
              <button onClick={() => setLogDuration((d) => d + 5)}
                className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-90"
                style={{ backgroundColor: "var(--button-bg)" }}>
                <Plus size={14} style={{ color: "var(--text-color)" }} />
              </button>
            </div>
          </div>

          <div style={{ height: 1, backgroundColor: "var(--border-color)" }} />

          {/* Exercise count */}
          <div className="flex items-center justify-between px-4 py-3.5">
            <div className="flex items-center gap-2">
              <Dumbbell size={16} style={{ color: "var(--text-secondary)" }} />
              <span className="text-[15px] font-medium" style={{ color: "var(--text-color)" }}>{t("calendarSheet.exercises")}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setLogExerciseCount((c) => Math.max(1, c - 1))}
                className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-90"
                style={{ backgroundColor: "var(--button-bg)" }}>
                <Minus size={14} style={{ color: "var(--text-color)" }} />
              </button>
              <input type="number" inputMode="numeric" value={logExerciseCount}
                onChange={(e) => setLogExerciseCount(Math.max(1, parseInt(e.target.value) || 0))}
                className="w-14 text-center rounded-lg py-1.5 text-[15px] font-bold"
                style={{ backgroundColor: "var(--button-bg)", color: "var(--text-color)" }} />
              <button onClick={() => setLogExerciseCount((c) => c + 1)}
                className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-90"
                style={{ backgroundColor: "var(--button-bg)" }}>
                <Plus size={14} style={{ color: "var(--text-color)" }} />
              </button>
            </div>
          </div>

          <div style={{ height: 1, backgroundColor: "var(--border-color)" }} />

          {/* Set count */}
          <div className="flex items-center justify-between px-4 py-3.5">
            <span className="text-[15px] font-medium" style={{ color: "var(--text-color)" }}>{t("calendarSheet.sets")}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setLogSetCount((c) => Math.max(1, c - 1))}
                className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-90"
                style={{ backgroundColor: "var(--button-bg)" }}>
                <Minus size={14} style={{ color: "var(--text-color)" }} />
              </button>
              <input type="number" inputMode="numeric" value={logSetCount}
                onChange={(e) => setLogSetCount(Math.max(1, parseInt(e.target.value) || 0))}
                className="w-14 text-center rounded-lg py-1.5 text-[15px] font-bold"
                style={{ backgroundColor: "var(--button-bg)", color: "var(--text-color)" }} />
              <button onClick={() => setLogSetCount((c) => c + 1)}
                className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-90"
                style={{ backgroundColor: "var(--button-bg)" }}>
                <Plus size={14} style={{ color: "var(--text-color)" }} />
              </button>
            </div>
          </div>

          <div style={{ height: 1, backgroundColor: "var(--border-color)" }} />

          {/* Volume */}
          <div className="flex items-center justify-between px-4 py-3.5">
            <div>
              <span className="text-[15px] font-medium" style={{ color: "var(--text-color)" }}>{t("calendarSheet.totalVolume")}</span>
              <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{t("calendarSheet.totalVolumeHint")}</p>
            </div>
            <div className="flex items-center gap-2">
              <input type="number" inputMode="numeric" value={logVolumeKg || ""}
                onChange={(e) => setLogVolumeKg(Math.max(0, parseInt(e.target.value) || 0))}
                placeholder="–"
                className="w-20 text-center rounded-lg py-1.5 text-[15px] font-bold"
                style={{ backgroundColor: "var(--button-bg)", color: "var(--text-color)" }} />
              <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>kg</span>
            </div>
          </div>
        </div>

        <button onClick={handleSubmit}
          className="w-full py-3.5 rounded-2xl text-[15px] font-bold active:scale-[0.97] transition-transform"
          style={{ backgroundColor: "#34C759", color: "#fff" }}>
          {t("calendarSheet.saveAndComplete")}
        </button>
      </div>
    );
  };

  return (
    <BottomSheet open={open} onClose={handleClose} height="82dvh" maxHeight="88dvh">
      {view === "main" && renderMainView()}
      {view === "move" && renderMoveView()}
      {view === "swap" && renderSwapView()}
      {view === "movePlan" && renderMovePlanView()}
      {view === "replaceTemplate" && renderReplaceTemplateView()}
      {view === "logWorkout" && renderLogWorkoutView()}
    </BottomSheet>
  );
}

// ── Shared sub-components ──

function Row({ icon, label, labelColor, hideChevron, onClick }: {
  icon: React.ReactNode; label: string; labelColor?: string; hideChevron?: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3 active:bg-[var(--button-bg)] transition-colors">
      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(0,122,255,0.1)", color: "#007AFF" }}>{icon}</div>
      <span className="text-[15px] font-medium flex-1 text-left" style={{ color: labelColor ?? "var(--text-color)" }}>{label}</span>
      {!hideChevron && <ChevronRight size={16} style={{ color: "var(--text-secondary)", opacity: 0.5 }} />}
    </button>
  );
}

function RowDivider() { return <div className="ml-[60px]" style={{ height: 1, backgroundColor: "var(--border-color)" }} />; }

function NavBack({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={() => { hapticLight(); onClick(); }} className="flex items-center gap-1 mb-4 active:opacity-70" style={{ color: "#007AFF" }}>
      <ChevronLeft size={18} /><span className="text-[15px] font-medium">{label}</span>
    </button>
  );
}
