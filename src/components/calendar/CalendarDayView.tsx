// src/components/calendar/CalendarDayView.tsx
import React, { useLayoutEffect, useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { isToday, format } from "date-fns";
import { de } from "date-fns/locale";
import {
    Dumbbell,
    Footprints,
    Bike,
    Sparkles,
    Check,
    Calendar as CalendarIcon,
} from "lucide-react";
import { useI18n } from "../../i18n/useI18n";
import type { ExerciseType } from "../../types";

// ── Types ──

interface DayViewEvent {
    id: string;
    title: string;
    type: ExerciseType;
    status: "planned" | "completed" | "skipped" | "open";
    /** ISO string or Date – may be undefined for "all-day" */
    startTime?: string | null;
    /** ISO string or Date – may be undefined */
    endTime?: string | null;
    durationSec?: number;
    exerciseCount?: number;
    distanceKm?: number;
    fromHistory?: boolean;
    workoutData?: unknown;
}

interface CalendarDayViewProps {
    selectedDate: Date;
    events: DayViewEvent[];
    onEventPress: (event: DayViewEvent) => void;
}

// ── Constants ──

const DEFAULT_START_HOUR = 7;
const DEFAULT_END_HOUR = 20;
const MIN_HOUR_HEIGHT = 48;
const TIME_COLUMN_WIDTH = 44; // px — matches Apple Calendar narrow time column

// ── Color helpers ──

function getEventColors(type: ExerciseType, isCompleted: boolean): { accent: string; bg: string } {
    if (isCompleted) return { accent: "#34C759", bg: "rgba(52,199,89,0.13)" };
    switch (type) {
        case "strength": return { accent: "#2952E3", bg: "rgba(41,82,227,0.13)" };
        case "run":      return { accent: "#34C759", bg: "rgba(52,199,89,0.13)" };
        case "cycle":    return { accent: "#FF9500", bg: "rgba(255,149,0,0.13)" };
        case "custom":   return { accent: "#AF52DE", bg: "rgba(175,82,222,0.13)" };
        default:         return { accent: "#8E8E93", bg: "rgba(142,142,147,0.13)" };
    }
}

// ── Utility ──

function formatDuration(sec: number): string {
    const m = Math.round(sec / 60);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem === 0 ? `${h} h` : `${h} h ${rem} min`;
}

function formatTimeLabel(fractionalHour: number): string {
    const h = Math.floor(fractionalHour);
    const m = Math.round((fractionalHour - h) * 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Returns fractional hour (e.g. 9.5 for 09:30) from a date string, or null */
function dateToFractionalHour(value?: string | null): number | null {
    if (!value) return null;
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    return d.getHours() + d.getMinutes() / 60;
}

function getEventIcon(type: ExerciseType, size = 12) {
    switch (type) {
        case "strength": return <Dumbbell size={size} />;
        case "run":      return <Footprints size={size} />;
        case "cycle":    return <Bike size={size} />;
        case "custom":   return <Sparkles size={size} />;
        default:         return <Dumbbell size={size} />;
    }
}

// ── Sub-components ──

/**
 * Apple Calendar-style event block:
 * - Left accent bar (3px)
 * - Semi-transparent background of same color
 * - Title + subtitle inside
 */
function TimelineEventBlock({
    event,
    topPx,
    heightPx,
    onPress,
}: {
    event: DayViewEvent;
    topPx: number;
    heightPx: number;
    onPress: () => void;
}) {
    const { t } = useI18n();
    const isCompleted = event.status === "completed";
    const { accent, bg } = getEventColors(event.type, isCompleted);
    const clampedHeight = Math.max(heightPx, 44);

    const subtitle = (() => {
        if (event.durationSec && event.durationSec > 0) return formatDuration(event.durationSec);
        if (event.distanceKm && event.distanceKm > 0) return `${event.distanceKm.toFixed(1)} km`;
        if (event.exerciseCount && event.exerciseCount > 0) {
            return t("calendar.dayView.exerciseCount", { count: event.exerciseCount });
        }
        return null;
    })();

    // Show time range if start time is available
    const timeLabel = (() => {
        const startFH = dateToFractionalHour(event.startTime ?? null);
        if (startFH === null) return null;
        if (event.endTime) {
            const endFH = dateToFractionalHour(event.endTime ?? null);
            if (endFH !== null) return `${formatTimeLabel(startFH)} – ${formatTimeLabel(endFH)}`;
        }
        return formatTimeLabel(startFH);
    })();

    const infoLine = timeLabel ?? subtitle ?? null;

    return (
        <motion.button
            initial={{ opacity: 0, x: 6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            whileTap={{ scale: 0.97 }}
            onClick={onPress}
            className="absolute left-1 right-1 text-left overflow-hidden"
            style={{
                top: topPx,
                height: clampedHeight,
                backgroundColor: bg,
                borderLeft: `3px solid ${accent}`,
                borderRadius: 6,
                zIndex: 10,
            }}
        >
            <div className="px-2 py-1.5 flex flex-col justify-start h-full">
                {/* Title */}
                <p
                    className="text-[12px] font-semibold leading-tight truncate"
                    style={{ color: "#FFFFFF" }}
                >
                    {isCompleted && (
                        <span className="mr-1 inline-flex align-middle">
                            <Check size={11} strokeWidth={3} color={accent} />
                        </span>
                    )}
                    {event.title}
                </p>
                {/* Subtitle: time or duration */}
                {infoLine && clampedHeight >= 36 && (
                    <p className="text-[11px] leading-tight truncate mt-0.5" style={{ color: "#8E8E93" }}>
                        {infoLine}
                    </p>
                )}
            </div>
        </motion.button>
    );
}

/**
 * All-day area: thin strip above the timeline.
 * Only rendered when all-day events exist.
 * Layout matches Apple Calendar: "Ganztägig" label left + pill events right.
 */
function AllDayArea({
    events,
    onPress,
    label,
}: {
    events: DayViewEvent[];
    onPress: (e: DayViewEvent) => void;
    label: string;
}) {
    if (events.length === 0) return null;

    return (
        <div
            className="flex items-stretch border-b"
            style={{ borderColor: "rgba(255,255,255,0.06)", minHeight: 36 }}
        >
            {/* Label column — same width as time column */}
            <div
                className="shrink-0 flex items-center justify-end pr-2"
                style={{ width: TIME_COLUMN_WIDTH }}
            >
                <span className="text-[10px] font-medium" style={{ color: "#8E8E93" }}>
                    {label}
                </span>
            </div>

            {/* Separator line */}
            <div className="w-px self-stretch" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />

            {/* Event pills */}
            <div className="flex-1 flex flex-wrap gap-1.5 px-2 py-2">
                {events.map((ev) => {
                    const isCompleted = ev.status === "completed";
                    const { accent, bg } = getEventColors(ev.type, isCompleted);
                    return (
                        <motion.button
                            key={ev.id}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => onPress(ev)}
                            className="flex items-center gap-1.5 px-2 py-1 text-left overflow-hidden"
                            style={{
                                backgroundColor: bg,
                                borderLeft: `3px solid ${accent}`,
                                borderRadius: 6,
                                maxWidth: "100%",
                            }}
                        >
                            {isCompleted
                                ? <Check size={10} strokeWidth={3} color={accent} />
                                : getEventIcon(ev.type, 10)
                            }
                            <span className="text-[11px] font-semibold truncate" style={{ color: "#FFFFFF" }}>
                                {ev.title}
                            </span>
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
}

/**
 * Current time indicator — Apple Calendar style:
 * red horizontal line + red dot at left edge of event column + red time label on the left.
 */
function CurrentTimeIndicator({
    topPx,
    fractionalHour,
}: {
    topPx: number;
    fractionalHour: number;
}) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="absolute pointer-events-none flex items-center"
            style={{ top: topPx - 1, left: 0, right: 0, zIndex: 20 }}
        >
            {/* Red time label — fills the time column, right-aligned */}
            <div
                className="shrink-0 text-right pr-1.5 text-[10px] font-semibold leading-none"
                style={{ width: TIME_COLUMN_WIDTH - 2, color: "#FF3B30" }}
            >
                {formatTimeLabel(fractionalHour)}
            </div>

            {/* Red dot at the left edge of the event column */}
            <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: "#FF3B30", marginLeft: 0 }}
            />

            {/* Red line across full event column width */}
            <div
                className="flex-1 h-[1.5px]"
                style={{ backgroundColor: "#FF3B30" }}
            />
        </motion.div>
    );
}

// ── Main Component ──

export default function CalendarDayView({
    selectedDate,
    events,
    onEventPress,
}: CalendarDayViewProps) {
    const { t } = useI18n();
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerHeight, setContainerHeight] = useState(0);
    const [, forceUpdate] = useState(0);

    // Tick every minute to keep current-time indicator accurate
    useEffect(() => {
        const interval = setInterval(() => forceUpdate((n) => n + 1), 60_000);
        return () => clearInterval(interval);
    }, []);

    // Measure available timeline height
    useLayoutEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) setContainerHeight(entry.contentRect.height);
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // ── Separate timed vs all-day events ──
    const timedEvents = events.filter((e) => dateToFractionalHour(e.startTime ?? null) !== null);
    const allDayEvents = events.filter((e) => dateToFractionalHour(e.startTime ?? null) === null);

    // ── Dynamic time range ──
    const eventHours = timedEvents
        .map((e) => dateToFractionalHour(e.startTime ?? null))
        .filter((h): h is number => h !== null);

    const startHour = eventHours.length > 0
        ? Math.min(DEFAULT_START_HOUR, Math.floor(Math.min(...eventHours) - 1))
        : DEFAULT_START_HOUR;

    const endHour = eventHours.length > 0
        ? Math.max(DEFAULT_END_HOUR, Math.ceil(Math.max(...eventHours) + 1))
        : DEFAULT_END_HOUR;

    const totalHours = endHour - startHour;

    // ── Hour height: fill container, respect minimum ──
    const hourHeight = containerHeight > 0
        ? Math.max(MIN_HOUR_HEIGHT, Math.floor(containerHeight / totalHours))
        : MIN_HOUR_HEIGHT;

    const visibleHours = Array.from({ length: totalHours }, (_, i) => startHour + i);

    // ── Current time ──
    const now = new Date();
    const isCurrentDay = isToday(selectedDate);
    const currentFH = now.getHours() + now.getMinutes() / 60;
    const currentTimeVisible = isCurrentDay && currentFH >= startHour && currentFH <= endHour;
    const currentTimePx = (currentFH - startHour) * hourHeight;

    // ── Formatted date header ──
    const dateLabel = format(selectedDate, "EEEE, d. MMMM", { locale: de });

    return (
        <div className="flex flex-col h-full" style={{ backgroundColor: "#0A0A0E" }}>

            {/* All-day strip */}
            <AllDayArea
                events={allDayEvents}
                onPress={onEventPress}
                label={t("calendar.dayView.allDay")}
            />

            {/* Timeline — no scroll, fills remaining height */}
            <div
                ref={containerRef}
                className="flex-1 relative overflow-hidden"
            >
                {containerHeight > 0 && (
                    <>
                        {/* Hour rows: label + full-hour line */}
                        {visibleHours.map((hour, index) => (
                            <div
                                key={hour}
                                className="absolute flex items-center"
                                style={{
                                    top: index * hourHeight,
                                    left: 0,
                                    right: 0,
                                    height: hourHeight,
                                    pointerEvents: "none",
                                }}
                            >
                                {/* Time label — right-aligned inside time column */}
                                <span
                                    className="text-[11px] font-medium shrink-0 text-right leading-none"
                                    style={{
                                        width: TIME_COLUMN_WIDTH,
                                        paddingRight: 8,
                                        color: "#8E8E93",
                                        // Offset upward so the label sits above the line
                                        transform: "translateY(-50%)",
                                    }}
                                >
                                    {`${String(hour).padStart(2, "0")}:00`}
                                </span>

                                {/* Full-hour line */}
                                <div
                                    className="flex-1 h-px"
                                    style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                                />
                            </div>
                        ))}

                        {/* Half-hour lines (more subtle) */}
                        {visibleHours.map((hour, index) => (
                            <div
                                key={`half-${hour}`}
                                className="absolute"
                                style={{
                                    top: index * hourHeight + hourHeight / 2,
                                    left: TIME_COLUMN_WIDTH,
                                    right: 0,
                                    height: 1,
                                    backgroundColor: "rgba(255,255,255,0.03)",
                                    pointerEvents: "none",
                                }}
                            />
                        ))}

                        {/* Vertical separator between time column and event column */}
                        <div
                            className="absolute top-0 bottom-0"
                            style={{
                                left: TIME_COLUMN_WIDTH,
                                width: 1,
                                backgroundColor: "rgba(255,255,255,0.06)",
                                pointerEvents: "none",
                            }}
                        />

                        {/* Event blocks */}
                        <div
                            className="absolute top-0 bottom-0"
                            style={{ left: TIME_COLUMN_WIDTH, right: 0 }}
                        >
                            {timedEvents.map((event) => {
                                const startFH = dateToFractionalHour(event.startTime ?? null)!;
                                const endFH = (() => {
                                    if (event.endTime) {
                                        const fh = dateToFractionalHour(event.endTime ?? null);
                                        if (fh !== null) return fh;
                                    }
                                    if (event.durationSec && event.durationSec > 0) {
                                        return startFH + event.durationSec / 3600;
                                    }
                                    return startFH + 1;
                                })();

                                const topPx = (startFH - startHour) * hourHeight;
                                const heightPx = Math.max((endFH - startFH) * hourHeight, 44);

                                return (
                                    <TimelineEventBlock
                                        key={event.id}
                                        event={event}
                                        topPx={topPx}
                                        heightPx={heightPx}
                                        onPress={() => onEventPress(event)}
                                    />
                                );
                            })}
                        </div>

                        {/* Current time indicator */}
                        {currentTimeVisible && (
                            <CurrentTimeIndicator
                                topPx={currentTimePx}
                                fractionalHour={currentFH}
                            />
                        )}
                    </>
                )}
            </div>

            {/* Empty state — shown as overlay when no events at all */}
            {events.length === 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22 }}
                    className="absolute inset-x-0 top-1/3 flex flex-col items-center gap-3 pointer-events-none px-8"
                >
                    <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center"
                        style={{ backgroundColor: "rgba(41,82,227,0.08)" }}
                    >
                        <CalendarIcon size={22} style={{ color: "#2952E3" }} />
                    </div>
                    <p className="text-[14px] font-semibold text-center" style={{ color: "#8E8E93" }}>
                        {t("calendar.dayView.noEvents")}
                    </p>
                    <p className="text-[12px] text-center" style={{ color: "#48484A" }}>
                        {dateLabel}
                    </p>
                </motion.div>
            )}
        </div>
    );
}
