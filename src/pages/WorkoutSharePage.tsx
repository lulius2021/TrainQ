import React, { useEffect, useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import html2canvas from 'html2canvas';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis } from 'recharts';
import type { WorkoutHistoryEntry } from "../utils/workoutHistory";
import { loadWorkoutHistory, onWorkoutHistoryUpdated } from "../utils/workoutHistory";
import { useAuth } from "../context/AuthContext";
import { X, Share2, Download, Dumbbell, Flame, Check, MapPin, Bike, Footprints } from "lucide-react";
import CardioMap from "../components/cardio/CardioMap";
import type { GpsPoint } from "../types/cardio";

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
        <div key={i} className="flex items-start justify-between pb-3 last:border-0" style={{ borderBottom: "1px solid var(--border-color)" }}>
          <div className="flex items-start gap-3 py-1">
            <span className={`text-blue-500 font-bold shrink-0 leading-normal ${isExportMode ? 'text-3xl min-w-[3.5rem]' : 'text-xl min-w-[2.5rem]'}`}>
              {ex.sets?.length || 0}x
            </span>
            <span className={`font-medium truncate h-auto leading-normal ${isExportMode ? 'text-2xl max-w-[400px] min-h-[2.5rem]' : 'text-lg max-w-[200px] min-h-[1.75rem]'}`} style={{ color: "var(--text-color)" }}>
              {ex.name}
            </span>
          </div>
        </div>
      ))}
      {(workout.exercises?.length || 0) > 8 && (
        <div className={`text-center italic ${isExportMode ? 'text-xl pt-4' : 'text-sm pt-2'}`} style={{ color: "var(--text-muted)" }}>
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
        <p className={`font-medium uppercase tracking-widest ${isExportMode ? 'text-2xl mt-4' : 'text-sm'}`} style={{ color: "var(--text-muted)" }}>Cardio Session</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full items-center justify-center -mt-8">
      <div className="w-[115%] aspect-square relative">
        <RadarChart width={300} height={300} cx="50%" cy="50%" outerRadius="70%" data={data} style={{ width: "100%", height: "100%" }}>
          <PolarGrid stroke="currentColor" strokeOpacity={0.15} />
          <PolarAngleAxis dataKey="subject" tick={{ fill: 'currentColor', fontSize: isExportMode ? 24 : 13, fontWeight: 600 }} />
          <Radar
            name="Muscles"
            dataKey="A"
            stroke="#3b82f6"
            strokeWidth={isExportMode ? 6 : 3}
            fill="#3b82f6"
            fillOpacity={0.6}
          />
        </RadarChart>
      </div>
      {/* Legend Badge */}
      <div className={`bg-blue-500/10 rounded-full border border-blue-500/20 mt-[-10px] ${isExportMode ? 'px-8 py-3' : 'px-5 py-2'}`}>
        <span className={`text-blue-400 font-bold uppercase tracking-widest ${isExportMode ? 'text-xl' : 'text-xs'}`}>Muscle Map</span>
      </div>
    </div>
  )
};

// --- COMPARISON ENGINE ---
function getFunnyComparison(tons: number): { text: string, emoji: string } {
  // 0.5t - 1.0t: "Das ist schwerer als ein Klavier 🎹 (und klingt beim Fallenlassen auch so)."
  if (tons >= 0.5 && tons < 1.0) return { text: "Das ist schwerer als ein Klavier (und klingt beim Fallenlassen auch so).", emoji: "🎹" };

  // 1.0t - 1.5t: "Das ist schwerer als ein Fiat 500 🚗. Parkplatzsuche beendet."
  if (tons >= 1.0 && tons < 1.5) return { text: "Das ist schwerer als ein Fiat 500. Parkplatzsuche beendet.", emoji: "🚗" };

  // 1.5t - 2.5t: "Das ist schwerer als ein Flusspferd 🦛. Leg dich besser nicht mit dir an."
  if (tons >= 1.5 && tons < 2.5) return { text: "Das ist schwerer als ein Flusspferd. Leg dich besser nicht mit dir an.", emoji: "🦛" };

  // 2.5t - 5.0t: "Das ist schwerer als ein T-Rex 🦖. Er würde vor Neid erblassen (wenn er noch könnte)."
  if (tons >= 2.5 && tons < 5.0) return { text: "Das ist schwerer als ein T-Rex. Er würde vor Neid erblassen (wenn er noch könnte).", emoji: "🦖" };

  // 5.0t - 7.5t: "Das ist schwerer als ein afrikanischer Elefant 🐘. Törööö, du Biest!"
  if (tons >= 5.0 && tons < 7.5) return { text: "Das ist schwerer als ein afrikanischer Elefant. Törööö, du Biest!", emoji: "🐘" };

  // 7.5t - 15.0t: "Das ist schwerer als ein Schulbus 🚌. Alle einsteigen für den Gain-Train!"
  if (tons >= 7.5 && tons < 15.0) return { text: "Das ist schwerer als ein Schulbus. Alle einsteigen für den Gain-Train!", emoji: "🚌" };

  // > 15.0t: "Das ist schwerer als ein Anker eines Kreuzfahrtschiffs ⚓. Du hältst die ganze Welt fest."
  if (tons >= 15.0) return { text: "Das ist schwerer als ein Anker eines Kreuzfahrtschiffs. Du hältst die ganze Welt fest.", emoji: "⚓" };

  // Fallback < 0.5t
  return { text: "Das ist schwerer als dein innerer Schweinehund. Weiter so!", emoji: "🔥" };
}

const TemplateBeast = ({ volume, workout, isExportMode }: { volume: number, workout: any, isExportMode?: boolean }) => {
  const isCardio = volume === 0 || workout.category === 'cardio';

  // Trigger haptic once on mount if available
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(20);
    }
  }, []);

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
          <p className={`uppercase tracking-[0.2em] mb-3 font-semibold ${isExportMode ? 'text-2xl' : 'text-sm'}`} style={{ color: "var(--text-muted)" }}>{label}</p>
          <div className="flex items-baseline justify-center gap-2">
            <h3 className={`font-black tracking-tighter shadow-xl drop-shadow-2xl ${isExportMode ? 'text-[10rem]' : 'text-7xl'}`} style={{ color: "var(--text-color)" }}>{displayVal}</h3>
            <span className={`font-bold ${isExportMode ? 'text-6xl' : 'text-3xl'}`} style={{ color: "var(--text-muted)" }}>{unit}</span>
          </div>
        </div>

        <div className={`rounded-2xl border backdrop-blur-sm ${isExportMode ? 'p-12 max-w-[600px]' : 'p-6 max-w-[280px]'}`} style={{ backgroundColor: "var(--button-bg)", borderColor: "var(--border-color)" }}>
          <p className={`leading-relaxed ${isExportMode ? 'text-4xl' : 'text-lg'}`} style={{ color: "var(--text-color)" }}>
            Großartige Ausdauerleistung! <br />
            <span className={`text-blue-400 font-bold inline-block mt-1 ${isExportMode ? 'text-5xl' : 'text-xl'}`}>Keep it up! ⚡️</span>
          </p>
        </div>
      </div>
    );
  }

  const volTons = volume / 1000;
  const volStr = volTons.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  // Get dynamic comparison
  const comparison = getFunnyComparison(volTons);

  return (
    <div className="flex flex-col h-full items-center justify-center text-center gap-8 py-4">
      <div className="relative">
        <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full" />
        <Dumbbell size={isExportMode ? 128 : 64} className="text-blue-500 relative z-10" />
      </div>

      <div>
        <p className={`uppercase tracking-[0.2em] mb-3 font-semibold ${isExportMode ? 'text-2xl' : 'text-sm'}`} style={{ color: "var(--text-muted)" }}>Gesamtlast</p>
        <div className="flex items-baseline justify-center gap-2">
          <h3 className={`font-black tracking-tighter shadow-xl drop-shadow-2xl ${isExportMode ? 'text-[10rem]' : 'text-7xl'}`} style={{ color: "var(--text-color)" }}>{volStr}</h3>
          <span className={`font-bold ${isExportMode ? 'text-6xl' : 'text-3xl'}`} style={{ color: "var(--text-muted)" }}>t</span>
        </div>
      </div>

      <div className={`rounded-2xl border backdrop-blur-sm ${isExportMode ? 'p-12 max-w-[600px]' : 'p-6 max-w-[280px]'}`} style={{ backgroundColor: "var(--button-bg)", borderColor: "var(--border-color)" }}>
        <p className={`leading-relaxed ${isExportMode ? 'text-4xl' : 'text-lg'}`} style={{ color: "var(--text-color)" }}>
          {comparison.text.split(comparison.emoji)[0]} <br />
          <span className={`text-blue-400 font-bold inline-block mt-1 transform -rotate-1 ${isExportMode ? 'text-5xl' : 'text-xl'}`}>{comparison.emoji}</span>
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
  const workoutsOnDisk = history.map(h => new Date(h.startedAt));

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
        <div className={`absolute rounded-full text-white font-bold z-20 shadow-lg ${isExportMode ? '-bottom-4 -right-4 text-3xl px-6 py-2' : '-bottom-2 -right-2 text-sm px-3 py-1'}`} style={{ backgroundColor: "var(--accent-color)" }}>
          {displayCount}x
        </div>
      </div>

      <h3 className={`font-bold text-center ${isExportMode ? 'text-6xl mb-4' : 'text-3xl mb-2'}`} style={{ color: "var(--text-color)" }}>Consistent!</h3>
      <p className={`text-center px-4 leading-relaxed ${isExportMode ? 'text-3xl mb-20' : 'text-base mb-12'}`} style={{ color: "var(--text-muted)" }}>
        Das ist dein <span className="text-orange-500 font-bold">{displayCount}. Training</span><br />diese Woche.
      </p>

      <div className={`flex justify-between w-full ${isExportMode ? 'px-8 gap-4' : 'px-2'}`}>
        {weekDays.map((date, i) => {
          const active = checkDate(date);
          const isToday = isSameDay(date, currentWorkoutDate);

          return (
            <div key={i} className="flex flex-col items-center gap-3">
              <div className={`rounded-full flex items-center justify-center border-2 transition-all ${isExportMode ? 'w-20 h-20 border-4' : 'w-9 h-9'} ${active ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-500/30' : 'bg-transparent'}`} style={active ? undefined : { borderColor: "var(--border-color)" }}>
                {active && <Check size={isExportMode ? 40 : 16} className="text-white" strokeWidth={3} />}
              </div>
              <span className={`font-bold uppercase tracking-wider ${isExportMode ? 'text-2xl' : 'text-[10px]'}`} style={{ color: isToday ? "var(--text-color)" : "var(--text-muted)" }}>
                {labels[i]}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
};


// --- ROUTE TEMPLATE (Cardio GPS map) ---

const TemplateRoute = ({ workout, isExportMode }: { workout: any, isExportMode?: boolean }) => {
  const points: GpsPoint[] = Array.isArray(workout.gpsPoints) ? workout.gpsPoints : [];
  const hasRoute = points.length >= 2;

  if (!hasRoute) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-6">
        <div className="relative">
          <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full" />
          <MapPin size={isExportMode ? 160 : 80} className="text-blue-500 relative z-10" />
        </div>
        <p className={`font-medium uppercase tracking-widest ${isExportMode ? 'text-2xl mt-4' : 'text-sm'}`} style={{ color: "var(--text-muted)" }}>
          Keine Route aufgezeichnet
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex-1 min-h-0 rounded-2xl overflow-hidden"
        style={{ minHeight: isExportMode ? 600 : 200 }}
      >
        <CardioMap
          points={points}
          isTracking={false}
          className="w-full h-full"
        />
      </div>
      {workout.distanceKm != null && (
        <div className={`flex items-center justify-center gap-2 ${isExportMode ? 'mt-8' : 'mt-3'}`}>
          <MapPin size={isExportMode ? 32 : 16} className="text-blue-500 shrink-0" />
          <span
            className={`font-black tabular-nums ${isExportMode ? 'text-6xl' : 'text-2xl'}`}
            style={{ color: "var(--text-color)" }}
          >
            {workout.distanceKm.toFixed(2)} km
          </span>
        </div>
      )}
    </div>
  );
};

// --- SHARE CARD (Reused for Preview & Export) ---

const ShareCard = React.forwardRef(({ workout, userName, type, dateStr, history, isExportMode }: any, ref: any) => {
  const volume = getVolume(workout);
  const durationMin = Math.round(getDuration(workout) / 60);

  return (
    <div
      ref={ref}
      className={`flex flex-col relative overflow-hidden select-none ${isExportMode ? 'w-[1080px] h-[1920px] p-20' : 'w-[360px] aspect-[9/16] p-7'}`}
      style={{ backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}
    >
      {/* Background Texture/Gradient */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at top right, rgba(59,130,246,0.08), var(--bg-color) 60%)" }} />

      {/* Header */}
      <div className={`relative z-10 flex justify-between items-start ${isExportMode ? 'mb-16' : 'mb-6'}`}>
        <div>
          <h2 className={`font-black tracking-tighter uppercase italic leading-none ${isExportMode ? 'text-8xl mb-6' : 'text-3xl mb-3'}`} style={{ color: "var(--text-color)" }}>{workout.title}</h2>
          <div className={`flex items-center font-semibold uppercase tracking-wider ${isExportMode ? 'gap-8 text-3xl' : 'gap-3 text-xs'}`} style={{ color: "var(--text-muted)" }}>
            <span>{dateStr}</span>
            <span className={`rounded-full ${isExportMode ? 'w-3 h-3' : 'w-1 h-1'}`} style={{ backgroundColor: "var(--text-muted)" }} />
            <span style={{ color: "var(--text-muted)" }}>{durationMin} Min</span>
            <span className={`rounded-full ${isExportMode ? 'w-3 h-3' : 'w-1 h-1'}`} style={{ backgroundColor: "var(--text-muted)" }} />
            <span className="text-blue-500">
              {volume > 0 ? `${(volume / 1000).toFixed(1)}t` : (workout.distance ? `${workout.distance}km` : 'Cardio')}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className={`text-blue-600 font-black tracking-tighter ${isExportMode ? 'text-6xl' : 'text-xl'}`}>TRAINQ</span>
          <span className={`font-bold uppercase tracking-[0.2em] ${isExportMode ? 'text-2xl mt-2' : 'text-[9px] mt-0.5'}`} style={{ color: "var(--text-muted)" }}>{userName}</span>
        </div>
      </div>

      {/* Content Slot */}
      <div className="relative z-10 flex-1 py-2">
        {type === 'list' && <TemplateList workout={workout} isExportMode={isExportMode} />}
        {type === 'radar' && <TemplateRadar workout={workout} isExportMode={isExportMode} />}
        {type === 'beast' && <TemplateBeast volume={volume} workout={workout} isExportMode={isExportMode} />}
        {type === 'streak' && <TemplateStreak history={history} currentWorkoutDate={new Date(workout.startedAt || workout.dateISO)} isExportMode={isExportMode} />}
        {type === 'route' && <TemplateRoute workout={workout} isExportMode={isExportMode} />}
      </div>

      {/* Footer Brand */}
      <div className={`relative z-10 mt-auto flex justify-between items-end ${isExportMode ? 'pt-16' : 'pt-6'}`} style={{ borderTop: "1px solid var(--border-color)" }}>
        <div className="flex flex-col gap-1">
          <div className={`flex items-center ${isExportMode ? 'gap-4' : 'gap-1.5'}`}>
            <div className={`bg-blue-600 rounded-full animate-pulse ${isExportMode ? 'w-4 h-4' : 'w-1.5 h-1.5'}`} />
            <span className={`font-bold ${isExportMode ? 'text-3xl' : 'text-xs'}`} style={{ color: "var(--text-muted)" }}>TrainQ Pro</span>
          </div>
        </div>
        <div className={`font-medium tracking-wide ${isExportMode ? 'text-3xl' : 'text-[10px]'}`} style={{ color: "var(--text-muted)" }}>trainq.app</div>
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

  const isCardioWorkout =
    finalWorkout.sport === "Laufen" ||
    finalWorkout.sport === "Radfahren" ||
    finalWorkout.category === "cardio";
  const hasGpsRoute =
    isCardioWorkout &&
    Array.isArray((finalWorkout as any).gpsPoints) &&
    (finalWorkout as any).gpsPoints.length >= 2;

  const TEMPLATES = [
    { key: 'list', label: 'Overview' },
    { key: 'radar', label: 'Muscle Map' },
    { key: 'beast', label: 'Beast Mode' },
    { key: 'streak', label: 'Consistency' },
    ...(hasGpsRoute ? [{ key: 'route', label: 'Route' }] : []),
  ];
  const currentTemplate = TEMPLATES[templateIndex];

  const swipeDir = useRef<1 | -1>(1);
  const swipeTouchStartX = useRef<number | null>(null);

  const nextT = () => { swipeDir.current = 1; setTemplateIndex((p) => (p + 1) % TEMPLATES.length); };
  const prevT = () => { swipeDir.current = -1; setTemplateIndex((p) => (p - 1 + TEMPLATES.length) % TEMPLATES.length); };

  const handleSwipeTouchStart = (e: React.TouchEvent) => {
    swipeTouchStartX.current = e.touches[0].clientX;
  };
  const handleSwipeTouchEnd = (e: React.TouchEvent) => {
    if (swipeTouchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - swipeTouchStartX.current;
    swipeTouchStartX.current = null;
    if (Math.abs(delta) < 40) return;
    if (delta < 0) nextT(); else prevT();
  };

  // EXPORT HANDLER (Targets HIDDEN Container)
  const handleExport = async (mode: 'share' | 'save') => {
    if (!exportRef.current) return;
    setIsExporting(true);

    try {
      await new Promise(r => setTimeout(r, 100)); // Brief repaint wait

      const cvs = await html2canvas(exportRef.current, {
        scale: 1, // 1:1 since container is already 1080x1920
        useCORS: true,
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-color').trim() || '#09090b',
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
      if (import.meta.env.DEV) console.error("Export failed", e);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col h-[100dvh] overflow-hidden" style={{ backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}>

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
      <div className="flex-none w-full p-4 pt-[calc(env(safe-area-inset-top)+12px)] flex justify-between items-center z-50">
        <span className="font-bold text-lg tracking-tight pl-2">Workout teilen</span>
        <button onClick={onDone} className="rounded-full p-2 transition backdrop-blur-md" style={{ backgroundColor: "var(--button-bg)", border: "1px solid var(--border-color)" }}>
          <X size={20} style={{ color: "var(--text-secondary)" }} />
        </button>
      </div>

      <div
        className="flex-1 flex flex-col items-center justify-center relative w-full overflow-hidden"
        onTouchStart={handleSwipeTouchStart}
        onTouchEnd={handleSwipeTouchEnd}
      >
        <AnimatePresence mode="wait" initial={false} custom={swipeDir.current}>
          <motion.div
            key={templateIndex}
            custom={swipeDir.current}
            initial={{ x: swipeDir.current * 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: swipeDir.current * -300, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="transform scale-[0.60] xs:scale-[0.68] sm:scale-[0.76] shadow-2xl shadow-blue-900/10 rounded-[32px] overflow-hidden"
            style={{ border: "1px solid var(--border-color)" }}
          >
            <ShareCard
              workout={finalWorkout}
              userName={finalUserName}
              type={currentTemplate.key}
              dateStr={dateStr}
              history={history}
              isExportMode={false}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex-none w-full rounded-t-[32px] px-6 pt-4 pb-[calc(env(safe-area-inset-bottom)+16px)] flex flex-col items-center z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.08)]" style={{ backgroundColor: "var(--card-bg)", borderTop: "1px solid var(--border-color)" }}>
        <div className="flex gap-2.5 mb-5">
          {TEMPLATES.map((t, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === templateIndex ? 'w-8 bg-blue-500 shadow-blue-500/50 shadow-sm' : 'w-1.5'}`} style={i === templateIndex ? undefined : { backgroundColor: "var(--border-color)" }} />
          ))}
        </div>

        <div className="flex gap-4 w-full max-w-sm mb-3">
          <button
            onClick={() => handleExport('save')}
            disabled={isExporting}
            className="flex-1 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 active:scale-95 transition"
            style={{ backgroundColor: "var(--button-bg)", color: "var(--text-color)", border: "1px solid var(--border-color)" }}
          >
            <Download size={18} />
            Speichern
          </button>
          <button
            onClick={() => handleExport('share')}
            disabled={isExporting}
            className="flex-1 bg-blue-600 text-white py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 active:scale-95 transition shadow-lg shadow-blue-600/20 hover:bg-blue-500"
          >
            {isExporting ? <span className="animate-spin">◌</span> : <Share2 size={18} />}
            Teilen
          </button>
        </div>

        <div className="text-[10px] uppercase tracking-widest font-bold" style={{ color: "var(--text-muted)" }}>
          {currentTemplate.label}
        </div>
      </div>

    </div>
  );
}
