// src/components/nutrition/NutritionHistory.tsx
import React, { useState, useMemo } from "react";
import { Flame, Dumbbell, TrendingUp } from "lucide-react";
import type { NutritionGoals } from "../../types/nutrition";
import { loadDiaryEntries } from "../../utils/nutritionStore";
import { sumMacros } from "../../features/nutrition/macroCalculator";
import NutritionKcalChart from "./NutritionKcalChart";
import NutritionMacroChart from "./NutritionMacroChart";

interface NutritionHistoryProps {
  goals: NutritionGoals;
}

const DAY_LABELS_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function formatDateISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayLabel(dateISO: string, range: "week" | "month"): string {
  const d = new Date(dateISO + "T00:00:00");
  if (range === "week") return DAY_LABELS_SHORT[d.getDay()];
  return String(d.getDate());
}

function formatDate(dateISO: string): string {
  try {
    const d = new Date(dateISO + "T00:00:00");
    return d.toLocaleDateString("de-DE", { day: "numeric", month: "short" });
  } catch {
    return dateISO;
  }
}

const NutritionHistory: React.FC<NutritionHistoryProps> = ({ goals }) => {
  const [range, setRange] = useState<"week" | "month">("week");
  const days = range === "week" ? 7 : 30;

  const { kcalData, macroData, avgKcal, avgProtein, streak, totalEntries } = useMemo(() => {
    const allEntries = loadDiaryEntries();

    // Group by date
    const byDate = new Map<string, typeof allEntries>();
    for (const e of allEntries) {
      const arr = byDate.get(e.dateISO) || [];
      arr.push(e);
      byDate.set(e.dateISO, arr);
    }

    // Generate last N days
    const kcalArr: { label: string; kcal: number; date: string }[] = [];
    const macroArr: { label: string; date: string; protein: number; carbs: number; fat: number }[] = [];
    let totalKcal = 0;
    let totalProtein = 0;
    let daysWithData = 0;
    let currentStreak = 0;
    let streakBroken = false;
    let entries = 0;

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = formatDateISO(d);
      const dayEntries = byDate.get(iso) || [];
      const totals = sumMacros(dayEntries);

      kcalArr.push({
        label: dayLabel(iso, range),
        kcal: totals.kcal,
        date: formatDate(iso),
      });
      macroArr.push({
        label: dayLabel(iso, range),
        date: formatDate(iso),
        protein: totals.protein,
        carbs: totals.carbs,
        fat: totals.fat,
      });

      entries += dayEntries.length;

      if (dayEntries.length > 0) {
        totalKcal += totals.kcal;
        totalProtein += totals.protein;
        daysWithData++;
        if (!streakBroken) currentStreak++;
      } else {
        if (i > 0) streakBroken = true; // Don't break streak for today (might not have eaten yet)
      }
    }

    return {
      kcalData: kcalArr,
      macroData: macroArr,
      avgKcal: daysWithData > 0 ? Math.round(totalKcal / daysWithData) : 0,
      avgProtein: daysWithData > 0 ? Math.round(totalProtein / daysWithData) : 0,
      streak: currentStreak,
      totalEntries: entries,
    };
  }, [range, days]);

  return (
    <div className="space-y-4">
      {/* Range toggle */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setRange("week")}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
            range === "week"
              ? "bg-[var(--accent-color)] text-white"
              : "bg-[var(--border-color)] text-[var(--text-secondary)]"
          }`}
        >
          Woche
        </button>
        <button
          onClick={() => setRange("month")}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
            range === "month"
              ? "bg-[var(--accent-color)] text-white"
              : "bg-[var(--border-color)] text-[var(--text-secondary)]"
          }`}
        >
          Monat
        </button>
      </div>

      {/* Kcal chart */}
      <NutritionKcalChart data={kcalData} kcalGoal={goals.kcal} />

      {/* Macro chart */}
      <NutritionMacroChart data={macroData} />

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard
          icon={<Flame size={16} className="text-orange-400" />}
          label="Avg kcal"
          value={avgKcal.toLocaleString("de-DE")}
        />
        <StatCard
          icon={<Dumbbell size={16} className="text-blue-400" />}
          label="Avg Protein"
          value={`${avgProtein}g`}
        />
        <StatCard
          icon={<TrendingUp size={16} className="text-green-400" />}
          label="Streak"
          value={`${streak} ${streak === 1 ? "Tag" : "Tage"}`}
        />
      </div>

      {totalEntries === 0 && (
        <p className="text-center text-sm text-[var(--text-secondary)] py-4">
          Noch keine Eintr&auml;ge. Tracke dein Essen im Tagebuch!
        </p>
      )}
    </div>
  );
};

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] p-3 flex flex-col items-center gap-1">
      {icon}
      <span className="text-sm font-bold text-[var(--text-color)]">{value}</span>
      <span className="text-[10px] font-medium text-[var(--text-secondary)]">{label}</span>
    </div>
  );
}

export default NutritionHistory;
