import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Plus,
  Footprints,
  Bike,
  Star,
  ChevronDown
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
  addDays
} from 'date-fns';
import { de } from 'date-fns/locale';
// import { useNavigate } from 'react-router-dom'; // Disabled: Package not installed

// --- MOCK DATA ---
const MOCK_WORKOUTS = [
  { id: '1', title: 'Push Day A', date: new Date(), sport: 'Gym', exercises: 6 },
  { id: '2', title: 'Easy Run', date: new Date(), sport: 'Laufen', exercises: 1 },
  { id: '3', title: 'Legs & Core', date: addDays(new Date(), -2), sport: 'Gym', exercises: 8 },
];

// --- MAIN COMPONENT (Named Export) ---
export const CalendarPage = () => {
  // const navigate = useNavigate();

  // STATE
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('month');

  // NAVIGATION
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  // FILTER LOGIC
  const selectedDayWorkouts = useMemo(() => {
    return MOCK_WORKOUTS.filter(w => isSameDay(w.date, selectedDate));
  }, [selectedDate]);

  // --- ICONS ---
  const getIcon = (sport: string) => {
    switch (sport) {
      case 'Laufen': return <Footprints size={20} />;
      case 'Radfahren': return <Bike size={20} />;
      case 'Gym': return <Dumbbell size={20} />;
      default: return <Star size={20} />;
    }
  };

  // --- SUB-COMPONENTS ---

  const Header = () => (
    // TRUE BLACK BACKGROUND (#000000)
    <div className="px-4 py-4 flex justify-between items-center bg-black shrink-0 z-10 pt-safe">
      <h1 className="text-2xl font-bold text-white tracking-tight">Kalender</h1>

      {/* Date Navigator (Merged into Header) */}
      <div className="flex items-center gap-1">
        <button onClick={prevMonth} className="p-2 text-zinc-500 hover:text-white transition-colors active:scale-90">
          <ChevronLeft size={22} />
        </button>
        <span className="text-base font-semibold text-white w-32 text-center select-none">
          {format(currentDate, 'MMMM yyyy', { locale: de })}
        </span>
        <button onClick={nextMonth} className="p-2 text-zinc-500 hover:text-white transition-colors active:scale-90">
          <ChevronRight size={22} />
        </button>
      </div>
    </div>
  );

  const ViewSwitcher = () => (
    <div className="px-4 mb-6 shrink-0">
      {/* TRUE BLACK CONTAINER */}
      <div className="flex bg-black border border-zinc-900 p-1 rounded-xl">
        {['day', 'week', 'month'].map((v) => (
          <button
            key={v}
            onClick={() => setView(v as any)}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${view === v
                ? 'bg-zinc-900 text-white' // Active
                : 'text-zinc-600 hover:text-zinc-400' // Inactive
              }`}
          >
            {v === 'day' ? 'Tag' : v === 'week' ? 'Woche' : 'Monat'}
          </button>
        ))}
      </div>
    </div>
  );

  const CalendarGrid = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    return (
      <div className="px-2 mb-6">
        {/* Weekday Header */}
        <div className="grid grid-cols-7 mb-2">
          {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
            <div key={day} className="text-[10px] font-bold text-zinc-700 uppercase text-center py-2">
              {day}
            </div>
          ))}
        </div>
        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-y-1">
          {days.map((day) => {
            const isSelected = isSameDay(day, selectedDate);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const hasWorkout = MOCK_WORKOUTS.some(w => isSameDay(w.date, day));

            return (
              <div key={day.toString()} className="flex flex-col items-center justify-center aspect-square">
                <button
                  onClick={() => {
                    setSelectedDate(day);
                    if (!isCurrentMonth) setCurrentDate(day);
                  }}
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all relative
                    ${isSelected ? 'bg-blue-600 text-white' : ''}
                    ${!isSelected && isCurrentMonth ? 'text-zinc-300 hover:bg-zinc-900' : ''}
                    ${!isSelected && !isCurrentMonth ? 'text-zinc-800' : ''}
                    ${isToday(day) && !isSelected ? 'text-blue-500 font-bold' : ''}
                  `}
                >
                  {format(day, 'd')}
                  {/* Dot Indicator */}
                  {hasWorkout && !isSelected && (
                    <span className="absolute bottom-1.5 w-1 h-1 bg-blue-600 rounded-full"></span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const WorkoutList = () => (
    <div className="space-y-3 px-4 pb-32">
      {selectedDayWorkouts.length > 0 ? (
        selectedDayWorkouts.map((workout) => (
          <div
            key={workout.id}
            onClick={() => console.log('Navigate', `/workout/${workout.id}`)}
            // STYLE: TRUE BLACK BACKGROUND (#000000)
            // Border is the only separator
            className="bg-black border border-zinc-900 rounded-2xl p-5 flex items-center justify-between active:bg-zinc-900/30 transition-colors group"
          >
            <div className="flex items-center gap-5">
              {/* Icon Box */}
              <div className="w-12 h-12 rounded-2xl bg-zinc-900/40 flex items-center justify-center text-zinc-100 border border-zinc-900">
                {getIcon(workout.sport)}
              </div>

              {/* Text Info */}
              <div>
                <h4 className="text-white font-semibold text-base mb-1">{workout.title}</h4>
                <div className="flex items-center gap-2 text-xs text-zinc-500 font-medium uppercase tracking-wide">
                  <span>{workout.sport}</span>
                  <span className="text-zinc-800">•</span>
                  <span>{workout.exercises} Übungen</span>
                </div>
              </div>
            </div>

            <div className="text-zinc-700 group-hover:text-white transition-colors">
              <ChevronRight size={20} />
            </div>
          </div>
        ))
      ) : (
        // Empty State
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-xs text-zinc-800 uppercase tracking-widest font-bold">
            Kein Training am {format(selectedDate, 'dd.MM.')}
          </p>
        </div>
      )}
    </div>
  );

  // --- MAIN RENDER ---
  return (
    // GLOBAL PAGE BACKGROUND: TRUE BLACK (#000000)
    <div className="h-full flex flex-col pt-safe bg-black">
      <Header />
      <ViewSwitcher />

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {/* MONTH VIEW */}
        {view === 'month' && (
          <div className="animate-in fade-in duration-300">
            <CalendarGrid />
            <div className="h-px w-full bg-zinc-900/50 mb-6"></div>

            {/* Header for List */}
            <div className="px-4 mb-4">
              <span className="text-xs font-bold text-zinc-600 uppercase tracking-widest">
                {format(selectedDate, 'EEEE, d. MMMM', { locale: de })}
              </span>
            </div>

            <WorkoutList />
          </div>
        )}

        {/* DAY VIEW */}
        {view === 'day' && (
          <div className="animate-in slide-in-from-bottom-4 duration-300 pt-4">
            <div className="px-4 mb-4">
              <span className="text-xs font-bold text-zinc-600 uppercase tracking-widest">
                {format(selectedDate, 'EEEE, d. MMMM', { locale: de })}
              </span>
            </div>
            <WorkoutList />
          </div>
        )}

        {/* WEEK VIEW (Placeholder) */}
        {view === 'week' && (
          <div className="text-center py-20 text-zinc-700">
            <p>Wochenansicht</p>
          </div>
        )}
      </div>

      {/* FAB */}
      <div className="absolute bottom-24 right-4 z-50">
        <button className="bg-blue-600 hover:bg-blue-500 text-white w-14 h-14 rounded-full shadow-lg shadow-blue-900/20 flex items-center justify-center active:scale-95 transition-transform">
          <Plus size={28} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
};
