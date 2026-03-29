// src/pages/CalendarPage.tsx
import React, { useState, useEffect } from "react";
import {
    format,
    addDays,
    subDays,
    startOfWeek,
    endOfWeek,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    isSameDay,
    isToday,
    isSameMonth,
    addMonths,
    subMonths,
    subWeeks,
    addWeeks,
} from "date-fns";
import { de } from "date-fns/locale";
import {
    ChevronLeft,
    ChevronRight,
    Dumbbell,
    Footprints,
    Bike,
    Sparkles,
    Calendar as CalendarIcon,
    Check,
    Clock,
} from "lucide-react";

import { parseISODateLocal } from "../utils/calendarGeneration";
import { profileAccent } from "../utils/adaptiveScoring";
import { useI18n } from "../i18n/useI18n";
import { useLiveTrainingStore } from "../store/useLiveTrainingStore";
import { getScopedItem } from "../utils/scopedStorage";
import { getActiveUserId } from "../utils/session";
import type { CalendarEvent, ExerciseType } from "../types";
import type { WorkoutHistoryEntry } from "../utils/workoutHistory";
import type { DeloadPlan } from "../types/deload";
import { readDeloadPlan } from "../utils/deload/storage";
import DeloadWeekBadge from "../components/deload/DeloadWeekBadge";

interface CoreEvent {
    id: string;
    userId: string;
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    type: string;
    trainingType?: "gym" | "laufen" | "radfahren" | "custom";
    trainingStatus: "planned" | "completed" | "skipped" | "open";
    description?: string;
    workoutData?: any;
    adaptiveAppliedAt?: string;
    adaptiveReasons?: string[];
    adaptiveProfile?: string;
}

type LocalCalendarEvent = CalendarEvent & {
    adaptiveProfile?: string;
    durationSec?: number;
    exerciseCount?: number;
    distanceKm?: number;
    fromHistory?: boolean;
};

// ── Sport colors (consistent with the rest of the app) ──

function sportExerciseType(sport: string): ExerciseType {
    const s = sport.toLowerCase();
    if (s === "gym") return "strength";
    if (s === "laufen") return "run";
    if (s === "radfahren") return "cycle";
    return "custom";
}

function getEventIconColor(type: ExerciseType): { color: string; bg: string } {
    switch (type) {
        case "strength": return { color: "#007AFF", bg: "rgba(0,122,255,0.12)" };
        case "run":      return { color: "#34C759", bg: "rgba(52,199,89,0.12)" };
        case "cycle":    return { color: "#FF9500", bg: "rgba(255,149,0,0.12)" };
        case "custom":   return { color: "#AF52DE", bg: "rgba(175,82,222,0.12)" };
        default:         return { color: "#8E8E93", bg: "rgba(142,142,147,0.12)" };
    }
}

function getEventDotColor(type: ExerciseType): string {
    switch (type) {
        case "strength": return "#007AFF";
        case "run":      return "#34C759";
        case "cycle":    return "#FF9500";
        case "custom":   return "#AF52DE";
        default:         return "#8E8E93";
    }
}

function getEventIcon(type: ExerciseType) {
    switch (type) {
        case "strength": return <Dumbbell size={18} />;
        case "run":      return <Footprints size={18} />;
        case "cycle":    return <Bike size={18} />;
        case "custom":   return <Sparkles size={18} />;
        default:         return <Dumbbell size={18} />;
    }
}

function sportLabel(type: ExerciseType): string {
    switch (type) {
        case "strength": return "Gym · Kraft";
        case "run":      return "Laufen · Cardio";
        case "cycle":    return "Radfahren · Cardio";
        case "custom":   return "Custom";
        default:         return "Training";
    }
}

function formatDuration(sec: number): string {
    const m = Math.round(sec / 60);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem === 0 ? `${h} h` : `${h} h ${rem} min`;
}

// ── Main ──

export default function CalendarPage() {
    const { t } = useI18n();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [view, setView] = useState<"week" | "month">("month");
    const [events, setEvents] = useState<LocalCalendarEvent[]>([]);
    const [deloadPlan, setDeloadPlan] = useState<DeloadPlan | null>(null);

    // Swipe
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);

    const isInDeloadRange = (day: Date): boolean => {
        if (!deloadPlan) return false;
        const dayISO = format(day, "yyyy-MM-dd");
        return dayISO >= deloadPlan.startISO && dayISO <= deloadPlan.endISO;
    };

    // ── Load: merge planned calendar events + workout history ──
    const loadEvents = () => {
        const userId = getActiveUserId() || "user";
        const merged: LocalCalendarEvent[] = [];
        const calendarEventIds = new Set<string>();

        // 1. Planned calendar events
        const rawCalendar = getScopedItem("trainq_calendar_events", userId);
        if (rawCalendar) {
            try {
                const coreEvents: CoreEvent[] = JSON.parse(rawCalendar);
                if (Array.isArray(coreEvents)) {
                    for (const e of coreEvents) {
                        if (!e.date) continue;
                        const parsedDate = parseISODateLocal(String(e.date));
                        if (isNaN(parsedDate.getTime())) continue;

                        let type: ExerciseType = "custom";
                        if (e.trainingType === "gym") type = "strength";
                        else if (e.trainingType === "laufen") type = "run";
                        else if (e.trainingType === "radfahren") type = "cycle";

                        calendarEventIds.add(e.id);
                        merged.push({
                            id: e.id,
                            date: parsedDate,
                            title: e.title || "",
                            type,
                            duration: 0,
                            intensity: "medium",
                            workoutData: e.workoutData,
                            status: e.trainingStatus === "completed" ? "completed" : "planned",
                            adaptiveProfile: e.adaptiveProfile,
                        });
                    }
                }
            } catch { /* ignore */ }
        }

        // 2. Completed workouts from history (show free/template workouts)
        const rawHistory = getScopedItem("trainq_workout_history_v1", userId);
        if (rawHistory) {
            try {
                const entries: WorkoutHistoryEntry[] = JSON.parse(rawHistory);
                if (Array.isArray(entries)) {
                    for (const entry of entries) {
                        // Skip if already represented via a calendar event
                        if (entry.calendarEventId && calendarEventIds.has(entry.calendarEventId)) continue;

                        const dateStr = entry.startedAt || entry.endedAt;
                        if (!dateStr) continue;
                        const date = new Date(dateStr);
                        if (isNaN(date.getTime())) continue;

                        const type = sportExerciseType(entry.sport || "");

                        merged.push({
                            id: entry.id,
                            date,
                            title: entry.title || "Training",
                            type,
                            duration: Math.round((entry.durationSec || 0) / 60),
                            intensity: "medium",
                            workoutData: null,
                            status: "completed",
                            durationSec: entry.durationSec,
                            exerciseCount: entry.exercises?.length ?? 0,
                            distanceKm: entry.distanceKm,
                            fromHistory: true,
                        });
                    }
                }
            } catch { /* ignore */ }
        }

        setEvents(merged);
    };

    useEffect(() => {
        loadEvents();
        try {
            const plan = readDeloadPlan(getActiveUserId());
            setDeloadPlan(plan);
        } catch { /* ignore */ }

        window.addEventListener("trainq:update_events", loadEvents);
        window.addEventListener("trainq:workoutHistoryUpdated", loadEvents);

        const onVisibility = () => {
            if (document.visibilityState === "visible") loadEvents();
        };
        document.addEventListener("visibilitychange", onVisibility);
        window.addEventListener("focus", loadEvents);

        return () => {
            window.removeEventListener("trainq:update_events", loadEvents);
            window.removeEventListener("trainq:workoutHistoryUpdated", loadEvents);
            document.removeEventListener("visibilitychange", onVisibility);
            window.removeEventListener("focus", loadEvents);
        };
    }, []);

    // ── Navigation ──
    const handleNext = () => {
        if (view === "week") setCurrentDate(addWeeks(currentDate, 1));
        else setCurrentDate(addMonths(currentDate, 1));
    };

    const handlePrev = () => {
        if (view === "week") setCurrentDate(subWeeks(currentDate, 1));
        else setCurrentDate(subMonths(currentDate, 1));
    };

    const goToToday = () => {
        const now = new Date();
        setSelectedDate(now);
        setCurrentDate(now);
    };

    // ── Swipe ──
    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };
    const onTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);
    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const dist = touchStart - touchEnd;
        if (dist > 50) handleNext();
        else if (dist < -50) handlePrev();
    };

    // ── Start Workout (from planned calendar event) ──
    const handleStartTraining = (event: LocalCalendarEvent) => {
        if (event.fromHistory || !event.workoutData?.exercises) return;
        const liveWorkout = {
            id: crypto.randomUUID(),
            calendarEventId: event.id,
            title: event.title,
            sport: event.type === "strength" ? "Gym" : event.type === "run" ? "Laufen" : event.type === "cycle" ? "Radfahren" : "Custom",
            startedAt: new Date().toISOString(),
            isActive: true,
            exercises: event.workoutData.exercises,
        };
        useLiveTrainingStore.getState().startWorkout(liveWorkout as any);
        window.dispatchEvent(new CustomEvent("trainq:navigate", { detail: { path: "/live-training", eventId: liveWorkout.id } }));
    };

    // ── Selected day events ──
    const selectedEvents = events.filter((e) => isSameDay(e.date, selectedDate));

    // ── Month View ──
    const renderMonthView = () => {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(monthStart);
        const start = startOfWeek(monthStart, { weekStartsOn: 1 });
        const end = endOfWeek(monthEnd, { weekStartsOn: 1 });
        const days = eachDayOfInterval({ start, end });
        const weekDays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

        return (
            <div className="px-4 pt-2 pb-3">
                <div className="grid grid-cols-7 mb-1">
                    {weekDays.map((d) => (
                        <div
                            key={d}
                            className="text-center text-[10px] font-semibold uppercase tracking-wider py-1"
                            style={{ color: "var(--text-secondary)" }}
                        >
                            {d}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7">
                    {days.map((day) => {
                        const isSelected = isSameDay(day, selectedDate);
                        const isTodayDay = isToday(day);
                        const inMonth = isSameMonth(day, currentDate);
                        const dayEvents = events.filter((e) => isSameDay(e.date, day));
                        const hasCompleted = dayEvents.some((ev) => ev.status === "completed");
                        const isDeload = isInDeloadRange(day);
                        const adaptiveEvent = dayEvents.find((ev) => ev.adaptiveProfile);
                        const accent = adaptiveEvent ? profileAccent(adaptiveEvent.adaptiveProfile!) : null;
                        const sportTypes = [...new Set(dayEvents.map((ev) => ev.type))].slice(0, 3);

                        return (
                            <button
                                key={day.toISOString()}
                                onClick={() => setSelectedDate(day)}
                                className="flex flex-col items-center justify-center py-1 relative"
                                style={{ opacity: inMonth ? 1 : 0.28 }}
                            >
                                <div
                                    className="w-9 h-9 rounded-full flex items-center justify-center transition-all relative"
                                    style={{
                                        backgroundColor: isSelected
                                            ? accent ? accent.solid : "#007AFF"
                                            : accent
                                                ? accent.bg
                                                : hasCompleted
                                                    ? "rgba(52,199,89,0.15)"
                                                    : isTodayDay
                                                        ? "rgba(0,122,255,0.1)"
                                                        : isDeload
                                                            ? "rgba(52,199,89,0.06)"
                                                            : "transparent",
                                        border: isSelected
                                            ? "2px solid transparent"
                                            : accent
                                                ? `2px solid ${accent.border}`
                                                : isTodayDay
                                                    ? "2px solid #007AFF"
                                                    : "2px solid transparent",
                                    }}
                                >
                                    <span
                                        className={`text-[13px] ${isSelected || isTodayDay ? "font-bold" : "font-medium"}`}
                                        style={{
                                            color: isSelected
                                                ? "#FFFFFF"
                                                : accent
                                                    ? accent.solid
                                                    : hasCompleted
                                                        ? "#34C759"
                                                        : isTodayDay
                                                            ? "#007AFF"
                                                            : "var(--text-color)",
                                        }}
                                    >
                                        {format(day, "d")}
                                    </span>
                                    {hasCompleted && !isSelected && (
                                        <div
                                            className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                                            style={{ backgroundColor: "#34C759", transform: "translate(30%, 30%)" }}
                                        >
                                            <Check size={8} color="#fff" strokeWidth={3} />
                                        </div>
                                    )}
                                </div>
                                {/* Sport-colored dots */}
                                <div className="flex gap-[3px] mt-0.5 h-[5px]">
                                    {sportTypes.map((type, i) => (
                                        <div
                                            key={i}
                                            className="w-[5px] h-[5px] rounded-full"
                                            style={{
                                                backgroundColor: isSelected
                                                    ? "#FFFFFF"
                                                    : accent
                                                        ? profileAccent(adaptiveEvent!.adaptiveProfile!).solid
                                                        : getEventDotColor(type),
                                            }}
                                        />
                                    ))}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    // ── Week View ──
    const renderWeekView = () => {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        const days = eachDayOfInterval({ start, end: addDays(start, 6) });
        const weekDays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

        return (
            <div className="px-4 pt-2 pb-3">
                <div className="grid grid-cols-7 gap-1">
                    {weekDays.map((d) => (
                        <div
                            key={d}
                            className="text-center text-[10px] font-semibold uppercase tracking-wider pb-1"
                            style={{ color: "var(--text-secondary)" }}
                        >
                            {d}
                        </div>
                    ))}
                    {days.map((day) => {
                        const isSelected = isSameDay(day, selectedDate);
                        const isTodayDay = isToday(day);
                        const dayEvents = events.filter((e) => isSameDay(e.date, day));
                        const hasCompleted = dayEvents.some((ev) => ev.status === "completed");
                        const adaptiveEvent = dayEvents.find((ev) => ev.adaptiveProfile);
                        const accent = adaptiveEvent ? profileAccent(adaptiveEvent.adaptiveProfile!) : null;
                        const sportTypes = [...new Set(dayEvents.map((ev) => ev.type))].slice(0, 3);

                        return (
                            <button
                                key={day.toISOString()}
                                onClick={() => { setSelectedDate(day); setCurrentDate(day); }}
                                className="flex flex-col items-center py-2.5 rounded-2xl transition-all active:scale-95 relative gap-1"
                                style={{
                                    backgroundColor: isSelected
                                        ? accent ? accent.solid : "#007AFF"
                                        : accent
                                            ? accent.bg
                                            : isTodayDay
                                                ? "rgba(0,122,255,0.1)"
                                                : "var(--button-bg)",
                                    border: isSelected
                                        ? "2px solid transparent"
                                        : accent
                                            ? `2px solid ${accent.border}`
                                            : isTodayDay
                                                ? "2px solid #007AFF"
                                                : "2px solid transparent",
                                }}
                            >
                                <span
                                    className={`text-[15px] leading-none ${isSelected || isTodayDay ? "font-bold" : "font-medium"}`}
                                    style={{
                                        color: isSelected
                                            ? "#FFFFFF"
                                            : accent
                                                ? accent.solid
                                                : isTodayDay
                                                    ? "#007AFF"
                                                    : "var(--text-color)",
                                    }}
                                >
                                    {format(day, "d")}
                                </span>
                                {/* Sport dots or check */}
                                <div className="h-[6px] flex items-center gap-[3px]">
                                    {hasCompleted ? (
                                        <Check size={10} color={isSelected ? "#FFFFFF" : "#34C759"} strokeWidth={3} />
                                    ) : sportTypes.length > 0 ? (
                                        sportTypes.map((type, i) => (
                                            <div
                                                key={i}
                                                className="w-[5px] h-[5px] rounded-full"
                                                style={{
                                                    backgroundColor: isSelected
                                                        ? "#FFFFFF"
                                                        : accent ? accent.solid : getEventDotColor(type),
                                                }}
                                            />
                                        ))
                                    ) : null}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    // ── Event Card ──
    const renderEventCard = (event: LocalCalendarEvent) => {
        const { color, bg } = getEventIconColor(event.type);
        const eventIsDeload = isInDeloadRange(event.date);
        const isCompleted = event.status === "completed";
        const isClickable = !event.fromHistory && !!event.workoutData?.exercises;

        const subtitle = (() => {
            if (isCompleted) {
                const parts: string[] = [sportLabel(event.type)];
                if (event.durationSec && event.durationSec > 0) parts.push(formatDuration(event.durationSec));
                if (event.exerciseCount && event.exerciseCount > 0) parts.push(`${event.exerciseCount} Übungen`);
                if (event.distanceKm && event.distanceKm > 0) parts.push(`${event.distanceKm.toFixed(1)} km`);
                return parts.join(" · ");
            }
            return sportLabel(event.type);
        })();

        return (
            <button
                key={event.id}
                onClick={() => { if (isClickable) handleStartTraining(event); }}
                disabled={!isClickable && !isCompleted}
                className="w-full rounded-2xl p-4 border flex items-center gap-4 text-left active:scale-[0.98] transition-all overflow-hidden relative"
                style={{
                    backgroundColor: "var(--card-bg)",
                    borderColor: eventIsDeload ? "rgba(52,199,89,0.3)" : "var(--border-color)",
                    borderLeftWidth: "3.5px",
                    borderLeftColor: isCompleted ? "#34C759" : color,
                    cursor: isClickable ? "pointer" : "default",
                }}
            >
                {/* Sport Icon */}
                <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                    style={{
                        backgroundColor: isCompleted ? "rgba(52,199,89,0.12)" : bg,
                        color: isCompleted ? "#34C759" : color,
                    }}
                >
                    {isCompleted ? <Check size={18} strokeWidth={2.5} /> : getEventIcon(event.type)}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h4
                            className="text-[15px] font-bold truncate"
                            style={{
                                color: "var(--text-color)",
                                textDecoration: event.status === "skipped" ? "line-through" : "none",
                            }}
                        >
                            {event.title}
                        </h4>
                        {eventIsDeload && <DeloadWeekBadge />}
                    </div>
                    <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-secondary)" }}>
                        {subtitle}
                    </p>
                </div>

                {/* Right: status badge or chevron */}
                {isCompleted ? (
                    <span
                        className="text-[11px] font-bold px-2 py-1 rounded-full shrink-0"
                        style={{ backgroundColor: "rgba(52,199,89,0.12)", color: "#34C759" }}
                    >
                        Erledigt
                    </span>
                ) : isClickable ? (
                    <ChevronRight size={16} style={{ color: "var(--text-secondary)" }} className="shrink-0" />
                ) : null}
            </button>
        );
    };

    // ── Main ──
    return (
        <div
            className="min-h-screen pb-28 transition-colors"
            style={{ backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}
        >
            {/* ── Header ── */}
            <div
                className="sticky top-0 z-40 pt-safe backdrop-blur-xl transition-colors border-b"
                style={{ backgroundColor: "var(--bg-color)", borderColor: "var(--border-color)" }}
            >
                {/* Top row: title + today button */}
                <div className="px-4 pt-2 pb-1 flex items-center justify-between">
                    <span className="text-[17px] font-bold" style={{ color: "var(--text-color)" }}>
                        {format(currentDate, "MMMM yyyy", { locale: de })}
                    </span>
                    <button
                        onClick={goToToday}
                        className="px-3.5 py-1.5 rounded-full text-[13px] font-semibold active:scale-95 transition-transform"
                        style={{ backgroundColor: "rgba(0,122,255,0.1)", color: "#007AFF" }}
                    >
                        Heute
                    </button>
                </div>

                {/* View toggle + nav */}
                <div className="px-4 pb-2.5 flex items-center gap-2">
                    {/* View toggle */}
                    <div
                        className="rounded-xl p-0.5 flex gap-0.5 flex-1"
                        style={{ backgroundColor: "var(--button-bg)" }}
                    >
                        {(["week", "month"] as const).map((v) => (
                            <button
                                key={v}
                                onClick={() => setView(v)}
                                className="flex-1 py-2 text-[13px] font-bold rounded-lg transition-all"
                                style={{
                                    backgroundColor: view === v ? "var(--card-bg)" : "transparent",
                                    color: view === v ? "#007AFF" : "var(--text-secondary)",
                                    boxShadow: view === v ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
                                }}
                            >
                                {v === "week" ? "Woche" : "Monat"}
                            </button>
                        ))}
                    </div>

                    {/* Prev / Next */}
                    <button
                        onClick={handlePrev}
                        className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                        style={{ color: "#007AFF", backgroundColor: "var(--button-bg)" }}
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button
                        onClick={handleNext}
                        className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                        style={{ color: "#007AFF", backgroundColor: "var(--button-bg)" }}
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            {/* ── Calendar Grid ── */}
            <div
                className="touch-pan-y"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                {view === "month" && renderMonthView()}
                {view === "week" && renderWeekView()}
            </div>

            {/* ── Divider ── */}
            <div className="mx-4 border-b" style={{ borderColor: "var(--border-color)" }} />

            {/* ── Events for selected day ── */}
            <div className="px-4 pt-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[15px] font-bold" style={{ color: "var(--text-color)" }}>
                        {isToday(selectedDate)
                            ? "Heute"
                            : format(selectedDate, "EEEE, d. MMMM", { locale: de })}
                    </h3>
                    {selectedEvents.length > 0 && (
                        <span
                            className="text-xs font-bold px-2.5 py-1 rounded-full"
                            style={{ backgroundColor: "rgba(0,122,255,0.12)", color: "#007AFF" }}
                        >
                            {selectedEvents.length}
                        </span>
                    )}
                </div>

                {selectedEvents.length === 0 ? (
                    <div
                        className="rounded-2xl border border-dashed py-10 flex flex-col items-center gap-2.5"
                        style={{ borderColor: "var(--border-color)", backgroundColor: "var(--card-bg)" }}
                    >
                        <div
                            className="w-12 h-12 rounded-2xl flex items-center justify-center"
                            style={{ backgroundColor: "rgba(0,122,255,0.08)" }}
                        >
                            <CalendarIcon size={22} style={{ color: "#007AFF" }} />
                        </div>
                        <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                            Kein Training
                        </p>
                        <p className="text-[12px] text-center px-6" style={{ color: "var(--text-muted, var(--text-secondary))" }}>
                            Plane Trainings im Kalender oder starte ein freies Workout
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {selectedEvents.map(renderEventCard)}
                    </div>
                )}
            </div>

            {/* ── Weekly summary strip ── */}
            <WeekSummaryStrip events={events} selectedDate={selectedDate} />
        </div>
    );
}

// ── Weekly summary strip ──
function WeekSummaryStrip({ events, selectedDate }: { events: LocalCalendarEvent[]; selectedDate: Date }) {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
    const weekEvents = events.filter(
        (e) => e.date >= weekStart && e.date <= weekEnd && e.status === "completed"
    );

    if (weekEvents.length === 0) return null;

    const totalMin = weekEvents.reduce((sum, e) => sum + (e.duration ?? 0), 0);
    const byType = weekEvents.reduce<Record<string, number>>((acc, e) => {
        acc[e.type] = (acc[e.type] ?? 0) + 1;
        return acc;
    }, {});

    return (
        <div className="mx-4 mt-4 mb-2">
            <div
                className="rounded-2xl px-4 py-3 flex items-center gap-4"
                style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border-color)" }}
            >
                <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "rgba(52,199,89,0.12)" }}
                >
                    <Check size={16} color="#34C759" strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold" style={{ color: "var(--text-color)" }}>
                        Diese Woche
                    </p>
                    <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                        {weekEvents.length} {weekEvents.length === 1 ? "Training" : "Trainings"}
                        {totalMin > 0 ? ` · ${formatDuration(totalMin * 60)}` : ""}
                    </p>
                </div>
                {/* Sport-colored dots for the week */}
                <div className="flex gap-1.5 shrink-0">
                    {Object.entries(byType).map(([type, count]) => {
                        const { color } = getEventIconColor(type as ExerciseType);
                        return (
                            <div
                                key={type}
                                className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold"
                                style={{ backgroundColor: getEventIconColor(type as ExerciseType).bg, color }}
                            >
                                {count}×{" "}
                                {type === "strength" ? "💪" : type === "run" ? "🏃" : type === "cycle" ? "🚴" : "⚡"}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
