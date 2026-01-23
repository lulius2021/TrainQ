// src/pages/WorkoutSharePage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { WorkoutHistoryEntry } from "../utils/workoutHistory";
import { loadWorkoutHistory, onWorkoutHistoryUpdated } from "../utils/workoutHistory";
import { sharePng, savePngToPhotos } from "../utils/shareImage";
import { useI18n } from "../i18n/useI18n";
import { mapWorkoutToShareModel, WorkoutShareExercise, WorkoutShareModel } from "../utils/share/mapWorkoutToShareModel";
import { toPng } from "html-to-image";
import { useAuth } from "../context/AuthContext";
import logoImg from "../assets/logos/Logo.png";
import { motion, AnimatePresence, PanInfo, Variants } from "framer-motion";

// --- FORMATTERS ---
const formatDuration = (seconds?: number | null) => {
  if (!seconds) return "< 1 min";
  const m = Math.floor(seconds / 60);
  if (m < 1) return "< 1 min";
  if (m > 60) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${h}h ${min}min`;
  }
  return `${m} min`;
};

const formatVolume = (kg?: number | null) => {
  if (!kg) return "0 kg";
  if (kg >= 1000) {
    return (kg / 1000).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " t";
  }
  return Math.round(kg).toLocaleString("de-DE") + " kg";
};

// --- BRANDING COMPONENT ---
const BrandFooter = ({ logo, user }: { logo: string; user: string }) => (
  <div className="flex justify-between items-center w-full mt-auto pt-4 relative z-10">
    <div className="flex items-center gap-2 opacity-90">
      <img src={logo} className="h-6 w-auto brightness-0 invert object-contain" alt="Logo" />
      <span className="text-white font-black tracking-[0.2em] text-xs uppercase">TRAINQ</span>
    </div>
    <span className="text-xs text-white/50 font-medium tracking-wide">@{user}</span>
  </div>
);

// --- ANIMATION VARIANTS ---
// Note: direction is 1 (next) or -1 (prev)
const slideVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 350 : -350,
    opacity: 0,
    scale: 0.9
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
    scale: 1
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 350 : -350,
    opacity: 0,
    scale: 0.9
  })
};

// --- TEMPLATE TYPES ---
type TemplateProps = {
  model: WorkoutShareModel;
  user: string;
  logo: string;
};

// 1. Classic List
const TemplateClassic = ({ model, user, logo }: TemplateProps) => {
  const exercises = safeArray<WorkoutShareExercise>(model.exercises).slice(0, 7);
  const prsLabel = (model.highlights?.prsCount || 0) > 0 ? (model.highlights?.prsCount + " PRs 🏆") : (model.setsCount + " Sets");

  return (
    <div className="w-[350px] aspect-[4/5] bg-gradient-to-br from-[#1c1c1e] to-black rounded-[32px] border border-white/5 p-6 flex flex-col shadow-2xl relative overflow-hidden flex-shrink-0 select-none">
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 blur-[60px] rounded-full pointer-events-none" />

      <div className="mb-6 relative z-10">
        <h2 className="text-2xl font-bold text-white mb-0.5 tracking-tight line-clamp-1">{model.title}</h2>
        <div className="text-sm text-white/50 font-medium uppercase tracking-wide">{model.dateLabel}</div>
      </div>

      <div className="flex justify-between items-start mb-6 relative z-10 border-b border-white/5 pb-6">
        <div><div className="text-[10px] uppercase text-white/40 font-bold mb-1">DAUER</div><div className="text-lg font-bold text-white">{formatDuration(model.durationSec)}</div></div>
        <div><div className="text-[10px] uppercase text-white/40 font-bold mb-1">VOLUMEN</div><div className="text-lg font-bold text-white">{formatVolume(model.totalVolumeKg)}</div></div>
        <div className="text-right"><div className="text-[10px] uppercase text-white/40 font-bold mb-1">ERFOLGE</div><div className="text-lg font-bold text-white">{prsLabel}</div></div>
      </div>

      <div className="flex flex-col gap-3 flex-1 min-h-0 relative z-10">
        {exercises.map((ex, i) => (
          <div key={i} className="flex items-center text-sm">
            <span className="text-[#007AFF] font-bold min-w-[28px] text-right mr-3">
              {Math.min(5, Math.max(1, Math.round((ex.volume || 1000) / 500)))}x
            </span>
            <span className="text-white/90 font-medium truncate flex-1 block">{ex.name}</span>
          </div>
        ))}
        {(model.exercises?.length ?? 0) > 7 && (
          <div className="text-xs text-white/30 text-center mt-1">+ {(model.exercises?.length ?? 0) - 7} Weitere</div>
        )}
      </div>

      <BrandFooter logo={logo} user={user} />
    </div>
  );
};

// 2. Big Stats
const TemplateBigStats = ({ model, user, logo }: TemplateProps) => {
  return (
    <div className="w-[350px] aspect-[4/5] bg-black rounded-[32px] p-8 flex flex-col shadow-2xl relative overflow-hidden flex-shrink-0 select-none border border-white/5">
      <div className="relative z-10 flex justify-between items-center mb-12 border-b border-white/10 pb-4">
        <span className="text-sm font-bold text-white/60 tracking-widest">{model.dateLabel.toUpperCase()}</span>
      </div>

      <div className="relative z-10 flex flex-col gap-8 flex-1 justify-center">
        <div>
          <div className="text-[10px] font-bold text-[#007AFF] mb-2 uppercase tracking-[0.2em] opacity-80">WORKOUT DURATION</div>
          <div className="text-6xl font-black text-white leading-none tracking-tighter">
            {formatDuration(model.durationSec)}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-purple-500 mb-2 uppercase tracking-[0.2em] opacity-80">TOTAL LOAD</div>
          <div className="text-6xl font-black text-white leading-none tracking-tighter">
            {formatVolume(model.totalVolumeKg)}
          </div>
        </div>
      </div>

      <div className="mt-auto pt-8 border-t border-white/10">
        <div className="text-xs font-bold text-white/50 mb-4 text-center">{model.exercisesCount} EXERCISES COMPLETED</div>
        <BrandFooter logo={logo} user={user} />
      </div>
    </div>
  );
};

// 3. Muscle Split
const TemplateSplit = ({ model, user, logo }: TemplateProps) => {
  const muscleCounts: Record<string, number> = {};
  let total = 0;
  safeArray(model.exercises).forEach(ex => {
    const main = ex.muscles?.[0] || "General";
    muscleCounts[main] = (muscleCounts[main] || 0) + (ex.volume || 1);
    total += (ex.volume || 1);
  });

  const sorted = Object.entries(muscleCounts).sort((a, b) => b[1] - a[1]);
  const top3 = sorted.slice(0, 3);

  return (
    <div className="w-[350px] aspect-[4/5] bg-gradient-to-b from-slate-900 to-black rounded-[32px] p-8 flex flex-col shadow-2xl relative overflow-hidden flex-shrink-0 border border-white/5 select-none">
      <div className="text-center mb-10">
        <h2 className="text-2xl font-bold text-white mb-2 line-clamp-1">{model.title}</h2>
        <div className="inline-block px-3 py-1 bg-white/5 rounded-full text-xs font-bold text-blue-400 uppercase tracking-widest">{model.sportType}</div>
      </div>

      <div className="flex-1 flex flex-col justify-center gap-6">
        {top3.map(([muscle, val], i) => {
          const percent = total > 0 ? Math.round((val / total) * 100) : 0;
          const colors = ["bg-blue-500", "bg-purple-500", "bg-indigo-500"];
          return (
            <div key={muscle} className="mb-2">
              <div className="flex justify-between text-sm font-bold text-white mb-2">
                <span className="capitalize">{muscle}</span>
                <span>{percent}%</span>
              </div>
              <div className="h-4 bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full ${colors[i % 3]} rounded-full`} style={{ width: `${percent}%` }} />
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-auto pt-4 ">
        <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl mb-4">
          <div className="text-left">
            <div className="text-[10px] text-white/50 uppercase font-bold">FOCUS</div>
            <div className="text-sm font-bold text-white capitalize">{sorted[0]?.[0] || "Full Body"}</div>
          </div>
          <div className="h-8 w-px bg-white/10" />
          <div className="text-right">
            <div className="text-[10px] text-white/50 uppercase font-bold">TOTAL</div>
            <div className="text-sm font-bold text-white">{model.exercisesCount} Exercises</div>
          </div>
        </div>
        <BrandFooter logo={logo} user={user} />
      </div>
    </div>
  );
};

// 4. Streak (Fix: Robust Checkmark SVG)
const TemplateStreak = ({ model, user, logo }: TemplateProps) => {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const todayIndex = new Date().getDay() - 1;
  const idx = todayIndex < 0 ? 6 : todayIndex;

  return (
    <div className="w-[350px] aspect-[4/5] bg-[#0F172A] rounded-[32px] p-8 flex flex-col shadow-2xl relative overflow-hidden flex-shrink-0 border border-white/5 select-none">
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-24 h-24 bg-blue-500 rounded-full flex items-center justify-center mb-8 shadow-lg shadow-blue-500/50">
          {/* Robust Inline SVG for Checkmark */}
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ overflow: 'visible' }}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-white mb-2 text-center">Crushed It!</h2>
        <p className="text-blue-200 text-center font-medium mb-10 text-sm">3 sessions this week.</p>

        <div className="flex gap-3 justify-center">
          {days.map((d, i) => {
            const isActive = i === idx || i === ((idx - 2 + 7) % 7) || i === ((idx - 4 + 7) % 7);
            return (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border flex-shrink-0 ${isActive ? "bg-blue-500 border-blue-500 text-white" : "bg-transparent border-white/10 text-white/30"}`}>
                  {isActive ? "✓" : ""}
                </div>
                <span className="text-[10px] font-bold text-white/40">{d}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-auto">
        <div className="bg-[#1e293b] rounded-xl p-4 flex items-center gap-4 mb-6">
          <div className="h-10 w-10 bg-white/10 rounded-full flex items-center justify-center font-bold text-lg">🔥</div>
          <div>
            <div className="text-xs text-white/50 font-bold uppercase">CURRENT STREAK</div>
            <div className="text-white font-bold">12 Weeks</div>
          </div>
        </div>
        <BrandFooter logo={logo} user={user} />
      </div>
    </div>
  );
};

// 5. Object Comparison
const TemplateObject = ({ model, user, logo }: TemplateProps) => {
  const vol = model.totalVolumeKg || 0;
  let comparison = { label: "Nothing", value: 0, icon: "❓" };

  if (vol > 15000) comparison = { label: "Space Shuttle Tires", value: Math.round(vol / 15000) + 1, icon: "🚀" };
  else if (vol > 2000) comparison = { label: "Tesla Model Ys", value: Math.max(1, Math.round(vol / 2000)), icon: "🚗" };
  else if (vol > 400) comparison = { label: "Grand Pianos", value: Math.max(1, Math.round(vol / 400)), icon: "🎹" };
  else comparison = { label: "Gold Retrievers", value: Math.max(1, Math.round(vol / 30)), icon: "🐕" };

  return (
    <div className="w-[350px] aspect-[4/5] bg-black rounded-[32px] p-8 flex flex-col shadow-2xl relative overflow-hidden flex-shrink-0 border border-white/5 select-none">
      <div className="absolute inset-0 z-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#333 1px, transparent 1px)', backgroundSize: '16px 16px' }} />

      <div className="relative z-10 text-center mt-6">
        <h3 className="text-white/60 font-medium uppercase tracking-widest text-sm mb-2">TOTAL VOLUME LIFTED</h3>
        <div className="text-4xl font-black text-white mb-2">{formatVolume(vol)}</div>
      </div>

      <div className="flex-1 relative z-10 flex flex-col items-center justify-center py-6">
        <div className="text-[100px] leading-none mb-6 drop-shadow-2xl filter grayscale-0">{comparison.icon}</div>
        <div className="text-xl font-bold text-white text-center leading-relaxed">
          That's equal to <br /> <span className="text-yellow-400 text-2xl">{comparison.value} {comparison.label}</span>
        </div>
      </div>

      <div className="relative z-10 border-t border-white/10 pt-4 mt-auto">
        <BrandFooter logo={logo} user={user} />
      </div>
    </div>
  );
};

// 6. Trophy
const TemplateTrophy = ({ model, user, logo }: TemplateProps) => {
  const prs = model.highlights?.prsCount || 0;
  const prItems = model.highlights?.prItems || [];
  const hasPR = prs > 0;

  return (
    <div className="w-[350px] aspect-[4/5] bg-gradient-to-b from-yellow-900/20 to-black rounded-[32px] p-8 flex flex-col shadow-2xl relative overflow-hidden flex-shrink-0 border border-yellow-500/20 select-none">
      <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-yellow-500/10 to-transparent pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center mt-4 pb-4 border-b border-white/5">
        <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center shadow-lg shadow-yellow-500/30 mb-4">
          <span className="text-3xl">🏆</span>
        </div>
        <h2 className="text-2xl font-black text-white uppercase tracking-tight text-center mb-1">
          {hasPR ? `${prs} New PRs` : "Solid Work"}
        </h2>
        <p className="text-yellow-200/60 font-medium text-xs tracking-wide text-center uppercase">
          {model.dateLabel}
        </p>
      </div>

      <div className="flex-1 mt-6 relative z-10 overflow-hidden">
        {hasPR ? (
          <div className="flex flex-col gap-3">
            {prItems.slice(0, 3).map((item, i) => (
              <div key={i} className="bg-white/5 p-3 rounded-xl border border-white/10">
                <div className="text-yellow-400 font-bold text-[10px] uppercase mb-0.5">NEW RECORD</div>
                <div className="text-white font-bold text-sm truncate">{item.label}</div>
                <div className="text-white/60 font-mono text-xs">{item.value}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-5xl font-black text-white/10 mb-2">{model.setsCount}</div>
            <div className="text-white/40 font-bold uppercase">SETS COMPLETED</div>
          </div>
        )}
      </div>

      <div className="mt-auto relative z-10 pt-4">
        <BrandFooter logo={logo} user={user} />
      </div>
    </div>
  );
};


// --- HELPERS ---
const safeArray = <T,>(arr: T[] | undefined | null | unknown): T[] => {
  if (Array.isArray(arr)) return arr;
  return [];
};
const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(" ");
const swipeConfidenceThreshold = 10000;
const swipePower = (offset: number, velocity: number) => Math.abs(offset) * velocity;

const TEMPLATES = [
  { id: "classic", name: "Classic", Comp: TemplateClassic },
  { id: "stats", name: "Big Stats", Comp: TemplateBigStats },
  { id: "split", name: "Muscle Split", Comp: TemplateSplit },
  { id: "streak", name: "Streak", Comp: TemplateStreak },
  { id: "object", name: "Comparison", Comp: TemplateObject },
  { id: "trophy", name: "Trophy", Comp: TemplateTrophy },
];

const DEMO_WORKOUT: any = {
  id: "demo",
  dateISO: new Date().toISOString(),
  title: "Push Day",
  durationSec: 3420,
  totalVolumeKg: 8500,
  exercises: [
    { name: "Bankdrücken", sets: [1, 2, 3, 4], volume: 4000, muscles: ["Chest"] },
    { name: "Schrägbank", sets: [1, 2, 3], volume: 2000, muscles: ["Chest"] },
    { name: "Seitheben", sets: [1, 2, 3, 4], volume: 500, muscles: ["Shoulders"] },
    { name: "Trizepsdrücken", sets: [1, 2, 3], volume: 1000, muscles: ["Triceps"] },
    { name: "Butterfly", sets: [1, 2], volume: 1000, muscles: ["Chest"] }
  ],
  sportType: "Gym",
  setsCount: 16,
  highlights: { prsCount: 2, prItems: [{ label: "Bankdrücken", value: "105 kg × 5" }, { label: "Seitheben", value: "15 kg × 12" }] }
};

type Props = {
  workoutId: string | null;
  onDone: () => void;
};

// --- MAIN PAGE ---
export default function WorkoutSharePage({ workoutId, onDone }: Props) {
  const { lang } = useI18n();
  const { user } = useAuth();
  const [workout, setWorkout] = useState<WorkoutHistoryEntry | null>(null);

  // Stores [currentIndex, direction]
  const [[page, direction], setPage] = useState([0, 0]);

  // Calculate actual index from the potentially infinite 'page' number
  // We use abs(page) to handle negative numbers gracefully if needed, 
  // but simpler modulo logic (a % n + n) % n is usually safest for bidirectional.
  const index = ((page % TEMPLATES.length) + TEMPLATES.length) % TEMPLATES.length;

  const [isExporting, setIsExporting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      if (!workoutId) setWorkout(null);
      else {
        const list = loadWorkoutHistory();
        const found = list.find((w) => w.id === workoutId) ?? null;
        setWorkout(found);
      }
    };
    update();
    const off = onWorkoutHistoryUpdated(update);
    return () => off();
  }, [workoutId]);

  const model = useMemo(() => {
    if (workout) return mapWorkoutToShareModel(workout, lang);
    return mapWorkoutToShareModel(DEMO_WORKOUT, lang);
  }, [workout, lang]);

  const userName = user?.displayName || "Athlete";
  const ActiveTemplate = TEMPLATES[index].Comp;

  // --- PAGINATE ---
  const paginate = (newDirection: number) => {
    setPage([page + newDirection, newDirection]);
  };

  // --- SWIPE LOGIC ---
  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const swipe = swipePower(info.offset.x, info.velocity.x);
    // Left Swipe (negative offset) -> Next Page (direction 1)
    if (swipe < -swipeConfidenceThreshold) {
      paginate(1);
    }
    // Right Swipe (positive offset) -> Prev Page (direction -1)
    else if (swipe > swipeConfidenceThreshold) {
      paginate(-1);
    }
  };

  const handleExport = async (action: 'share' | 'save') => {
    if (!cardRef.current) return;
    setIsExporting(true);
    try {
      // FIX: Wait for SVG/CSS to settle (fixes half-rendered checkmarks)
      await new Promise(resolve => setTimeout(resolve, 500));

      const dataUrl = await toPng(cardRef.current, { cacheBust: true, pixelRatio: 3 });
      const filename = `trainq-workout-${new Date().toISOString().slice(0, 10)}.png`;
      if (action === 'save') await savePngToPhotos(dataUrl, filename);
      else await sharePng(dataUrl, filename);
    } catch (e) {
      console.error(e);
      alert("Export Failed");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black overflow-hidden safe-area-view">

      {/* 1. Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-end z-50 pt-[calc(env(safe-area-inset-top)+16px)]">
        <button onClick={onDone} className="bg-white/10 hover:bg-white/20 text-white rounded-full p-2 backdrop-blur-md transition-all active:scale-95">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>

      {/* 2. Main Scroll Container */}
      <div className="flex-1 w-full flex flex-col items-center overflow-y-auto">
        <div className="my-auto w-full flex flex-col items-center">

          {/* Carousel Area */}
          <div className="relative w-full flex justify-center items-center py-10 overflow-hidden">
            <AnimatePresence initial={false} custom={direction} mode="popLayout">
              <motion.div
                key={page} // Key must be the absolute page count to trigger animation
                ref={cardRef}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: "spring", stiffness: 300, damping: 30 },
                  opacity: { duration: 0.2 }
                }}
                className="cursor-grab active:cursor-grabbing shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9)] relative z-10 flex-shrink-0"
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={1}
                onDragEnd={handleDragEnd}
              >
                <ActiveTemplate model={model} user={userName} logo={logoImg} />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Pagination Dots */}
          <div className="flex gap-2 mb-8 relative z-20">
            {TEMPLATES.map((_, i) => (
              <div key={i} className={cn("rounded-full transition-all duration-300 shadow-sm", i === index ? "w-2 h-2 bg-[#007AFF] shadow-blue-500/50" : "w-1.5 h-1.5 bg-white/20")} />
            ))}
          </div>

          {/* EXPORT BUTTONS with massive bottom margin */}
          <div className="w-full px-6 flex justify-center gap-4 mb-[180px]">
            <button onClick={() => handleExport('save')} disabled={isExporting} className="flex-1 max-w-[160px] bg-[#1c1c1e] hover:bg-[#2c2c2e] active:scale-95 transition-all text-white font-bold h-14 rounded-2xl flex items-center justify-center gap-2 border border-white/10 shadow-xl">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
              Save
            </button>
            <button onClick={() => handleExport('share')} disabled={isExporting} className="flex-1 max-w-[160px] bg-[#007AFF] hover:bg-[#0069d9] active:scale-95 transition-all text-white font-bold h-14 rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-blue-500/20">
              {isExporting ? <span className="animate-spin">⌛</span> : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>
                  Share
                </>
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
