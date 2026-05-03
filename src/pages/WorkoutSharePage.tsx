import React, { useEffect, useState, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import html2canvas from 'html2canvas';
import type { WorkoutHistoryEntry } from "../utils/workoutHistory";
import { loadWorkoutHistory } from "../utils/workoutHistory";
import { useAuth } from "../context/AuthContext";
import { X, Share2, Download, Dumbbell, Flame, Check, Trophy, Zap, TrendingUp, Target } from "lucide-react";
import { hapticLight, hapticSuccess } from "../native/haptics";
import { MotionDiv } from "../components/ui/Motion";
import { useI18n } from "../i18n/useI18n";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

const shareSlideVariants = {
  enter: (dir: number) => ({ x: dir >= 0 ? "100%" : "-100%", opacity: 0.3 }),
  center: { x: "0%", opacity: 1 },
  exit: (dir: number) => ({ x: dir >= 0 ? "-100%" : "100%", opacity: 0.3 }),
};

// --- UTILS ---
function getVolume(w: any): number {
  if (w.totalVolume && w.totalVolume >= 0) return w.totalVolume;
  let sum = 0;
  w.exercises?.forEach((e: any) => {
    e.sets?.forEach((s: any) => { sum += (s.weight || 0) * (s.reps || 0); });
  });
  return sum;
}

function getDurationMin(w: any): number {
  if (w.durationSec && w.durationSec > 0) return Math.round(w.durationSec / 60);
  return 0;
}

function getTotalSets(w: any): number {
  return (w.exercises || []).reduce((acc: number, ex: any) => acc + (ex.sets?.length || 0), 0);
}

function getPRCount(w: any): number {
  let count = 0;
  (w.exercises || []).forEach((ex: any) => {
    (ex.sets || []).forEach((s: any) => { if (s.isPR) count++; });
  });
  return count;
}

function getTopExercise(w: any): { name: string; bestSet: string } | null {
  let best: { name: string; score: number; weight: number; reps: number } | null = null;
  (w.exercises || []).forEach((ex: any) => {
    (ex.sets || []).forEach((s: any) => {
      const score = (s.weight || 0) * (s.reps || 0);
      if (score > 0 && (!best || score > best.score)) {
        best = { name: ex.name, score, weight: s.weight, reps: s.reps };
      }
    });
  });
  if (!best) return null;
  return { name: (best as any).name, bestSet: `${(best as any).weight}kg × ${(best as any).reps}` };
}

function isGymWorkout(w: any): boolean {
  const sport = String(w.sport || "").toLowerCase();
  return sport === "gym" || sport === "" || (!sport.includes("lauf") && !sport.includes("rad") && !sport.includes("run") && !sport.includes("cycl"));
}

function getFunnyComparison(tons: number): { text: string; emoji: string } {
  if (tons >= 15.0) return { text: "Schwerer als ein Schiffsanker", emoji: "⚓" };
  if (tons >= 7.5) return { text: "Schwerer als ein Schulbus", emoji: "🚌" };
  if (tons >= 5.0) return { text: "Schwerer als ein Elefant", emoji: "🐘" };
  if (tons >= 2.5) return { text: "Schwerer als ein T-Rex", emoji: "🦖" };
  if (tons >= 1.5) return { text: "Schwerer als ein Flusspferd", emoji: "🦛" };
  if (tons >= 1.0) return { text: "Schwerer als ein Fiat 500", emoji: "🚗" };
  if (tons >= 0.5) return { text: "Schwerer als ein Klavier", emoji: "🎹" };
  return { text: "Stärker als der Schweinehund", emoji: "🔥" };
}

// ============================================================
// TEMPLATE 1: CLEAN OVERVIEW — Exercise list + stats bar
// ============================================================
const TemplateOverview = ({ workout, durationMin, volume, sets, isExport }: any) => (
  <div className="flex flex-col h-full">
    {/* Stats Row */}
    <div className={`grid grid-cols-3 gap-2 ${isExport ? 'mb-12' : 'mb-4'}`}>
      {[
        { label: "Min", value: durationMin || "–" },
        { label: "Sätze", value: sets || "–" },
        { label: isGymWorkout(workout) ? "Volumen" : "Distanz", value: isGymWorkout(workout) ? (volume > 0 ? `${(volume / 1000).toFixed(1)}t` : "–") : (workout.distanceKm ? `${workout.distanceKm.toFixed(1)}km` : "–") },
      ].map((s, i) => (
        <div key={i} className={`rounded-2xl text-center ${isExport ? 'py-6' : 'py-2.5'}`} style={{ backgroundColor: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)" }}>
          <div className={`font-black text-blue-500 ${isExport ? 'text-5xl mb-2' : 'text-xl mb-0.5'}`}>{s.value}</div>
          <div className={`font-semibold uppercase tracking-wider ${isExport ? 'text-xl' : 'text-[9px]'}`} style={{ color: "var(--text-muted)" }}>{s.label}</div>
        </div>
      ))}
    </div>

    {/* Exercise List */}
    <div className={`flex-1 ${isExport ? 'space-y-5' : 'space-y-2'}`}>
      {(workout.exercises || []).slice(0, 7).map((ex: any, i: number) => (
        <div key={i} className={`flex items-center justify-between ${isExport ? 'py-4' : 'py-1.5'}`} style={{ borderBottom: "1px solid var(--border-color)" }}>
          <div className="flex items-center gap-3 min-w-0">
            <span className={`font-black text-blue-500 shrink-0 ${isExport ? 'text-4xl w-14' : 'text-base w-6'}`}>{i + 1}</span>
            <span className={`font-semibold truncate ${isExport ? 'text-3xl max-w-[500px]' : 'text-sm max-w-[180px]'}`} style={{ color: "var(--text-color)" }}>{ex.name}</span>
          </div>
          <span className={`font-bold shrink-0 ${isExport ? 'text-2xl' : 'text-xs'}`} style={{ color: "var(--text-muted)" }}>{ex.sets?.length || 0} Sets</span>
        </div>
      ))}
      {(workout.exercises?.length || 0) > 7 && (
        <div className={`text-center ${isExport ? 'text-2xl pt-4' : 'text-xs pt-1'}`} style={{ color: "var(--text-muted)" }}>
          +{workout.exercises.length - 7} weitere
        </div>
      )}
    </div>
  </div>
);

// ============================================================
// TEMPLATE 2: BEAST MODE — Big volume number + funny comparison
// ============================================================
const TemplateBeast = ({ workout, volume, durationMin, sets, isExport }: any) => {
  const isGym = isGymWorkout(workout);
  const volTons = volume / 1000;
  const comparison = getFunnyComparison(volTons);

  return (
    <div className="flex flex-col h-full items-center justify-center text-center">
      {/* Icon */}
      <div className="relative">
        <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full" />
        <Dumbbell size={isExport ? 120 : 56} className="text-blue-500 relative z-10" />
      </div>

      {/* Big Number */}
      <div className={isExport ? 'mt-16 mb-8' : 'mt-6 mb-3'}>
        <p className={`uppercase tracking-[0.2em] font-semibold ${isExport ? 'text-2xl mb-4' : 'text-[10px] mb-1'}`} style={{ color: "var(--text-muted)" }}>
          {isGym ? "Gesamtvolumen" : "Dauer"}
        </p>
        <div className="flex items-baseline justify-center gap-2">
          <span className={`font-black tracking-tighter ${isExport ? 'text-[11rem] leading-none' : 'text-7xl'}`} style={{ color: "var(--text-color)" }}>
            {isGym ? volTons.toFixed(1) : durationMin}
          </span>
          <span className={`font-bold ${isExport ? 'text-5xl' : 'text-2xl'}`} style={{ color: "var(--text-muted)" }}>
            {isGym ? "t" : "min"}
          </span>
        </div>
      </div>

      {/* Comparison Card */}
      {isGym && volTons > 0 && (
        <div className={`rounded-2xl border ${isExport ? 'p-10 max-w-[600px]' : 'p-4 max-w-[260px]'}`} style={{ backgroundColor: "var(--button-bg)", borderColor: "var(--border-color)" }}>
          <span className={isExport ? 'text-7xl' : 'text-3xl'}>{comparison.emoji}</span>
          <p className={`font-semibold leading-relaxed ${isExport ? 'text-3xl mt-4' : 'text-sm mt-2'}`} style={{ color: "var(--text-color)" }}>
            {comparison.text}
          </p>
        </div>
      )}

      {/* Mini Stats */}
      <div className={`flex justify-center ${isExport ? 'gap-12 mt-16' : 'gap-6 mt-6'}`}>
        {[
          { icon: <Zap size={isExport ? 28 : 14} />, value: `${sets} Sets` },
          { icon: <Target size={isExport ? 28 : 14} />, value: `${(workout.exercises || []).length} Übungen` },
        ].map((s, i) => (
          <div key={i} className={`flex items-center text-blue-400 font-semibold ${isExport ? 'gap-3 text-2xl' : 'gap-1.5 text-[10px]'}`}>
            {s.icon} {s.value}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================
// TEMPLATE 3: PR HIGHLIGHT — Shows PRs or top exercise
// ============================================================
const TemplatePR = ({ workout, volume, isExport }: any) => {
  const prCount = getPRCount(workout);
  const topEx = getTopExercise(workout);
  const hasPRs = prCount > 0;

  return (
    <div className="flex flex-col h-full items-center justify-center text-center">
      {/* Trophy / Zap */}
      <div className="relative">
        <div className={`absolute inset-0 ${hasPRs ? 'bg-yellow-500/20' : 'bg-blue-500/20'} blur-3xl rounded-full`} />
        {hasPRs ? (
          <Trophy size={isExport ? 140 : 64} className="text-yellow-500 relative z-10" />
        ) : (
          <TrendingUp size={isExport ? 140 : 64} className="text-blue-500 relative z-10" />
        )}
      </div>

      {/* Title */}
      <h3 className={`font-black uppercase tracking-tight ${isExport ? 'text-7xl mt-14 mb-4' : 'text-3xl mt-6 mb-2'}`} style={{ color: hasPRs ? "#EAB308" : "var(--text-color)" }}>
        {hasPRs ? `${prCount} New PR${prCount > 1 ? 's' : ''}` : "Personal Best"}
      </h3>

      {/* Top Exercise */}
      {topEx && (
        <div className={`${isExport ? 'mt-8' : 'mt-4'}`}>
          <p className={`font-bold ${isExport ? 'text-4xl mb-3' : 'text-lg mb-1'}`} style={{ color: "var(--text-color)" }}>{topEx.name}</p>
          <div className={`inline-block rounded-full font-black ${isExport ? 'text-5xl px-10 py-4' : 'text-xl px-5 py-2'}`} style={{ backgroundColor: hasPRs ? "rgba(234,179,8,0.15)" : "rgba(59,130,246,0.1)", color: hasPRs ? "#EAB308" : "#3B82F6" }}>
            {topEx.bestSet}
          </div>
        </div>
      )}

      {/* Volume badge */}
      {volume > 0 && (
        <div className={`flex items-center justify-center gap-2 ${isExport ? 'mt-16' : 'mt-8'}`}>
          <Dumbbell size={isExport ? 24 : 14} className="text-blue-400" />
          <span className={`font-bold ${isExport ? 'text-3xl' : 'text-sm'}`} style={{ color: "var(--text-muted)" }}>
            {(volume / 1000).toFixed(1)}t Gesamtvolumen
          </span>
        </div>
      )}
    </div>
  );
};

// ============================================================
// TEMPLATE 4: WEEKLY STREAK — Consistency tracker
// ============================================================
const TemplateStreak = ({ history, currentWorkoutDate, isExport }: any) => {
  const d = new Date(currentWorkoutDate);
  if (isNaN(d.getTime())) return null;

  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(new Date(d).setDate(diff));
  monday.setHours(0, 0, 0, 0);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const temp = new Date(monday);
    temp.setDate(monday.getDate() + i);
    return temp;
  });

  const isSameDay = (d1: Date, d2: Date) => d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
  const workoutsOnDisk = history.map((h: any) => new Date(h.startedAt));
  const checkDate = (date: Date) => isSameDay(date, currentWorkoutDate) || workoutsOnDisk.some((wd: Date) => isSameDay(wd, date));

  const count = weekDays.filter(checkDate).length;
  const labels = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  return (
    <div className="flex flex-col h-full items-center justify-center">
      {/* Fire icon + count */}
      <div className={`relative ${isExport ? 'mb-16' : 'mb-8'}`}>
        <div className="absolute inset-0 bg-orange-500/20 blur-2xl rounded-full" />
        <Flame size={isExport ? 140 : 64} className="text-orange-500 fill-orange-500/20 relative z-10" />
        <div className={`absolute rounded-full text-white font-black z-20 shadow-lg ${isExport ? '-bottom-4 -right-4 text-3xl px-6 py-2' : '-bottom-2 -right-2 text-sm px-3 py-1'}`} style={{ backgroundColor: "#F97316" }}>
          {count}x
        </div>
      </div>

      <h3 className={`font-black text-center ${isExport ? 'text-6xl mb-4' : 'text-2xl mb-1'}`} style={{ color: "var(--text-color)" }}>
        {count >= 5 ? "Beast Week!" : count >= 3 ? "Consistent!" : "Am Ball!"}
      </h3>
      <p className={`text-center leading-relaxed ${isExport ? 'text-3xl mb-16' : 'text-sm mb-8'}`} style={{ color: "var(--text-muted)" }}>
        <span className="text-orange-500 font-bold">{count}. Training</span> diese Woche
      </p>

      {/* Week dots */}
      <div className={`flex justify-between w-full ${isExport ? 'px-6 gap-4' : 'px-2'}`}>
        {weekDays.map((date, i) => {
          const active = checkDate(date);
          const isToday = isSameDay(date, currentWorkoutDate);
          return (
            <div key={i} className="flex flex-col items-center gap-2">
              <div
                className={`rounded-full flex items-center justify-center transition-all ${isExport ? 'w-16 h-16 border-[3px]' : 'w-8 h-8 border-2'} ${active ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-500/30' : ''}`}
                style={active ? undefined : { borderColor: "var(--border-color)", backgroundColor: "transparent" }}
              >
                {active && <Check size={isExport ? 32 : 14} className="text-white" strokeWidth={3} />}
              </div>
              <span className={`font-bold uppercase ${isExport ? 'text-xl' : 'text-[9px]'}`} style={{ color: isToday ? "var(--text-color)" : "var(--text-muted)" }}>
                {labels[i]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================
// TEMPLATE 5: RECEIPT — Minimalist "workout receipt" style
// ============================================================
const TemplateReceipt = ({ workout, durationMin, volume, sets, dateStr, isExport }: any) => {
  const exercises = workout.exercises || [];

  return (
    <div className={`flex flex-col h-full font-mono ${isExport ? 'px-8' : 'px-1'}`}>
      {/* Receipt Header */}
      <div className={`text-center ${isExport ? 'mb-10 pb-8' : 'mb-3 pb-3'}`} style={{ borderBottom: "2px dashed var(--border-color)" }}>
        <div className={`font-black uppercase tracking-[0.3em] ${isExport ? 'text-4xl mb-4' : 'text-base mb-1'}`} style={{ color: "var(--text-color)" }}>
          WORKOUT RECEIPT
        </div>
        <div className={`uppercase tracking-widest ${isExport ? 'text-xl' : 'text-[9px]'}`} style={{ color: "var(--text-muted)" }}>{dateStr}</div>
      </div>

      {/* Items */}
      <div className={`flex-1 ${isExport ? 'space-y-4' : 'space-y-1.5'}`}>
        {exercises.slice(0, 8).map((ex: any, i: number) => (
          <div key={i} className={`flex justify-between ${isExport ? 'text-2xl' : 'text-xs'}`}>
            <span className="truncate" style={{ color: "var(--text-color)", maxWidth: "70%" }}>{ex.name}</span>
            <span style={{ color: "var(--text-muted)" }}>{ex.sets?.length || 0}x</span>
          </div>
        ))}
        {exercises.length > 8 && (
          <div className={`text-center ${isExport ? 'text-xl' : 'text-[10px]'}`} style={{ color: "var(--text-muted)" }}>... +{exercises.length - 8}</div>
        )}
      </div>

      {/* Totals */}
      <div className={`${isExport ? 'mt-8 pt-8' : 'mt-3 pt-3'}`} style={{ borderTop: "2px dashed var(--border-color)" }}>
        {[
          { label: "DAUER", value: `${durationMin} MIN` },
          { label: "SÄTZE", value: `${sets}` },
          ...(volume > 0 ? [{ label: "VOLUMEN", value: `${(volume / 1000).toFixed(1)} T` }] : []),
          { label: "ÜBUNGEN", value: `${exercises.length}` },
        ].map((row, i) => (
          <div key={i} className={`flex justify-between font-bold ${isExport ? 'text-2xl py-2' : 'text-[11px] py-0.5'}`} style={{ color: "var(--text-color)" }}>
            <span>{row.label}</span>
            <span>{row.value}</span>
          </div>
        ))}
      </div>

      {/* Barcode-style decoration */}
      <div className={`flex justify-center gap-[2px] ${isExport ? 'mt-10' : 'mt-4'}`}>
        {Array.from({ length: 30 }, (_, i) => (
          <div
            key={i}
            className={isExport ? 'h-12' : 'h-4'}
            style={{
              width: Math.random() > 0.5 ? (isExport ? 4 : 2) : (isExport ? 2 : 1),
              backgroundColor: "var(--text-muted)",
              opacity: 0.3,
            }}
          />
        ))}
      </div>
    </div>
  );
};

// ============================================================
// TEMPLATE 6: SPLIT STATS — Bold split with gradient accent
// ============================================================
const TemplateSplitStats = ({ workout, durationMin, volume, sets, isExport }: any) => {
  const exercises = workout.exercises || [];
  const topEx = getTopExercise(workout);
  const prCount = getPRCount(workout);

  return (
    <div className="flex flex-col h-full">
      {/* Big workout type */}
      <div className={`${isExport ? 'mb-12' : 'mb-4'}`}>
        <div className={`font-black uppercase italic tracking-tight ${isExport ? 'text-7xl' : 'text-2xl'}`} style={{ color: "var(--text-color)" }}>
          {exercises.length} Übungen
        </div>
        <div className={`font-bold ${isExport ? 'text-3xl mt-2' : 'text-sm mt-0.5'}`} style={{ color: "var(--text-muted)" }}>
          {sets} Sätze · {durationMin} Min
        </div>
      </div>

      {/* Stat Cards Grid */}
      <div className={`grid grid-cols-2 ${isExport ? 'gap-6 mb-12' : 'gap-2 mb-4'}`}>
        {volume > 0 && (
          <div className={`rounded-2xl ${isExport ? 'p-8' : 'p-3'}`} style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.05))", border: "1px solid rgba(59,130,246,0.2)" }}>
            <Dumbbell size={isExport ? 36 : 16} className="text-blue-500" />
            <div className={`font-black text-blue-500 ${isExport ? 'text-5xl mt-4' : 'text-xl mt-1'}`}>{(volume / 1000).toFixed(1)}t</div>
            <div className={`font-semibold ${isExport ? 'text-xl mt-1' : 'text-[9px]'}`} style={{ color: "var(--text-muted)" }}>Volumen</div>
          </div>
        )}
        {prCount > 0 && (
          <div className={`rounded-2xl ${isExport ? 'p-8' : 'p-3'}`} style={{ background: "linear-gradient(135deg, rgba(234,179,8,0.15), rgba(234,179,8,0.05))", border: "1px solid rgba(234,179,8,0.2)" }}>
            <Trophy size={isExport ? 36 : 16} className="text-yellow-500" />
            <div className={`font-black text-yellow-500 ${isExport ? 'text-5xl mt-4' : 'text-xl mt-1'}`}>{prCount}</div>
            <div className={`font-semibold ${isExport ? 'text-xl mt-1' : 'text-[9px]'}`} style={{ color: "var(--text-muted)" }}>PRs</div>
          </div>
        )}
        {prCount === 0 && (
          <div className={`rounded-2xl ${isExport ? 'p-8' : 'p-3'}`} style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.05))", border: "1px solid rgba(59,130,246,0.2)" }}>
            <Target size={isExport ? 36 : 16} className="text-blue-400" />
            <div className={`font-black text-blue-400 ${isExport ? 'text-5xl mt-4' : 'text-xl mt-1'}`}>{exercises.length}</div>
            <div className={`font-semibold ${isExport ? 'text-xl mt-1' : 'text-[9px]'}`} style={{ color: "var(--text-muted)" }}>Übungen</div>
          </div>
        )}
      </div>

      {/* Top Exercise Highlight */}
      {topEx && (
        <div className={`rounded-2xl ${isExport ? 'p-8' : 'p-3'}`} style={{ backgroundColor: "var(--button-bg)", border: "1px solid var(--border-color)" }}>
          <div className={`uppercase tracking-wider font-semibold ${isExport ? 'text-xl mb-3' : 'text-[9px] mb-1'}`} style={{ color: "var(--text-muted)" }}>Top Übung</div>
          <div className={`font-bold ${isExport ? 'text-4xl mb-2' : 'text-base mb-0.5'}`} style={{ color: "var(--text-color)" }}>{topEx.name}</div>
          <div className={`font-black text-blue-500 ${isExport ? 'text-3xl' : 'text-sm'}`}>{topEx.bestSet}</div>
        </div>
      )}

      {/* Exercise names */}
      <div className={`flex-1 flex flex-wrap content-start ${isExport ? 'gap-3 mt-8' : 'gap-1.5 mt-3'}`}>
        {exercises.slice(0, 6).map((ex: any, i: number) => (
          <span key={i} className={`rounded-full font-medium ${isExport ? 'px-6 py-3 text-xl' : 'px-2.5 py-1 text-[9px]'}`} style={{ backgroundColor: "var(--button-bg)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}>
            {ex.name}
          </span>
        ))}
      </div>
    </div>
  );
};

// ============================================================
// SHARE CARD WRAPPER
// ============================================================
const ShareCard = React.forwardRef(({ workout, userName, type, dateStr, history, isExportMode }: any, ref: any) => {
  const volume = getVolume(workout);
  const durationMin = getDurationMin(workout);
  const sets = getTotalSets(workout);
  const isExport = !!isExportMode;

  return (
    <div
      ref={ref}
      className={`flex flex-col relative overflow-hidden select-none ${isExport ? 'w-[1080px] h-[1920px] p-20' : 'w-[360px] aspect-[9/16] p-7'}`}
      style={{ backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}
    >
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at top right, rgba(59,130,246,0.06), transparent 60%)" }} />

      {/* Header */}
      <div className={`relative z-10 flex justify-between items-start ${isExport ? 'mb-14' : 'mb-5'}`}>
        <div className="min-w-0 flex-1">
          <h2 className={`font-black tracking-tight leading-none ${isExport ? 'text-7xl mb-5' : 'text-2xl mb-2'}`} style={{ color: "var(--text-color)" }}>
            {workout.title || "Workout"}
          </h2>
          <div className={`flex items-center font-semibold uppercase tracking-wider ${isExport ? 'gap-6 text-2xl' : 'gap-2 text-[10px]'}`} style={{ color: "var(--text-muted)" }}>
            <span>{dateStr}</span>
            <span className={`rounded-full ${isExport ? 'w-2 h-2' : 'w-1 h-1'}`} style={{ backgroundColor: "var(--text-muted)" }} />
            <span>{durationMin} Min</span>
            {volume > 0 && (
              <>
                <span className={`rounded-full ${isExport ? 'w-2 h-2' : 'w-1 h-1'}`} style={{ backgroundColor: "var(--text-muted)" }} />
                <span className="text-blue-500">{(volume / 1000).toFixed(1)}t</span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end shrink-0">
          <span className={`font-black tracking-tight ${isExport ? 'text-4xl' : 'text-base'}`} style={{ color: "var(--accent-color)" }}>trainq</span>
          <span className={`font-semibold uppercase tracking-[0.15em] ${isExport ? 'text-xl mt-1' : 'text-[8px] mt-0.5'}`} style={{ color: "var(--text-muted)" }}>{userName}</span>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1">
        {type === 'overview' && <TemplateOverview workout={workout} durationMin={durationMin} volume={volume} sets={sets} isExport={isExport} />}
        {type === 'beast' && <TemplateBeast workout={workout} volume={volume} durationMin={durationMin} sets={sets} isExport={isExport} />}
        {type === 'pr' && <TemplatePR workout={workout} volume={volume} isExport={isExport} />}
        {type === 'streak' && <TemplateStreak history={history} currentWorkoutDate={new Date(workout.startedAt || workout.dateISO)} isExport={isExport} />}
        {type === 'receipt' && <TemplateReceipt workout={workout} durationMin={durationMin} volume={volume} sets={sets} dateStr={dateStr} isExport={isExport} />}
        {type === 'stats' && <TemplateSplitStats workout={workout} durationMin={durationMin} volume={volume} sets={sets} isExport={isExport} />}
      </div>

      {/* Footer */}
      <div className={`relative z-10 mt-auto flex items-center ${isExport ? 'pt-10' : 'pt-4'}`} style={{ borderTop: "1px solid var(--border-color)" }}>
        <div className={`flex items-center ${isExport ? 'gap-3' : 'gap-1.5'}`}>
          <div className={`bg-blue-600 rounded-full ${isExport ? 'w-3 h-3' : 'w-1.5 h-1.5'}`} />
          <span className={`font-bold ${isExport ? 'text-2xl' : 'text-[10px]'}`} style={{ color: "var(--text-muted)" }}>trainq.app</span>
        </div>
      </div>
    </div>
  );
});

// ============================================================
// MAIN PAGE
// ============================================================
export default function WorkoutSharePage({ workoutId, onDone }: { workoutId: string | null; onDone: () => void }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [templateIndex, setTemplateIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const [history, setHistory] = useState<WorkoutHistoryEntry[]>([]);
  const [loadedWorkout, setLoadedWorkout] = useState<WorkoutHistoryEntry | null>(null);

  useEffect(() => {
    const h = loadWorkoutHistory();
    setHistory(h);
    if (workoutId) {
      setLoadedWorkout(h.find(x => x.id === workoutId) || null);
    }
  }, [workoutId]);

  const finalWorkout = loadedWorkout || { id: "empty", dateISO: new Date().toISOString(), title: "Workout", exercises: [], sport: "Gym" };
  const finalUserName = user?.displayName || "Athlete";
  const dateObj = new Date(finalWorkout.startedAt || finalWorkout.dateISO);
  const dateStr = !isNaN(dateObj.getTime())
    ? dateObj.toLocaleDateString("de-DE", { day: '2-digit', month: '2-digit', year: 'numeric' })
    : "";

  const TEMPLATES = [
    { key: 'overview', label: 'Overview' },
    { key: 'beast', label: 'Beast Mode' },
    { key: 'pr', label: 'Highlight' },
    { key: 'streak', label: 'Streak' },
    { key: 'receipt', label: 'Receipt' },
    { key: 'stats', label: 'Stats' },
  ];
  const currentTemplate = TEMPLATES[templateIndex];

  const [swipeDir, setSwipeDir] = useState(1);
  const swipeTouchRef = useRef<{ x: number; y: number } | null>(null);

  const navigateTemplate = (dir: 1 | -1) => {
    setSwipeDir(dir);
    setTemplateIndex((p) => (p + dir + TEMPLATES.length) % TEMPLATES.length);
  };

  const handleSwipeTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, select, [role='button']")) {
      swipeTouchRef.current = null;
      return;
    }
    swipeTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleSwipeTouchEnd = (e: React.TouchEvent) => {
    const start = swipeTouchRef.current;
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    swipeTouchRef.current = null;
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.7) return;
    if (dx < 0) navigateTemplate(1); else navigateTemplate(-1);
  };

  const handleExport = async (mode: 'share' | 'save') => {
    if (!exportRef.current) return;
    setIsExporting(true);
    try {
      await new Promise(r => setTimeout(r, 100));
      const cvs = await html2canvas(exportRef.current, {
        scale: 1,
        useCORS: true,
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-color').trim() || '#09090b',
        logging: false,
        width: 1080,
        height: 1920,
        windowWidth: 1080,
        windowHeight: 1920,
      });

      // Convert canvas to base64
      const base64 = cvs.toDataURL('image/png').split(',')[1];
      const fileName = `trainq-share-${Date.now()}.png`;

      // Save to device via Capacitor Filesystem
      const saved = await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Cache,
      });

      if (mode === 'share') {
        await Share.share({
          title: 'TrainQ Workout',
          files: [saved.uri],
        });
      } else {
        // Save to photo library
        try {
          const { Media } = await import('@capacitor-community/media');
          await Media.savePhoto({ path: saved.uri });
          hapticSuccess();
        } catch {
          // Fallback: share dialog so user can save manually
          await Share.share({ files: [saved.uri] });
        }
      }
    } catch (e) {
      if (import.meta.env.DEV) console.error("Export failed", e);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col h-[100dvh] overflow-hidden" style={{ backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}>
      {/* Hidden export canvas */}
      <div style={{ position: 'fixed', top: '-10000px', left: '-10000px', pointerEvents: 'none', visibility: 'visible' }}>
        <div ref={exportRef}>
          <ShareCard workout={finalWorkout} userName={finalUserName} type={currentTemplate.key} dateStr={dateStr} history={history} isExportMode={true} />
        </div>
      </div>

      {/* Header */}
      <div className="flex-none w-full p-4 pt-[calc(env(safe-area-inset-top)+12px)] flex justify-between items-center z-50">
        <span className="font-bold text-lg tracking-tight pl-2">{t("common.share" as any)}</span>
        <button onClick={onDone} className="rounded-full p-2 transition backdrop-blur-md" style={{ backgroundColor: "var(--button-bg)", border: "1px solid var(--border-color)" }}>
          <X size={20} style={{ color: "var(--text-secondary)" }} />
        </button>
      </div>

      {/* Card Preview */}
      <div
        className="flex-1 flex flex-col items-center justify-center relative w-full overflow-hidden"
        onTouchStart={handleSwipeTouchStart}
        onTouchEnd={handleSwipeTouchEnd}
      >
        <AnimatePresence mode="popLayout" custom={swipeDir} initial={false}>
          <MotionDiv
            key={templateIndex}
            custom={swipeDir}
            variants={shareSlideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            className="transform scale-[0.60] xs:scale-[0.68] sm:scale-[0.76] shadow-2xl shadow-blue-900/10 rounded-[32px] overflow-hidden"
            style={{ border: "1px solid var(--border-color)" }}
          >
            <ShareCard workout={finalWorkout} userName={finalUserName} type={currentTemplate.key} dateStr={dateStr} history={history} isExportMode={false} />
          </MotionDiv>
        </AnimatePresence>
      </div>

      {/* Bottom Actions */}
      <div className="flex-none w-full rounded-t-[32px] px-6 pt-4 pb-[calc(env(safe-area-inset-bottom)+16px)] flex flex-col items-center z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.08)]" style={{ backgroundColor: "var(--card-bg)", borderTop: "1px solid var(--border-color)" }}>
        {/* Dots */}
        <div className="flex gap-2.5 mb-5">
          {TEMPLATES.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === templateIndex ? 'w-8 bg-blue-500 shadow-blue-500/50 shadow-sm' : 'w-1.5'}`} style={i === templateIndex ? undefined : { backgroundColor: "var(--border-color)" }} />
          ))}
        </div>

        {/* Buttons */}
        <div className="flex gap-4 w-full max-w-sm mb-3">
          <button
            onClick={() => handleExport('save')}
            disabled={isExporting}
            className="flex-1 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 active:scale-95 transition"
            style={{ backgroundColor: "var(--button-bg)", color: "var(--text-color)", border: "1px solid var(--border-color)" }}
          >
            <Download size={18} /> Speichern
          </button>
          <button
            onClick={() => handleExport('share')}
            disabled={isExporting}
            className="flex-1 bg-blue-600 text-white py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 active:scale-95 transition shadow-lg shadow-blue-600/20"
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
