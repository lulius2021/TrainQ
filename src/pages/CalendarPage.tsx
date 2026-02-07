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
    parseISO,
    isSameMonth,
    addMonths,
    subMonths,
    subWeeks,
    addWeeks
} from "date-fns";
import { de } from "date-fns/locale";
import {
    ChevronLeft,
    ChevronRight,
    Plus,
    Dumbbell,
    Footprints,
    Bike,
    Sparkles,
    Calendar as CalendarIcon
} from "lucide-react";

import { useLiveTrainingStore } from "../store/useLiveTrainingStore";
import { getScopedItem } from "../utils/scopedStorage";
import { getActiveUserId } from "../utils/session";
import type { CalendarEvent, ExerciseType } from "../types";

// Types helper for loading
interface CoreEvent {
    id: string;
    userId: string;
    title: string;
    date: string; // YYYY-MM-DD
    startTime: string; // HH:mm
    endTime: string;
    type: string; // 'training' | 'other'
    trainingType?: "gym" | "laufen" | "radfahren" | "custom";
    trainingStatus: "planned" | "completed" | "skipped" | "open";
    description?: string;
    workoutData?: any; // { exercises: [] }
    adaptiveAppliedAt?: string;
    adaptiveReasons?: string[];
}

export default function CalendarPage() {
    // -- State --
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [view, setView] = useState<'day' | 'week' | 'month'>('month');
    const [events, setEvents] = useState<CalendarEvent[]>([]);

    // Swipe State
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const minSwipeDistance = 50;

    // -- Helper to get color --
    const getEventColor = (event: CalendarEvent) => {
        if (event.color) return event.color;
        const type = event.type;
        // Check title for override if not already set (though loadEvents sets it)
        const t = event.title?.toLowerCase() || "";
        if (t.includes("quick")) return "bg-yellow-500";
        if (t.includes("power")) return "bg-purple-500";
        if (t.includes("focus")) return "bg-blue-600";
        if (t.includes("custom")) return "bg-orange-500";

        switch (type) {
            case 'strength': return 'bg-blue-500';
            case 'run': return 'bg-red-500';
            case 'cycle': return 'bg-green-500';
            case 'custom': return 'bg-yellow-500';
            default: return 'bg-zinc-500';
        }
    };

    const getEventIcon = (type: ExerciseType) => {
        switch (type) {
            case 'strength': return <Dumbbell size={20} strokeWidth={2.5} />;
            case 'run': return <Footprints size={20} strokeWidth={2.5} />;
            case 'cycle': return <Bike size={20} strokeWidth={2.5} />;
            case 'custom': return <Sparkles size={20} strokeWidth={2.5} />;
            default: return <Dumbbell size={20} strokeWidth={2.5} />;
        }
    };

    // -- Load Events --
    const loadEvents = () => {
        const userId = getActiveUserId() || "user";
        const raw = getScopedItem("trainq_calendar_events", userId);
        if (raw) {
            try {
                const coreEvents: CoreEvent[] = JSON.parse(raw);
                const localEvents: CalendarEvent[] = coreEvents.map(e => {
                    const t = e.title.toLowerCase();
                    let colorOverride = undefined;
                    // Strict mapping for Adaptive types
                    if (t.includes("quick")) colorOverride = "bg-yellow-500";
                    else if (t.includes("power")) colorOverride = "bg-purple-500";
                    else if (t.includes("focus")) colorOverride = "bg-blue-600";
                    else if (t.includes("custom")) colorOverride = "bg-orange-500";

                    let type: ExerciseType = "custom";
                    if (e.trainingType === "gym") type = "strength";
                    else if (e.trainingType === "laufen") type = "run";
                    else if (e.trainingType === "radfahren") type = "cycle";

                    return {
                        id: e.id,
                        date: parseISO(e.date),
                        title: e.title,
                        type: type,
                        duration: 0,
                        intensity: "medium",
                        color: colorOverride,
                        workoutData: e.workoutData,
                        status: e.trainingStatus === "completed" ? "completed" : "planned"
                    };
                });
                setEvents(localEvents);
            } catch (err) {
                console.error("Failed to parse calendar events", err);
            }
        }
    };

    useEffect(() => {
        loadEvents();
        window.addEventListener("trainq:update_events", loadEvents);
        return () => window.removeEventListener("trainq:update_events", loadEvents);
    }, []);

    // -- Navigation Helpers --
    const handleNext = () => {
        if (view === 'day') {
            const next = addDays(currentDate, 1);
            setCurrentDate(next);
            setSelectedDate(next);
        } else if (view === 'week') {
            setCurrentDate(addWeeks(currentDate, 1));
        } else {
            setCurrentDate(addMonths(currentDate, 1));
        }
    };

    const handlePrev = () => {
        if (view === 'day') {
            const prev = subDays(currentDate, 1);
            setCurrentDate(prev);
            setSelectedDate(prev);
        } else if (view === 'week') {
            setCurrentDate(subWeeks(currentDate, 1));
        } else {
            setCurrentDate(subMonths(currentDate, 1));
        }
    };

    const handleTodayClick = () => {
        const now = new Date();
        setSelectedDate(now);
        setCurrentDate(now);
        setView('day');
    };

    const onDateClick = (day: Date) => {
        setSelectedDate(day);
    };

    // -- Swipe Handlers --
    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;
        if (isLeftSwipe) {
            handleNext();
        }
        if (isRightSwipe) {
            handlePrev();
        }
    };

    // -- Start Workout Logic --
    const handleStartTraining = (event: CalendarEvent) => {
        const workoutData = event.workoutData;
        if (!workoutData || !workoutData.exercises) {
            console.warn("Cannot start workout without exercises");
            return;
        }

        const liveWorkout = {
            id: crypto.randomUUID(),
            calendarEventId: event.id,
            title: event.title,
            sport: event.type === "strength" ? "Gym" : event.type === "run" ? "Laufen" : event.type === "cycle" ? "Radfahren" : "Custom",
            startedAt: new Date().toISOString(),
            isActive: true,
            exercises: workoutData.exercises,
            notes: `Started from Calendar: ${event.title}`
        };

        useLiveTrainingStore.getState().startWorkout(liveWorkout as any);
        window.dispatchEvent(new CustomEvent("trainq:navigate", { detail: { path: "/live-training", eventId: liveWorkout.id } }));
    };

    // -- View Renderers (COMPACTED) --

    const renderDayView = () => {
        // Significantly reduced padding and font sizes (approx 20% smaller)
        return (
            <div className="flex flex-col items-center justify-center py-4 border-b border-white/5 bg-gradient-to-b from-[#121214] to-blue-900/5">
                <span className="text-zinc-500 text-sm font-bold uppercase tracking-widest mb-1">
                    {format(currentDate, 'EEEE', { locale: de })}
                </span>
                <div className="flex items-center gap-6">
                    <button onClick={handlePrev} className="p-2 bg-zinc-900/50 rounded-full text-zinc-500 hover:text-white active:scale-90 transition-transform">
                        <ChevronLeft size={20} strokeWidth={3} />
                    </button>
                    <h1 className="text-5xl font-black text-white tracking-tighter leading-none drop-shadow-2xl min-w-[80px] text-center">
                        {format(currentDate, 'd')}
                    </h1>
                    <button onClick={handleNext} className="p-2 bg-zinc-900/50 rounded-full text-zinc-500 hover:text-white active:scale-90 transition-transform">
                        <ChevronRight size={20} strokeWidth={3} />
                    </button>
                </div>
                <span className="text-lg text-blue-500 font-black uppercase tracking-wider mt-1">
                    {format(currentDate, 'MMMM yyyy', { locale: de })}
                </span>
            </div>
        );
    };

    const renderWeekView = () => {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        const days = eachDayOfInterval({ start, end: addDays(start, 6) });
        const weekDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

        return (
            <div className="px-2 py-3 border-b border-white/5 bg-[#121214]">
                <div className="grid grid-cols-7 gap-1">
                    {weekDays.map((d) => (
                        <div key={d} className="text-center text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
                            {d}
                        </div>
                    ))}
                    {days.map((day) => {
                        const isSelected = isSameDay(day, selectedDate);
                        const isTodayDate = isToday(day);
                        const hasEvent = events.some(e => isSameDay(e.date, day));

                        return (
                            <button
                                key={day.toString()}
                                onClick={() => setSelectedDate(day)}
                                className={`
                                    flex flex-col items-center justify-center py-2.5 rounded-xl relative transition-all active:scale-95
                                    ${isSelected ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 scale-105 z-10' : 'bg-zinc-800/40 text-zinc-400'}
                                    ${!isSelected && isTodayDate ? 'border border-blue-500 text-blue-400' : ''}
                                `}
                            >
                                <span className={`text-lg font-bold ${isSelected ? 'text-white' : 'text-current'}`}>
                                    {format(day, 'd')}
                                </span>
                                {hasEvent && (
                                    <div className={`mt-1 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-500'}`} />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderMonthView = () => {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
        const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
        const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });
        const weekDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

        return (
            <div className="px-2 pb-4 border-b border-white/5">
                <div className="grid grid-cols-7 mb-2 px-1 mt-2">
                    {weekDays.map(day => (
                        <div key={day} className="text-center text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                            {day}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-y-1 gap-x-1">
                    {calendarDays.map((day) => {
                        const isSelected = isSameDay(day, selectedDate);
                        const isTodayDate = isToday(day);
                        const isCurrentMonth = isSameMonth(day, currentDate);
                        const dayEvents = events.filter(e => isSameDay(e.date, day));
                        const hasEvents = dayEvents.length > 0;

                        return (
                            <div key={day.toString()} className="flex flex-col items-center">
                                <button
                                    onClick={() => onDateClick(day)}
                                    // Reduced size: w-9 h-9 approx (based on text size and padding)
                                    className={`
                                        w-10 h-10 rounded-[14px] flex flex-col items-center justify-center relative transition-all duration-200 active:scale-90
                                        ${isSelected ? 'bg-white text-black shadow-lg shadow-white/10 scale-110 z-10' : ''}
                                        ${!isSelected && isTodayDate ? 'bg-zinc-800 text-blue-400 border border-blue-500/50' : ''}
                                        ${!isSelected && !isTodayDate && isCurrentMonth ? 'bg-transparent text-zinc-300' : ''}
                                        ${!isSelected && !isTodayDate && !isCurrentMonth ? 'bg-transparent text-zinc-700' : ''}
                                    `}
                                >
                                    <span className={`text-sm font-bold ${isSelected ? 'font-black' : isTodayDate ? 'font-extrabold' : 'font-bold'}`}>
                                        {format(day, 'd')}
                                    </span>

                                    {/* Dot Indicators */}
                                    {hasEvents && !isSelected && (
                                        <div className="absolute bottom-1 flex gap-0.5 justify-center">
                                            {dayEvents.slice(0, 3).map((ev, i) => (
                                                <div
                                                    key={i}
                                                    className={`w-1 h-1 rounded-full ${getEventColor(ev)}`}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    // -- Main Render --
    return (
        <div className="min-h-screen bg-[#000000] text-white pb-24">

            {/* Header: Compacted */}
            <div className="sticky top-0 z-40 bg-[#000000]/95 backdrop-blur-xl pt-safe border-b border-white/5 pb-2">
                <div className="px-4 py-3 flex items-center justify-between">
                    <h1 className="text-2xl font-black tracking-tighter text-white">Kalender</h1>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleTodayClick}
                            className="px-4 py-2 bg-zinc-800/80 rounded-xl text-xs text-white font-bold uppercase tracking-wider active:scale-95 transition-transform border border-white/5 backdrop-blur-md shadow-sm"
                        >
                            Heute
                        </button>
                        <button className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 active:scale-90 transition-transform hover:brightness-110">
                            <Plus size={20} strokeWidth={3} />
                        </button>
                    </div>
                </div>

                {/* Segmented Control: Compacted */}
                <div className="px-4 pb-3">
                    <div className="bg-zinc-900 rounded-xl p-1 flex gap-1 border border-white/10">
                        {(['day', 'week', 'month'] as const).map((v) => (
                            <button
                                key={v}
                                onClick={() => setView(v)}
                                className={`
                                    flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all
                                    ${view === v ? 'bg-zinc-700 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}
                                `}
                            >
                                {v === 'day' ? 'Tag' : v === 'week' ? 'Woche' : 'Monat'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Navigation Bar (Month display) */}
                {view !== 'day' && (
                    <div className="flex items-center justify-between px-4 py-1">
                        <button onClick={handlePrev} className="p-2 bg-zinc-900/50 rounded-full text-zinc-400 hover:text-white active:scale-90 transition-transform">
                            <ChevronLeft size={16} />
                        </button>
                        <span className="text-lg font-black capitalize tracking-tight">
                            {format(currentDate, 'MMMM yyyy', { locale: de })}
                        </span>
                        <button onClick={handleNext} className="p-2 bg-zinc-900/50 rounded-full text-zinc-400 hover:text-white active:scale-90 transition-transform">
                            <ChevronRight size={16} />
                        </button>
                    </div>
                )}
            </div>

            {/* Dynamic View Content Check -- Added touch-action: pan-y to allow vertical scroll but handle horizontal swipe */}
            <div
                className="animate-in fade-in duration-300 touch-pan-y"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                {view === 'day' && renderDayView()}
                {view === 'week' && renderWeekView()}
                {view === 'month' && renderMonthView()}
            </div>

            {/* Event List */}
            <div className="px-4 pt-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-white/50 uppercase tracking-widest">
                        {isToday(selectedDate) ? "Heute" : format(selectedDate, 'dd.MM', { locale: de })}
                    </h3>
                    <span className="text-[10px] font-bold bg-white/10 px-2 py-1 rounded-md text-white/70">
                        {events.filter(e => isSameDay(e.date, selectedDate)).length}
                    </span>
                </div>

                <div className="space-y-3">
                    {events.filter(e => isSameDay(e.date, selectedDate)).length === 0 ? (
                        <div className="text-center py-10 rounded-[24px] border border-dashed border-zinc-800 bg-zinc-900/20">
                            <div className="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center mx-auto mb-3">
                                <CalendarIcon className="text-zinc-600" size={24} />
                            </div>
                            <p className="text-zinc-400 font-bold text-sm">Kein Training</p>
                        </div>
                    ) : (
                        events
                            .filter(e => isSameDay(e.date, selectedDate))
                            .map((event) => (
                                <div
                                    key={event.id}
                                    onClick={() => handleStartTraining(event)}
                                    className="group relative overflow-hidden rounded-[24px] bg-[#1c1c1e] border border-white/5 p-4 active:scale-[0.98] transition-all duration-200 shadow-xl"
                                >
                                    {/* Action Gradient Background */}
                                    <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity bg-gradient-to-r ${getEventColor(event)} from-transparent`} />

                                    <div className="flex justify-between items-center relative z-10 w-full">
                                        <div className="flex items-center w-full gap-4">
                                            {/* Icon Box */}
                                            <div className={`shrink-0 w-14 h-14 rounded-xl flex items-center justify-center ${getEventColor(event)} shadow-lg shadow-${getEventColor(event).replace('bg-', '')}/20`}>
                                                <span className="text-white drop-shadow-md">
                                                    {getEventIcon(event.type)}
                                                </span>
                                            </div>

                                            {/* Text Content */}
                                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className="flex items-center justify-center px-1.5 py-0.5 rounded bg-white/10 border border-white/5">
                                                        <span className="text-[9px] font-black uppercase tracking-wider text-white/60 leading-none">
                                                            {event.title.split(" ")[0].toUpperCase()}
                                                        </span>
                                                    </div>
                                                </div>
                                                <h4 className="text-lg font-black text-white leading-none tracking-tight mb-1 truncate">
                                                    {event.title}
                                                </h4>
                                                <div className="flex items-center gap-2 text-xs text-zinc-400 font-bold">
                                                    <span className="flex items-center gap-1">
                                                        <CalendarIcon size={12} strokeWidth={2.5} />
                                                        {format(event.date, 'HH:mm')}
                                                    </span>
                                                    {event.duration > 0 && <span>• {event.duration} min</span>}
                                                </div>
                                            </div>

                                            {/* Arrow */}
                                            <div className="shrink-0 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 group-hover:bg-white/10 group-hover:text-white transition-colors">
                                                <ChevronRight size={16} strokeWidth={3} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                    )}
                </div>
            </div>
        </div>
    );
}
