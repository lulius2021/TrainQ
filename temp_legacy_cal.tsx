import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Dumbbell,
  CalendarPlus,
  ArrowRightLeft
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
  endOfISOWeek
} from 'date-fns';
import { de } from 'date-fns/locale';

// --- MOCK DATA ---
const EVENTS = [
  { id: '1', title: 'Push Day A', date: new Date(), type: 'workout', time: '09:00', status: 'completed' },
  { id: '2', title: 'Pull Day B', date: addDays(new Date(), 2), type: 'workout', time: '18:00', status: 'planned' },
  { id: '3', title: 'Beine', date: subMonths(new Date(), 1), type: 'workout', time: '16:00', status: 'completed' }
];

export const CalendarPage = () => {
  // STATE
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('month');
  const [showActions, setShowActions] = useState(false);

  // NAVIGATION
  const nextPeriod = () => {
    if (view === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(addDays(currentDate, 7));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const prevPeriod = () => {
    if (view === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(addDays(currentDate, -7));
    else setCurrentDate(addDays(currentDate, -1));
  };

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setCurrentDate(day);
    setView('day');
  };

  // --- SUB-COMPONENTS ---

  const Header = () => (
    <div className="pt-safe bg-zinc-900 shrink-0 z-30 sticky top-0 shadow-sm shadow-black/20">
      <div className="px-4 pb-2">
        <div className="flex justify-between items-center mb-1 mt-1">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              {view === 'month' ? 'Monat' : view === 'week' ? 'Woche' : 'Heute'}
            </span>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              {view === 'month' && format(currentDate, 'MMMM yyyy', { locale: de })}
              {view === 'week' && `KW ${format(currentDate, 'w', { locale: de })}`}
              {view === 'day' && format(currentDate, 'd. MMMM', { locale: de })}
            </h1>
          </div>

          <div className="flex items-center bg-zinc-800 rounded-full p-0.5">
            <button onClick={prevPeriod} className="p-1.5 text-zinc-400 hover:text-white rounded-full active:bg-zinc-700">
              <ChevronLeft size={18} />
            </button>
            <button onClick={nextPeriod} className="p-1.5 text-zinc-400 hover:text-white rounded-full active:bg-zinc-700">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="bg-zinc-800 p-0.5 rounded-xl flex shadow-inner">
          {['day', 'week', 'month'].map((v) => (
            <button
              key={v}
              onClick={() => setView(v as any)}
              className={`
                flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all duration-200
                ${view === v
                  ? 'bg-zinc-600 text-white shadow-lg scale-[1.02]'
                  : 'text-zinc-400 hover:text-zinc-200'}
              `}
            >
              {v === 'day' ? 'Tag' : v === 'week' ? 'Woche' : 'Monat'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // 1. MONTH VIEW
  const MonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: startDate, end: addDays(startDate, 41) });

    return (
      <div className="flex-1 px-2 pt-2 flex flex-col h-full overflow-hidden animate-in fade-in duration-200">
        <div className="grid grid-cols-7 mb-1 shrink-0">
          {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
            <div key={day} className="text-[9px] font-bold text-zinc-500 uppercase text-center">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 grid-rows-6 gap-1.5 flex-1 min-h-0 pb-32">
          {days.map((day) => {
            const isSelected = isSameDay(day, selectedDate);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isTodayDate = isToday(day);
            const hasEvent = EVENTS.some(e => isSameDay(e.date, day));

            return (
              <div
                key={day.toString()}
                onClick={() => handleDayClick(day)}
                className="flex flex-col h-full"
              >
                <div className={`
                   w-full h-full rounded-xl flex flex-col items-center justify-start pt-1.5 transition-all relative
                   ${isSelected ? 'bg-blue-600 text-white shadow-md' : 'bg-zinc-800/40'}
                   ${!isSelected && !isCurrentMonth ? 'opacity-20 bg-zinc-900' : ''}
                   ${!isSelected && isTodayDate ? 'border border-blue-500 text-blue-500' : ''}
                   active:scale-95
                `}>
                  <span className={`text-xs font-bold ${!isSelected && !isCurrentMonth ? 'text-zinc-600' : ''}`}>
                    {format(day, 'd')}
                  </span>
                  {hasEvent && (
                    <div className={`mt-1.5 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-500'}`} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // 2. WEEK VIEW
  const WeekView = () => {
    const start = startOfISOWeek(currentDate);
    const end = endOfISOWeek(currentDate);
    const days = eachDayOfInterval({ start, end });

    return (
      <div className="flex-1 px-2 pt-2 flex flex-col h-full overflow-hidden animate-in fade-in duration-200">
        <div className="grid grid-cols-7 gap-1.5 flex-1 min-h-0 pb-32">
          {days.map((day) => {
            const isSelected = isSameDay(day, selectedDate);
            const isTodayDate = isToday(day);
            const dayEvents = EVENTS.filter(e => isSameDay(e.date, day));

            return (
              <button
                key={day.toString()}
                onClick={() => handleDayClick(day)}
                className={`
                    flex flex-col items-center py-2 rounded-2xl transition-all h-full
                    ${isSelected ? 'bg-blue-600 text-white shadow-lg' : 'bg-zinc-800/40 hover:bg-zinc-800/60'}
                    ${!isSelected && isTodayDate ? 'border border-blue-500' : ''}
                 `}
              >
                <span className={`text-[9px] font-bold uppercase mb-1 ${isSelected ? 'text-blue-200' : 'text-zinc-500'}`}>
                  {format(day, 'EEE', { locale: de }).slice(0, 2)}
                </span>
                <span className={`text-base font-bold mb-3 ${isSelected ? 'text-white' : isTodayDate ? 'text-blue-500' : 'text-zinc-200'}`}>
                  {format(day, 'd')}
                </span>
                <div className="flex flex-col gap-1 w-full px-1">
                  {dayEvents.map(ev => (
                    <div key={ev.id} className={`w-full aspect-square rounded-md flex items-center justify-center ${isSelected ? 'bg-blue-500 text-white' : 'bg-zinc-700 text-zinc-400'}`}>
                      <Dumbbell size={10} />
                    </div>
                  ))}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    );
  };

  // 3. DAY VIEW (CLEAN - NO HIGHLIGHTS)
  const DayView = () => {
    const dayEvents = EVENTS.filter(e => isSameDay(e.date, currentDate));

    return (
      <div className="flex-1 px-4 pt-4 pb-36 overflow-y-auto animate-in fade-in duration-200">

        {/* Date Header */}
        <div className="flex items-center gap-4 mb-6">
          <span className="text-3xl font-bold text-white">
            {format(currentDate, 'd.')}
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-zinc-400 uppercase">
              {format(currentDate, 'EEEE', { locale: de })}
            </span>
          </div>
        </div>

        {dayEvents.length === 0 ? (
          <div className="border-l-2 border-zinc-800 pl-6 py-4 space-y-12 opacity-50">
            {[9, 12, 15, 18].map(hour => (
              <div key={hour} className="relative h-px bg-zinc-800 w-full">
                <span className="absolute -left-12 -top-2 text-xs font-mono text-zinc-600">
                  {hour}:00
                </span>
              </div>
            ))}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-zinc-600 font-medium">Keine Termine</span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {dayEvents.map(ev => (
              <div key={ev.id} className="bg-zinc-800 p-4 rounded-3xl border border-zinc-700/50 flex gap-4 hover:border-blue-500/30 transition-colors">
                <div className={`w-1 rounded-full h-full ${ev.status === 'completed' ? 'bg-emerald-500' : 'bg-blue-500'}`}></div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-0.5">Training</span>
                    <span className="text-xs font-mono text-zinc-500">{ev.time}</span>
                  </div>
                  <h3 className="font-bold text-white text-lg">{ev.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Dumbbell size={12} className="text-zinc-500" />
                    <p className="text-xs text-zinc-400">Gym • 6 Übungen</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const ActionMenu = () => {
    if (!showActions) return null;
    return (
      <>
        <div onClick={() => setShowActions(false)} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 animate-in fade-in" />
        <div className="fixed bottom-36 right-24 z-50 flex flex-row items-center gap-3 animate-in slide-in-from-right-10 duration-200">
          <button onClick={() => console.log('Verschieben')} className="w-14 h-14 bg-orange-500 rounded-full flex items-center justify-center text-white shadow-xl shadow-orange-900/40 active:scale-90 transition-transform">
            <ArrowRightLeft size={24} />
          </button>
          <button onClick={() => console.log('Termin')} className="w-14 h-14 bg-purple-600 rounded-full flex items-center justify-center text-white shadow-xl shadow-purple-900/40 active:scale-90 transition-transform">
            <CalendarPlus size={24} />
          </button>
          <button onClick={() => console.log('Training')} className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-xl shadow-blue-900/40 active:scale-90 transition-transform">
            <Dumbbell size={24} />
          </button>
        </div>
      </>
    );
  };

  return (
    <div className="h-full flex flex-col bg-zinc-900 relative overflow-x-hidden touch-pan-y">
      <Header />
      {view === 'month' && <MonthView />}
      {view === 'week' && <WeekView />}
      {view === 'day' && <DayView />}
      <ActionMenu />
      <div className="absolute bottom-36 right-4 z-50">
        <button
          onClick={() => setShowActions(!showActions)}
          className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 z-50 relative ${showActions ? 'bg-zinc-700 text-zinc-300 rotate-45' : 'bg-blue-600 text-white shadow-blue-900/20'}`}
        >
          <Plus size={28} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
};
