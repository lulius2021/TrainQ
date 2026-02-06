import React, { useState, useEffect } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    Plus,
    Dumbbell,
    Calendar as CalendarIcon,
    ArrowRightLeft,
    Search,
    User,
    Menu,
    Footprints,
    Bike,
    BicepsFlexed
} from 'lucide-react';
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    isToday,
    addDays,
    startOfISOWeek,
    endOfISOWeek,
    isAfter
} from 'date-fns';
import { de } from 'date-fns/locale';

// --- TYPES ---
type ExerciseType = 'strength' | 'cardio' | 'run' | 'cycle' | 'custom' | 'mobility';

interface CalendarEvent {
    id: string;
    date: Date;
    title: string;
    type: ExerciseType;
    duration?: number; // minutes
    status: 'completed' | 'planned' | 'skipped';
}

const INITIAL_EVENTS: CalendarEvent[] = [
    { id: '1', date: new Date(), title: 'Beine (Hypertrophie)', type: 'strength', duration: 90, status: 'planned' },
    { id: '2', date: addDays(new Date(), -1), title: 'Recovery Run', type: 'run', duration: 30, status: 'completed' },
    { id: '3', date: addDays(new Date(), 2), title: 'Oberkörper Push', type: 'strength', duration: 75, status: 'planned' },
    { id: '4', date: addDays(new Date(), 5), title: 'Long Run', type: 'run', duration: 60, status: 'planned' },
    { id: '5', date: addDays(new Date(), 1), title: 'Mobility Flow', type: 'custom', duration: 20, status: 'planned' },
    { id: '6', date: addDays(new Date(), 3), title: 'Zwift Race', type: 'cycle', duration: 45, status: 'planned' },
];

const CalendarPage = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [view, setView] = useState<'day' | 'week' | 'month'>('day'); // Controls the list view below
    const [events, setEvents] = useState<CalendarEvent[]>(INITIAL_EVENTS);

    // Filter Logic
    const filteredEvents = events.filter(event => {
        if (view === 'day') {
            return isSameDay(event.date, selectedDate);
        } else if (view === 'week') {
            const start = startOfISOWeek(selectedDate);
            const end = endOfISOWeek(selectedDate);
            return event.date >= start && event.date <= end;
        } else {
            // Month
            return isSameMonth(event.date, currentDate);
        }
    }).sort((a, b) => a.date.getTime() - b.date.getTime());


    // Helpers
    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const onDateClick = (day: Date) => {
        setSelectedDate(day);

        // If user selects a date, we might want to switch to 'day' view automatically to show details?
        // User requirement: "Filter: Die Buttons (Tag, Woche, Monat) filtern nur die Liste unter dem Kalender-Grid."
        // So clicking a date changes selectedDate, which updates list if view='day' or 'week'.
        // We'll keep the view as is unless user changes it.
    };

    const handleTodayClick = () => {
        const now = new Date();
        setSelectedDate(now);
        setCurrentDate(now);
        setView('day'); // "Heute-Button: Springt sofort zum aktuellen Datum in die Tagesansicht."
    };

    const getEventColor = (type: ExerciseType) => {
        switch (type) {
            case 'strength': return 'bg-blue-500'; // Gym
            case 'run': return 'bg-red-500'; // Run
            case 'cycle': return 'bg-green-500'; // Cycle
            case 'custom': return 'bg-yellow-500'; // Custom
            case 'mobility': return 'bg-yellow-500';
            default: return 'bg-zinc-500';
        }
    };

    const getEventIcon = (type: ExerciseType) => {
        switch (type) {
            case 'strength': return <Dumbbell size={16} />;
            case 'run': return <Footprints size={16} />;
            case 'cycle': return <Bike size={16} />;
            case 'custom': return <Sparkles size={16} />;
            default: return <Dumbbell size={16} />;
        }
    };

    // Calendar Grid Gen
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // ISO Mon
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    const weekDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

    return (
        <div className="min-h-screen bg-[#121214] text-white pb-24">

            {/* Header */}
            <div className="sticky top-0 z-40 bg-[#121214]/95 backdrop-blur-xl pt-safe border-b border-white/5 pb-2">
                <div className="px-4 py-3 flex items-center justify-between">
                    <h1 className="text-2xl font-bold tracking-tight">Kalender</h1>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleTodayClick}
                            className="px-3 py-1.5 bg-zinc-800 rounded-lg text-xs font-bold uppercase tracking-wider text-zinc-300 active:scale-95 transition-transform"
                        >
                            Heute
                        </button>
                        <button className="w-9 h-9 flex items-center justify-center rounded-full bg-blue-500 text-white shadow-lg shadow-blue-500/20 active:scale-90 transition-transform">
                            <Plus size={20} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                {/* Filter Segments - Moved to Header */}
                <div className="px-4 pb-2">
                    <div className="bg-zinc-900/80 rounded-lg p-0.5 flex gap-0.5 border border-white/5">
                        {(['day', 'week', 'month'] as const).map((v) => (
                            <button
                                key={v}
                                onClick={() => setView(v)}
                                className={`
                                    flex-1 py-1 text-[11px] font-bold uppercase tracking-wider rounded-[6px] transition-all
                                    ${view === v ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}
                                `}
                            >
                                {v === 'day' ? 'Tag' : v === 'week' ? 'Woche' : 'Monat'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Month Nav */}
                <div className="flex items-center justify-between px-4 py-1">
                    <button onClick={prevMonth} className="p-2 text-zinc-400 hover:text-white active:scale-90 transition-transform">
                        <ChevronLeft size={20} />
                    </button>
                    <span className="text-lg font-semibold capitalize">
                        {format(currentDate, 'MMMM yyyy', { locale: de })}
                    </span>
                    <button onClick={nextMonth} className="p-2 text-zinc-400 hover:text-white active:scale-90 transition-transform">
                        <ChevronRight size={20} />
                    </button>
                </div>

                {/* Days Header */}
                <div className="grid grid-cols-7 mb-1 px-2">
                    {weekDays.map(day => (
                        <div key={day} className="text-center text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                            {day}
                        </div>
                    ))}
                </div>
            </div>

            {/* Grid */}
            <div className="px-2">
                <div className="grid grid-cols-7 gap-y-2 gap-x-1">
                    {calendarDays.map((day, idx) => {
                        const isSelected = isSameDay(day, selectedDate);
                        const isTodayDate = isToday(day);
                        const isCurrentMonth = isSameMonth(day, currentDate);

                        const dayEvents = events.filter(e => isSameDay(e.date, day));
                        const hasEvents = dayEvents.length > 0;

                        return (
                            <div key={day.toString()} className="flex flex-col items-center">
                                <button
                                    onClick={() => onDateClick(day)}
                                    className={`
                                        w-10 h-10 rounded-[14px] flex flex-col items-center justify-center relative transition-all duration-200 active:scale-90
                                        ${isSelected ? 'bg-white text-black shadow-lg shadow-white/10' : ''}
                                        ${!isSelected && isTodayDate ? 'bg-zinc-800 text-blue-400 font-bold border border-blue-500/50' : ''}
                                        ${!isSelected && !isTodayDate && isCurrentMonth ? 'text-zinc-200' : ''}
                                        ${!isSelected && !isTodayDate && !isCurrentMonth ? 'text-zinc-700' : ''}
                                    `}
                                >
                                    <span className="text-sm">{format(day, 'd')}</span>

                                    {/* Event Dots */}
                                    {hasEvents && (
                                        <div className="flex gap-0.5 mt-0.5">
                                            {dayEvents.slice(0, 3).map((ev) => (
                                                <div
                                                    key={ev.id}
                                                    className={`w-1 h-1 rounded-full ${getEventColor(ev.type)}`}
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

            {/* Event List */}
            <div className="mt-4 px-4 space-y-3">
                {filteredEvents.length > 0 ? (
                    filteredEvents.map(event => (
                        <div key={event.id} className="bg-zinc-800/50 rounded-2xl p-4 border border-zinc-700/30 flex items-center gap-4 active:scale-[0.99] transition-transform">
                            <div className={`w-12 h-12 rounded-full ${getEventColor(event.type).replace('bg-', 'bg-')}/20 flex items-center justify-center ${getEventColor(event.type).replace('bg-', 'text-')}`}>
                                {getEventIcon(event.type)}
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-white text-sm">{event.title}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-zinc-400">{format(event.date, 'dd. MMM', { locale: de })}</span>
                                    {event.duration && (
                                        <>
                                            <span className="text-zinc-600">•</span>
                                            <span className="text-xs text-zinc-400">{event.duration} min</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            {event.status === 'completed' ? (
                                <div className="text-green-500 bg-green-500/10 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide">
                                    Done
                                </div>
                            ) : (
                                <ChevronRight className="text-zinc-600" size={16} />
                            )}
                        </div>
                    ))
                ) : (
                    <div className="text-center py-12 text-zinc-500">
                        <p className="text-sm">Keine Trainings für diesen Zeitraum.</p>
                    </div>
                )}
            </div>

            {/* FAB can go here if needed, but we have header actions */}

        </div>
    );
};

// Mock Component for icons to fix TS error if not imported
function Sparkles({ size, fill }: { size: number, fill?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill={fill || "none"}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
        </svg>
    )
}

export { CalendarPage };
