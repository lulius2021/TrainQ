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
} from "lucide-react";

import { parseISODateLocal } from "../utils/calendarGeneration";
import { useI18n } from "../i18n/useI18n";
import { useLiveTrainingStore } from "../store/useLiveTrainingStore";
import { getScopedItem } from "../utils/scopedStorage";
import { getActiveUserId } from "../utils/session";
import type { CalendarEvent, ExerciseType } from "../types";
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
}

// ── Helpers ──

function getEventDotColor(event: CalendarEvent): string {
    const t = event.title?.toLowerCase() || "";
    if (t.includes("quick")) return "#EAB308";
    if (t.includes("power")) return "#A855F7";
    if (t.includes("focus")) return "#2563EB";
    if (t.includes("custom")) return "#F97316";
    switch (event.type) {
        case "strength": return "#007AFF";
        case "run": return "#FF3B30";
        case "cycle": return "#34C759";
        default: return "#8E8E93";
    }
}

function getEventIconColor(type: ExerciseType): { color: string; bg: string } {
    switch (type) {
        case "strength": return { color: "#007AFF", bg: "rgba(0,122,255,0.1)" };
        case "run": return { color: "#FF3B30", bg: "rgba(255,59,48,0.1)" };
        case "cycle": return { color: "#34C759", bg: "rgba(52,199,89,0.1)" };
        case "custom": return { color: "#FF9500", bg: "rgba(255,149,0,0.1)" };
        default: return { color: "#8E8E93", bg: "rgba(142,142,147,0.1)" };
    }
}

function getEventIcon(type: ExerciseType) {
    switch (type) {
        case "strength": return <Dumbbell size={18} />;
        case "run": return <Footprints size={18} />;
        case "cycle": return <Bike size={18} />;
        case "custom": return <Sparkles size={18} />;
        default: return <Dumbbell size={18} />;
    }
}

function sportLabel(type: ExerciseType, t: (key: string) => string): string {
    switch (type) {
        case "strength": return t("calendar.sport.gym");
        case "run": return t("calendar.sport.running");
        case "cycle": return t("calendar.sport.cycling");
        case "custom": return t("calendar.sport.custom");
        default: return t("calendar.sport.training");
    }
}

// ── Main ──

export default function CalendarPage() {
    const { t } = useI18n();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [view, setView] = useState<"day" | "week" | "month">("month");
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [deloadPlan, setDeloadPlan] = useState<DeloadPlan | null>(null);

    // Swipe
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);

    const isInDeloadRange = (day: Date): boolean => {
        if (!deloadPlan) return false;
        const dayISO = format(day, "yyyy-MM-dd");
        return dayISO >= deloadPlan.startISO && dayISO <= deloadPlan.endISO;
    };

    // ── Load ──
    const loadEvents = () => {
        const userId = getActiveUserId() || "user";
        const raw = getScopedItem("trainq_calendar_events", userId);
        if (!raw) {
            setEvents([]);
            return;
        }
        try {
            const coreEvents: CoreEvent[] = JSON.parse(raw);
            if (!Array.isArray(coreEvents)) {
                setEvents([]);
                return;
            }
            const parsed: CalendarEvent[] = [];
            for (const e of coreEvents) {
                if (!e.date) continue;
                const dateStr = String(e.date);
                const parsedDate = parseISODateLocal(dateStr);
                if (isNaN(parsedDate.getTime())) continue;

                let type: ExerciseType = "custom";
                if (e.trainingType === "gym") type = "strength";
                else if (e.trainingType === "laufen") type = "run";
                else if (e.trainingType === "radfahren") type = "cycle";

                parsed.push({
                    id: e.id,
                    date: parsedDate,
                    title: e.title || "",
                    type,
                    duration: 0,
                    intensity: "medium",
                    workoutData: e.workoutData,
                    status: e.trainingStatus === "completed" ? "completed" : "planned",
                });
            }
            setEvents(parsed);
        } catch {
            setEvents([]);
        }
    };

    useEffect(() => {
        loadEvents();
        try {
            const plan = readDeloadPlan(getActiveUserId());
            setDeloadPlan(plan);
        } catch { /* ignore */ }

        // Listen for explicit update events
        window.addEventListener("trainq:update_events", loadEvents);

        // Reload events when tab becomes visible (e.g. after switching from Plan tab)
        const onVisibility = () => {
            if (document.visibilityState === "visible") loadEvents();
        };
        document.addEventListener("visibilitychange", onVisibility);

        // Also reload on focus (covers tab switches within the app)
        window.addEventListener("focus", loadEvents);

        return () => {
            window.removeEventListener("trainq:update_events", loadEvents);
            document.removeEventListener("visibilitychange", onVisibility);
            window.removeEventListener("focus", loadEvents);
        };
    }, []);

    // ── Navigation ──
    const handleNext = () => {
        if (view === "day") {
            const d = addDays(currentDate, 1);
            setCurrentDate(d);
            setSelectedDate(d);
        } else if (view === "week") {
            setCurrentDate(addWeeks(currentDate, 1));
        } else {
            setCurrentDate(addMonths(currentDate, 1));
        }
    };

    const handlePrev = () => {
        if (view === "day") {
            const d = subDays(currentDate, 1);
            setCurrentDate(d);
            setSelectedDate(d);
        } else if (view === "week") {
            setCurrentDate(subWeeks(currentDate, 1));
        } else {
            setCurrentDate(subMonths(currentDate, 1));
        }
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

    // ── Start Workout ──
    const handleStartTraining = (event: CalendarEvent) => {
        const wd = event.workoutData;
        if (!wd?.exercises) return;
        const liveWorkout = {
            id: crypto.randomUUID(),
            calendarEventId: event.id,
            title: event.title,
            sport: event.type === "strength" ? "Gym" : event.type === "run" ? "Laufen" : event.type === "cycle" ? "Radfahren" : "Custom",
            startedAt: new Date().toISOString(),
            isActive: true,
            exercises: wd.exercises,
        };
        useLiveTrainingStore.getState().startWorkout(liveWorkout as any);
        window.dispatchEvent(new CustomEvent("trainq:navigate", { detail: { path: "/live-training", eventId: liveWorkout.id } }));
    };

    // ── Selected day events ──
    const selectedEvents = events.filter((e) => isSameDay(e.date, selectedDate));

    // ── Renderers ──

    const renderMonthView = () => {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(monthStart);
        const start = startOfWeek(monthStart, { weekStartsOn: 1 });
        const end = endOfWeek(monthEnd, { weekStartsOn: 1 });
        const days = eachDayOfInterval({ start, end });
        const weekDays = [t("calendar.weekday.mo"), t("calendar.weekday.tu"), t("calendar.weekday.we"), t("calendar.weekday.th"), t("calendar.weekday.fr"), t("calendar.weekday.sa"), t("calendar.weekday.su")];

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
                        const hasEvents = dayEvents.length > 0;
                        const hasCompleted = dayEvents.some(ev => ev.status === "completed");
                        const isDeload = isInDeloadRange(day);

                        return (
                            <button
                                key={day.toISOString()}
                                onClick={() => setSelectedDate(day)}
                                className="flex flex-col items-center justify-center py-1 relative"
                                style={{ opacity: inMonth ? 1 : 0.3 }}
                            >
                                <div
                                    className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
                                    style={{
                                        backgroundColor: isSelected
                                            ? "#007AFF"
                                            : hasCompleted
                                                ? "rgba(52,199,89,0.2)"
                                                : isTodayDay
                                                    ? "rgba(0,122,255,0.1)"
                                                    : isDeload
                                                        ? "rgba(52,199,89,0.08)"
                                                        : "transparent",
                                        border: isTodayDay && !isSelected ? "2px solid #007AFF" : "2px solid transparent",
                                    }}
                                >
                                    <span
                                        className={`text-[13px] ${isSelected || isTodayDay ? "font-bold" : "font-medium"}`}
                                        style={{
                                            color: isSelected
                                                ? "#FFFFFF"
                                                : hasCompleted
                                                    ? "#34C759"
                                                    : isTodayDay
                                                        ? "#007AFF"
                                                        : "var(--text-color)",
                                        }}
                                    >
                                        {format(day, "d")}
                                    </span>
                                </div>
                                {/* Event dots */}
                                <div className="flex gap-[3px] mt-0.5 h-[5px]">
                                    {hasEvents
                                        ? dayEvents.slice(0, 3).map((ev, i) => (
                                            <div
                                                key={i}
                                                className="w-[5px] h-[5px] rounded-full"
                                                style={{
                                                    backgroundColor: isSelected ? "#007AFF" : getEventDotColor(ev),
                                                }}
                                            />
                                        ))
                                        : null}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderWeekView = () => {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        const days = eachDayOfInterval({ start, end: addDays(start, 6) });
        const weekDays = [t("calendar.weekday.mo"), t("calendar.weekday.tu"), t("calendar.weekday.we"), t("calendar.weekday.th"), t("calendar.weekday.fr"), t("calendar.weekday.sa"), t("calendar.weekday.su")];

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
                        const hasEvent = events.some((e) => isSameDay(e.date, day));

                        return (
                            <button
                                key={day.toISOString()}
                                onClick={() => setSelectedDate(day)}
                                className="flex flex-col items-center py-2 rounded-2xl transition-all active:scale-95"
                                style={{
                                    backgroundColor: isSelected
                                        ? "#007AFF"
                                        : isTodayDay
                                            ? "rgba(0,122,255,0.1)"
                                            : "var(--button-bg)",
                                    border: isTodayDay && !isSelected ? "2px solid #007AFF" : "2px solid transparent",
                                }}
                            >
                                <span
                                    className={`text-base ${isSelected || isTodayDay ? "font-bold" : "font-medium"}`}
                                    style={{
                                        color: isSelected ? "#FFFFFF" : isTodayDay ? "#007AFF" : "var(--text-color)",
                                    }}
                                >
                                    {format(day, "d")}
                                </span>
                                {hasEvent && (
                                    <div
                                        className="w-[5px] h-[5px] rounded-full mt-1"
                                        style={{ backgroundColor: isSelected ? "#FFFFFF" : "#007AFF" }}
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderDayView = () => (
        <div className="flex flex-col items-center py-5">
            <span
                className="text-xs font-semibold uppercase tracking-widest mb-1"
                style={{ color: "var(--text-secondary)" }}
            >
                {format(currentDate, "EEEE", { locale: de })}
            </span>
            <div className="flex items-center gap-5">
                <button
                    onClick={handlePrev}
                    className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                    style={{ backgroundColor: "var(--button-bg)", color: "var(--text-secondary)" }}
                >
                    <ChevronLeft size={18} />
                </button>
                <div
                    className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{
                        backgroundColor: isToday(currentDate) ? "#007AFF" : "var(--button-bg)",
                    }}
                >
                    <span
                        className="text-3xl font-bold"
                        style={{ color: isToday(currentDate) ? "#FFFFFF" : "var(--text-color)" }}
                    >
                        {format(currentDate, "d")}
                    </span>
                </div>
                <button
                    onClick={handleNext}
                    className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                    style={{ backgroundColor: "var(--button-bg)", color: "var(--text-secondary)" }}
                >
                    <ChevronRight size={18} />
                </button>
            </div>
            <span className="text-sm font-semibold mt-1" style={{ color: "#007AFF" }}>
                {format(currentDate, "MMMM yyyy", { locale: de })}
            </span>
        </div>
    );

    // ── Event Card ──
    const renderEventCard = (event: CalendarEvent) => {
        const { color, bg } = getEventIconColor(event.type);
        const eventIsDeload = isInDeloadRange(event.date);

        return (
            <button
                key={event.id}
                onClick={() => handleStartTraining(event)}
                className="w-full rounded-2xl p-4 border flex items-center gap-4 text-left active:scale-[0.98] transition-transform"
                style={{
                    backgroundColor: "var(--card-bg)",
                    borderColor: eventIsDeload ? "rgba(52,199,89,0.3)" : "var(--border-color)",
                }}
            >
                <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: bg, color }}
                >
                    {getEventIcon(event.type)}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h4
                            className="text-[15px] font-bold truncate"
                            style={{ color: "var(--text-color)" }}
                        >
                            {event.title}
                        </h4>
                        {eventIsDeload && <DeloadWeekBadge />}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                        {sportLabel(event.type, t)}
                        {event.status === "completed" && ` · ${t("calendar.completed")}`}
                    </p>
                </div>
                <ChevronRight size={16} style={{ color: "var(--text-secondary)" }} className="shrink-0" />
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
                {/* Today button */}
                <div className="px-4 pt-2 pb-2 flex items-center justify-end">
                    <button
                        onClick={goToToday}
                        className="px-3.5 py-1.5 rounded-full text-[13px] font-semibold active:scale-95 transition-transform"
                        style={{ backgroundColor: "rgba(0,122,255,0.1)", color: "#007AFF" }}
                    >
                        {t("calendar.today")}
                    </button>
                </div>

                {/* Segmented Control */}
                <div className="px-4 pb-2.5">
                    <div
                        className="rounded-lg p-0.5 flex"
                        style={{ backgroundColor: "var(--button-bg)" }}
                    >
                        {(["day", "week", "month"] as const).map((v) => (
                            <button
                                key={v}
                                onClick={() => setView(v)}
                                className={`flex-1 py-1.5 text-[13px] font-semibold rounded-md transition-all ${
                                    view === v ? "shadow-sm" : ""
                                }`}
                                style={{
                                    backgroundColor: view === v ? "var(--card-bg)" : "transparent",
                                    color: view === v ? "var(--text-color)" : "var(--text-secondary)",
                                }}
                            >
                                {v === "day" ? t("calendar.view.day") : v === "week" ? t("calendar.view.week") : t("calendar.view.month")}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Month/Week navigation */}
                {view !== "day" && (
                    <div className="flex items-center justify-between px-4 pb-2">
                        <button
                            onClick={handlePrev}
                            className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                            style={{ color: "#007AFF" }}
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <span className="text-[15px] font-semibold" style={{ color: "var(--text-color)" }}>
                            {format(currentDate, "MMMM yyyy", { locale: de })}
                        </span>
                        <button
                            onClick={handleNext}
                            className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                            style={{ color: "#007AFF" }}
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                )}
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
                {view === "day" && renderDayView()}
            </div>

            {/* ── Divider ── */}
            <div className="mx-4 border-b" style={{ borderColor: "var(--border-color)" }} />

            {/* ── Events for selected day ── */}
            <div className="px-4 pt-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[13px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                        {isToday(selectedDate)
                            ? t("calendar.today")
                            : format(selectedDate, "EEEE, d. MMMM", { locale: de })}
                    </h3>
                    {selectedEvents.length > 0 && (
                        <span
                            className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: "rgba(0,122,255,0.1)", color: "#007AFF" }}
                        >
                            {selectedEvents.length}
                        </span>
                    )}
                </div>

                {selectedEvents.length === 0 ? (
                    <div
                        className="rounded-2xl border border-dashed py-10 flex flex-col items-center gap-2"
                        style={{
                            borderColor: "var(--border-color)",
                            backgroundColor: "var(--card-bg)",
                        }}
                    >
                        <div
                            className="w-10 h-10 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: "var(--button-bg)" }}
                        >
                            <CalendarIcon size={18} style={{ color: "var(--text-secondary)" }} />
                        </div>
                        <p className="text-[13px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                            {t("calendar.noTraining")}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {selectedEvents.map(renderEventCard)}
                    </div>
                )}
            </div>
        </div>
    );
}
