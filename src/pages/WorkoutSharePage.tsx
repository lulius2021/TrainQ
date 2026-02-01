import React, { useEffect, useState, useRef } from "react";
import html2canvas from 'html2canvas';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import type { WorkoutHistoryEntry } from "../utils/workoutHistory";
import { loadWorkoutHistory, onWorkoutHistoryUpdated } from "../utils/workoutHistory";
import { useAuth } from "../context/AuthContext";
import { X, Share2, Download, ChevronLeft, ChevronRight, Dumbbell, Flame, Check, MapPin, Bike, Footprints } from "lucide-react";

// --- MOCK DATA ---
const MOCK_WORKOUT: any = {
  id: "mock-safety-net",
  dateISO: new Date().toISOString(),
  title: "Full Body Power",
  durationSec: 64 * 60,
  totalVolume: 7672,
  exercises: [
    { name: "Seitheben (Maschine)", sets: [{}, {}, {}, {}] },
    { name: "Bankdrücken", sets: [{}, {}, {}] },
    { name: "Russian Twist", sets: [{ isPR: true }, {}, {}, {}] },
  ],
  sport: "Gym",
};

// --- UTILS ---
function getVolume(w: any): number {
  if (w.totalVolume && w.totalVolume >= 0) return w.totalVolume;
  let sum = 0;
  w.exercises?.forEach((e: any) => {
    e.sets?.forEach((s: any) => {
      sum += (s.weight || 0) * (s.reps || 0);
    });
  });
  return sum;
}

function getDuration(w: any): number {
  if (w.durationSec && w.durationSec > 0) return w.durationSec;
  return 0;
}

function getMuscleData(workout: any) {
  const categories = [
    { subject: 'Brust', A: 0, fullMark: 100 },
    { subject: 'Rücken', A: 0, fullMark: 100 },
    { subject: 'Beine', A: 0, fullMark: 100 },
    { subject: 'Arme', A: 0, fullMark: 100 },
    { subject: 'Schultern', A: 0, fullMark: 100 },
  ];

  (workout.exercises || []).forEach((ex: any) => {
    const name = (ex.name || "").toLowerCase();
    const sets = ex.sets?.length || 0;

    if (name.match(/bench|press|brust|chest|pec|fly/)) categories[0].A += sets * 10;
    else if (name.match(/row|pull|rücken|back|lat|deadlift|hebe/)) categories[1].A += sets * 10;
    else if (name.match(/squat|beine|leg|wade|calf|knie|presse/)) categories[2].A += sets * 10;
    else if (name.match(/bizeps|trizeps|arm|curl|pushdown/)) categories[3].A += sets * 10;
    else if (name.match(/seitheben|schulter|shoulder|military|overhead/)) categories[4].A += sets * 10;
    else categories[0].A += sets * 5;
  });

  return categories;
}

// --- TEMPLATES (EXPORT MODE AWARE) ---

const TemplateList = ({ workout, isExportMode }: { workout: any, isExportMode?: boolean }) => (
  <div className={`flex flex-col h-full ${isExportMode ? 'pt-8 px-4' : 'pt-4 px-2'}`}>
    <div className={`space-y-${isExportMode ? '6' : '4'}`}>
      {(workout.exercises || []).slice(0, 8).map((ex: any, i: number) => (
        <div key={i} className="flex items-center justify-between border-b border-white/10 pb-3 last:border-0">
          <div className="flex items-center gap-3">
            <span className={`text-blue-500 font-bold ${isExportMode ? 'text-3xl min-w-[3.5rem]' : 'text-xl min-w-[2.5rem]'}`}>
              {ex.sets?.length || 0}x
            </span>
            <span className={`text-white font-medium truncate ${isExportMode ? 'text-2xl max-w-[400px]' : 'text-lg max-w-[200px]'}`}>
              {ex.name}
            </span>
          </div>
        </div>
      ))}
      {(workout.exercises?.length || 0) > 8 && (
        <div className={`text-center text-zinc-500 italic ${isExportMode ? 'text-xl pt-4' : 'text-sm pt-2'}`}>
          ...und {workout.exercises.length - 8} weitere
        </div>
      )}
      {(workout.exercises?.length || 0) === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-4 mt-8">
          <Footprints size={isExportMode ? 96 : 48} className="text-zinc-700" />
          <span className={isExportMode ? 'text-2xl' : 'text-sm'}>Keine Übungen aufgezeichnet</span>
        </div>
      )}
    </div>
  </div>
);

const TemplateRadar = ({ workout, isExportMode }: { workout: any, isExportMode?: boolean }) => {
  const data = getMuscleData(workout);
  const hasData = data.some(d => d.A > 0);

  if (!hasData) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-6">
        <div className="relative">
          <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full" />
          {workout.sport === 'Cycling' ? (
            <Bike size={isExportMode ? 160 : 80} className="text-blue-500 relative z-10" />
          ) : (
            <Footprints size={isExportMode ? 160 : 80} className="text-blue-500 relative z-10" />
          )}
        </div>
        <p className={`text-zinc-400 font-medium uppercase tracking-widest ${isExportMode ? 'text-2xl mt-4' : 'text-sm'}`}>Cardio Session</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full items-center justify-center -mt-8">
      <div className="w-[115%] aspect-square relative">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid stroke="rgba(255,255,255,0.15)" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#e4e4e7', fontSize: isExportMode ? 24 : 13, fontWeight: 600 }} />
            <Radar
              name="Muscles"
              dataKey="A"
              stroke="#3b82f6"
              strokeWidth={isExportMode ? 6 : 3}
              fill="#3b82f6"
              fillOpacity={0.6}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      {/* Legend Badge */}
      <div className={`bg-blue-500/10 rounded-full border border-blue-500/20 mt-[-10px] ${isExportMode ? 'px-8 py-3' : 'px-5 py-2'}`}>
        <span className={`text-blue-400 font-bold uppercase tracking-widest ${isExportMode ? 'text-xl' : 'text-xs'}`}>Muscle Map</span>
      </div>
    </div>
  )
};

const TemplateBeast = ({ volume, workout, isExportMode }: { volume: number, workout: any, isExportMode?: boolean }) => {
  const isCardio = volume === 0 || workout.category === 'cardio';

  if (isCardio) {
    const dist = workout.distance || 0; // km
    const displayVal = dist > 0 ? dist.toFixed(2) : (getDuration(workout) / 60).toFixed(0);
    const unit = dist > 0 ? 'km' : 'Min';
    const label = dist > 0 ? 'Strecke zurückgelegt' : 'Dauer';

    return (
      <div className="flex flex-col h-full items-center justify-center text-center gap-8 py-4">
        <div className="relative">
          <div className={`absolute inset-0 bg-blue-500/20 blur-3xl rounded-full`} />
          <MapPin size={isExportMode ? 128 : 64} className="text-blue-500 relative z-10" />
        </div>

        <div>
          <p className={`text-zinc-400 uppercase tracking-[0.2em] mb-3 font-semibold ${isExportMode ? 'text-2xl' : 'text-sm'}`}>{label}</p>
          <div className="flex items-baseline justify-center gap-2">
            <h3 className={`font-black text-white tracking-tighter shadow-xl drop-shadow-2xl ${isExportMode ? 'text-[10rem]' : 'text-7xl'}`}>{displayVal}</h3>
            <span className={`text-zinc-500 font-bold ${isExportMode ? 'text-6xl' : 'text-3xl'}`}>{unit}</span>
          </div>
        </div>

        <div className={`bg-zinc-800/80 rounded-2xl border border-white/10 backdrop-blur-sm ${isExportMode ? 'p-12 max-w-[600px]' : 'p-6 max-w-[280px]'}`}>
          <p className={`text-zinc-200 leading-relaxed ${isExportMode ? 'text-4xl' : 'text-lg'}`}>
            Großartige Ausdauerleistung! <br />
            <span className={`text-blue-400 font-bold inline-block mt-1 ${isExportMode ? 'text-5xl' : 'text-xl'}`}>Keep it up! ⚡️</span>
          </p>
        </div>
      </div>
    );
  }

  const volStr = (volume / 1000).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (
    <div className="flex flex-col h-full items-center justify-center text-center gap-8 py-4">
      <div className="relative">
        <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full" />
        <Dumbbell size={isExportMode ? 128 : 64} className="text-blue-500 relative z-10" />
      </div>

      <div>
        <p className={`text-zinc-400 uppercase tracking-[0.2em] mb-3 font-semibold ${isExportMode ? 'text-2xl' : 'text-sm'}`}>Gesamtlast</p>
        <div className="flex items-baseline justify-center gap-2">
          <h3 className={`font-black text-white tracking-tighter shadow-xl drop-shadow-2xl ${isExportMode ? 'text-[10rem]' : 'text-7xl'}`}>{volStr}</h3>
          <span className={`text-zinc-500 font-bold ${isExportMode ? 'text-6xl' : 'text-3xl'}`}>t</span>
        </div>
      </div>

      <div className={`bg-zinc-800/80 rounded-2xl border border-white/10 backdrop-blur-sm ${isExportMode ? 'p-12 max-w-[600px]' : 'p-6 max-w-[280px]'}`}>
        <p className={`text-zinc-200 leading-relaxed ${isExportMode ? 'text-4xl' : 'text-lg'}`}>
          Das ist schwerer als ein <br />
          <span className={`text-blue-400 font-bold inline-block mt-1 transform -rotate-1 ${isExportMode ? 'text-5xl' : 'text-xl'}`}>T-Rex 🦖</span>
        </p>
      </div>
    </div>
  )
};

const TemplateStreak = ({ history, currentWorkoutDate, isExportMode }: { history: WorkoutHistoryEntry[], currentWorkoutDate: Date, isExportMode?: boolean }) => {
  const d = new Date(currentWorkoutDate);
  if (isNaN(d.getTime())) return null;

  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const temp = new Date(monday);
    temp.setDate(monday.getDate() + i);
    return temp;
  });

  const isSameDay = (d1: Date, d2: Date) => d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
  const workoutsOnDisk = history.map(h => new Date(h.startedAt || h.dateISO));

  const checkDate = (date: Date) => {
    if (isSameDay(date, currentWorkoutDate)) return true;
    return workoutsOnDisk.some(wd => isSameDay(wd, date));
  };

  const count = weekDays.filter(checkDate).length;
  const displayCount = count > 0 ? count : 1;

  const labels = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  return (
    <div className="flex flex-col h-full items-center justify-center pt-2">
      <div className={`relative ${isExportMode ? 'mb-20' : 'mb-10'}`}>
        <div className="absolute inset-0 bg-orange-500/20 blur-2xl rounded-full" />
        <Flame size={isExportMode ? 160 : 80} className="text-orange-500 fill-orange-500/20 relative z-10" />
        <div className={`absolute bg-zinc-800 text-white font-bold rounded-full border border-zinc-800 z-20 shadow-lg ${isExportMode ? '-bottom-4 -right-4 text-3xl px-6 py-2' : '-bottom-2 -right-2 text-sm px-3 py-1'}`}>
          {displayCount}x
        </div>
      </div>

      <h3 className={`font-bold text-white text-center ${isExportMode ? 'text-6xl mb-4' : 'text-3xl mb-2'}`}>Consistent!</h3>
      <p className={`text-zinc-400 text-center px-4 leading-relaxed ${isExportMode ? 'text-3xl mb-20' : 'text-base mb-12'}`}>
        Das ist dein <span className="text-orange-500 font-bold">{displayCount}. Training</span><br />diese Woche.
      </p>

      <div className={`flex justify-between w-full ${isExportMode ? 'px-8 gap-4' : 'px-2'}`}>
        {weekDays.map((date, i) => {
          const active = checkDate(date);
          const isToday = isSameDay(date, currentWorkoutDate);

          return (
            <div key={i} className="flex flex-col items-center gap-3">
              <div className={`rounded-full flex items-center justify-center border-2 transition-all ${isExportMode ? 'w-20 h-20 border-4' : 'w-9 h-9'} ${active ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-500/30' : 'bg-transparent border-zinc-800'}`}>
                {active && <Check size={isExportMode ? 40 : 16} className="text-white" strokeWidth={3} />}
              </div>
              <span className={`font-bold uppercase tracking-wider ${isExportMode ? 'text-2xl' : 'text-[10px]'} ${isToday ? 'text-white' : 'text-zinc-600'}`}>
                {labels[i]}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
};


// --- SHARE CARD (Reused for Preview & Export) ---

const ShareCard = React.forwardRef(({ workout, userName, type, dateStr, history, isExportMode }: any, ref: any) => {
  const volume = getVolume(workout);
  const durationMin = Math.round(getDuration(workout) / 60);

  return (
    <div
      ref={ref}
      className={`bg-zinc-950 flex flex-col relative overflow-hidden select-none ${isExportMode ? 'w-[1080px] h-[1920px] p-20' : 'w-[360px] aspect-[9/16] p-7'}`}
    >
      {/* Background Texture/Gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-900/20 via-zinc-950 to-zinc-950 pointer-events-none" />

      {/* Header */}
      <div className={`relative z-10 flex justify-between items-start ${isExportMode ? 'mb-16' : 'mb-6'}`}>
        <div>
          <h2 className={`font-black text-white tracking-tighter uppercase italic leading-none ${isExportMode ? 'text-8xl mb-6' : 'text-3xl mb-3'}`}>{workout.title}</h2>
          <div className={`flex items-center font-semibold text-zinc-400 uppercase tracking-wider ${isExportMode ? 'gap-8 text-3xl' : 'gap-3 text-xs'}`}>
            <span>{dateStr}</span>
            <span className={`rounded-full bg-zinc-700 ${isExportMode ? 'w-3 h-3' : 'w-1 h-1'}`} />
            <span className="text-zinc-300">{durationMin} Min</span>
            <span className={`rounded-full bg-zinc-700 ${isExportMode ? 'w-3 h-3' : 'w-1 h-1'}`} />
            <span className="text-blue-400">
              {volume > 0 ? `${(volume / 1000).toFixed(1)}t` : (workout.distance ? `${workout.distance}km` : 'Cardio')}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className={`text-blue-500 font-black tracking-tighter ${isExportMode ? 'text-6xl' : 'text-xl'}`}>TRAINQ</span>
          <span className={`text-zinc-600 font-bold uppercase tracking-[0.2em] ${isExportMode ? 'text-2xl mt-2' : 'text-[9px] mt-0.5'}`}>{userName}</span>
        </div>
      </div>

      {/* Content Slot */}
      <div className="relative z-10 flex-1 py-2">
        {type === 'list' && <TemplateList workout={workout} isExportMode={isExportMode} />}
        {type === 'radar' && <TemplateRadar workout={workout} isExportMode={isExportMode} />}
        {type === 'beast' && <TemplateBeast volume={volume} workout={workout} isExportMode={isExportMode} />}
        {type === 'streak' && <TemplateStreak history={history} currentWorkoutDate={new Date(workout.startedAt || workout.dateISO)} isExportMode={isExportMode} />}
      </div>

      {/* Footer Brand */}
      <div className={`relative z-10 mt-auto border-t border-white/10 flex justify-between items-end ${isExportMode ? 'pt-16' : 'pt-6'}`}>
        <div className="flex flex-col gap-1">
          <div className={`flex items-center ${isExportMode ? 'gap-4' : 'gap-1.5'}`}>
            <div className={`bg-blue-500 rounded-full animate-pulse ${isExportMode ? 'w-4 h-4' : 'w-1.5 h-1.5'}`} />
            <span className={`font-bold text-zinc-300 ${isExportMode ? 'text-3xl' : 'text-xs'}`}>TrainQ Pro</span>
          </div>
        </div>
        <div className={`text-zinc-600 font-medium tracking-wide ${isExportMode ? 'text-3xl' : 'text-[10px]'}`}>trainq.app</div>
      </div>
    </div>
  );
});

// --- MAIN PAGE (CONTROLLER) ---

export default function WorkoutSharePage({ workoutId, onDone }: { workoutId: string | null, onDone: () => void }) {
  const { user } = useAuth();
  const [templateIndex, setTemplateIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  // REFS
  const exportRef = useRef<HTMLDivElement>(null);

  // State
  const [history, setHistory] = useState<WorkoutHistoryEntry[]>([]);
  const [loadedWorkout, setLoadedWorkout] = useState<WorkoutHistoryEntry | null>(null);

  useEffect(() => {
    const h = loadWorkoutHistory();
    setHistory(h);
    if (workoutId) {
      const found = h.find(x => x.id === workoutId);
      setLoadedWorkout(found || null);
    }
  }, [workoutId]);

  const finalWorkout = loadedWorkout || MOCK_WORKOUT;

  const finalUserName = user?.displayName || "Athlete";
  const dateObj = new Date(finalWorkout.startedAt || finalWorkout.dateISO);
  const dateStr = !isNaN(dateObj.getTime())
    ? dateObj.toLocaleDateString("de-DE", { day: '2-digit', month: '2-digit', year: 'numeric' })
    : "N/A";

  const TEMPLATES = [
    { key: 'list', label: 'Overview' },
    { key: 'radar', label: 'Muscle Map' },
    { key: 'beast', label: 'Beast Mode' },
    { key: 'streak', label: 'Consistency' },
  ];
  const currentTemplate = TEMPLATES[templateIndex];

  const nextT = () => setTemplateIndex((p) => (p + 1) % TEMPLATES.length);
  const prevT = () => setTemplateIndex((p) => (p - 1 + TEMPLATES.length) % TEMPLATES.length);

  // EXPORT HANDLER (Targets HIDDEN Container)
  const handleExport = async (mode: 'share' | 'save') => {
    if (!exportRef.current) return;
    setIsExporting(true);

    try {
      await new Promise(r => setTimeout(r, 100)); // Brief repaint wait

      const cvs = await html2canvas(exportRef.current, {
        scale: 1, // 1:1 since container is already 1080x1920
        useCORS: true,
        backgroundColor: '#09090b',
        logging: false,
        width: 1080,
        height: 1920,
        windowWidth: 1080,
        windowHeight: 1920
      });

      cvs.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `trainq-share-${Date.now()}.png`, { type: 'image/png' });

        if (mode === 'share' && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file] });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `trainq-share.png`;
          a.click();
        }
      });
    } catch (e) {
      console.error("Export failed", e);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-zinc-950 text-white h-[100dvh] overflow-hidden">

      {/* HIDDEN EXPORT STAGE (Always renders active template in 1080x1920) */}
      <div style={{ position: 'fixed', top: '-10000px', left: '-10000px', pointerEvents: 'none', visibility: 'visible' }}>
        <div ref={exportRef}>
          <ShareCard
            workout={finalWorkout}
            userName={finalUserName}
            type={currentTemplate.key}
            dateStr={dateStr}
            history={history}
            isExportMode={true} // Triggers Large Layout
          />
        </div>
      </div>

      {/* VISIBLE UI */}
      <div className="absolute top-0 left-0 right-0 p-4 pt-[calc(env(safe-area-inset-top)+12px)] flex justify-between items-center z-50">
        <span className="font-bold text-lg tracking-tight pl-2">Workout teilen</span>
        <button onClick={onDone} className="bg-zinc-800/80 p-2 rounded-full hover:bg-zinc-700 transition backdrop-blur-md">
          <X size={20} className="text-zinc-300" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative w-full overflow-hidden mt-8">
        <button onClick={prevT} className="absolute left-4 md:left-12 z-40 bg-zinc-800/50 p-3 rounded-full backdrop-blur-md text-white/70 hover:text-white hover:bg-zinc-700/50 transition">
          <ChevronLeft size={24} />
        </button>
        <button onClick={nextT} className="absolute right-4 md:right-12 z-40 bg-zinc-800/50 p-3 rounded-full backdrop-blur-md text-white/70 hover:text-white hover:bg-zinc-700/50 transition">
          <ChevronRight size={24} />
        </button>

        <div className="transform scale-[0.80] xs:scale-[0.9] sm:scale-100 shadow-2xl shadow-blue-900/10 rounded-[32px] overflow-hidden border border-white/10 ring-1 ring-white/5">
          <ShareCard
            workout={finalWorkout}
            userName={finalUserName}
            type={currentTemplate.key}
            dateStr={dateStr}
            history={history}
            isExportMode={false} // Normal scaling
          />
        </div>
      </div>

      <div className="flex-none w-full bg-[#121214] border-t border-white/5 rounded-t-[32px] px-6 pt-6 pb-24 flex flex-col items-center z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        <div className="flex gap-2.5 mb-8">
          {TEMPLATES.map((t, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === templateIndex ? 'w-8 bg-blue-500 shadow-blue-500/50 shadow-sm' : 'w-1.5 bg-zinc-800'}`} />
          ))}
        </div>

        <div className="flex gap-4 w-full max-w-sm mb-4">
          <button
            onClick={() => handleExport('save')}
            disabled={isExporting}
            className="flex-1 bg-zinc-800 text-zinc-200 py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 active:scale-95 transition hover:bg-zinc-750"
          >
            <Download size={18} />
            Speichern
          </button>
          <button
            onClick={() => handleExport('share')}
            disabled={isExporting}
            className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 active:scale-95 transition shadow-lg shadow-blue-600/20 hover:bg-blue-500"
          >
            {isExporting ? <span className="animate-spin">◌</span> : <Share2 size={18} />}
            Teilen
          </button>
        </div>

        <div className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">
          {currentTemplate.label}
        </div>
      </div>

    </div>
  );
}
