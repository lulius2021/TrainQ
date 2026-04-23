import React, { useMemo } from "react";
import { Apple } from "lucide-react";
import { loadDiaryEntries, loadGoals } from "../../utils/nutritionStore";
import type { DiaryEntry } from "../../types/nutrition";

function computeNutritionStats() {
  const allEntries = loadDiaryEntries();
  const goals = loadGoals();

  if (allEntries.length === 0) return null;

  const byDate = new Map<string, DiaryEntry[]>();
  allEntries.forEach((e) => {
    const list = byDate.get(e.dateISO) || [];
    list.push(e);
    byDate.set(e.dateISO, list);
  });

  const trackedDays = byDate.size;
  let totalKcal = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;

  byDate.forEach((entries) => {
    entries.forEach((e) => {
      totalKcal += e.macros.kcal;
      totalProtein += e.macros.protein;
      totalCarbs += e.macros.carbs;
      totalFat += e.macros.fat;
    });
  });

  const avgKcal = Math.round(totalKcal / trackedDays);
  const avgProtein = Math.round(totalProtein / trackedDays);
  const avgCarbs = Math.round(totalCarbs / trackedDays);
  const avgFat = Math.round(totalFat / trackedDays);

  const kcalGoal = goals?.kcal ?? 2000;
  let daysOnTarget = 0;
  byDate.forEach((entries) => {
    const dayKcal = entries.reduce((s, e) => s + e.macros.kcal, 0);
    if (dayKcal >= kcalGoal * 0.9 && dayKcal <= kcalGoal * 1.1) daysOnTarget++;
  });
  const adherencePct = Math.round((daysOnTarget / trackedDays) * 100);

  const now = new Date();
  const kcalTrend: { label: string; value: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const dayEntries = byDate.get(iso) || [];
    const dayKcal = dayEntries.reduce((s, e) => s + e.macros.kcal, 0);
    kcalTrend.push({ label: String(d.getDate()), value: dayKcal });
  }

  const foodCountMap = new Map<string, number>();
  allEntries.forEach((e) => {
    foodCountMap.set(e.foodName, (foodCountMap.get(e.foodName) || 0) + 1);
  });
  const topFoods = Array.from(foodCountMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return { trackedDays, avgKcal, avgProtein, avgCarbs, avgFat, kcalGoal, adherencePct, kcalTrend, topFoods, goals };
}

const NutritionStatsBlock: React.FC = () => {
  const stats = useMemo(() => computeNutritionStats(), []);

  if (!stats) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <Apple size={14} style={{ color: "#34C759" }} />
        <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Ernährungsübersicht</h3>
      </div>

      {/* Macro Averages */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--card-bg)" }}>
          <span className="text-[11px] font-bold uppercase tracking-wider block mb-1" style={{ color: "var(--text-secondary)" }}>Ø Kalorien</span>
          <span className="text-2xl font-black" style={{ color: "var(--text-color)" }}>
            {stats.avgKcal.toLocaleString("de-DE")}<span className="text-xs font-normal ml-1" style={{ color: "var(--text-secondary)" }}>kcal</span>
          </span>
        </div>
        <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--card-bg)" }}>
          <span className="text-[11px] font-bold uppercase tracking-wider block mb-1" style={{ color: "var(--text-secondary)" }}>Ø Protein</span>
          <span className="text-2xl font-black" style={{ color: "var(--text-color)" }}>
            {stats.avgProtein}<span className="text-xs font-normal ml-1" style={{ color: "var(--text-secondary)" }}>g</span>
          </span>
        </div>
      </div>

      {/* Macro Bars */}
      <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: "var(--card-bg)" }}>
        <div className="flex items-center justify-between text-[12px]">
          <span className="font-medium" style={{ color: "var(--text-secondary)" }}>Ø Makros / Tag</span>
          <span className="font-bold tabular-nums" style={{ color: "var(--text-secondary)" }}>{stats.trackedDays} Tage erfasst</span>
        </div>
        {[
          { label: "Protein", value: stats.avgProtein, goal: stats.goals?.protein ?? 150, color: "#007AFF" },
          { label: "Kohlenhydrate", value: stats.avgCarbs, goal: stats.goals?.carbs ?? 250, color: "#F59E0B" },
          { label: "Fett", value: stats.avgFat, goal: stats.goals?.fat ?? 65, color: "#FF6B6B" },
        ].map((m) => {
          const pct = Math.min((m.value / m.goal) * 100, 100);
          return (
            <div key={m.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] font-medium" style={{ color: "var(--text-color)" }}>{m.label}</span>
                <span className="text-[12px] font-bold tabular-nums" style={{ color: "var(--text-secondary)" }}>{m.value}g / {m.goal}g</span>
              </div>
              <div className="h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: "var(--input-bg)" }}>
                <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: m.color }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Goal Adherence */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--card-bg)" }}>
          <span className="text-[11px] font-bold uppercase tracking-wider block mb-1" style={{ color: "var(--text-secondary)" }}>Ziel-Treue</span>
          <span className="text-2xl font-black" style={{ color: stats.adherencePct >= 70 ? "#34C759" : stats.adherencePct >= 40 ? "#F59E0B" : "#FF3B30" }}>
            {stats.adherencePct}<span className="text-xs font-normal ml-1">%</span>
          </span>
        </div>
        <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--card-bg)" }}>
          <span className="text-[11px] font-bold uppercase tracking-wider block mb-1" style={{ color: "var(--text-secondary)" }}>Kcal-Ziel</span>
          <span className="text-2xl font-black" style={{ color: "var(--text-color)" }}>
            {stats.kcalGoal.toLocaleString("de-DE")}<span className="text-xs font-normal ml-1" style={{ color: "var(--text-secondary)" }}>kcal</span>
          </span>
        </div>
      </div>

      {/* Kcal Trend */}
      <div className="space-y-2">
        <span className="text-[11px] font-bold uppercase tracking-wider px-1" style={{ color: "var(--text-secondary)" }}>Kalorien letzte 14 Tage</span>
        <div className="flex items-end gap-1 h-16">
          {stats.kcalTrend.map((d, i) => {
            const max = Math.max(...stats.kcalTrend.map((x) => x.value), 1);
            const pct = (d.value / max) * 100;
            const onTarget = d.value >= stats.kcalGoal * 0.9 && d.value <= stats.kcalGoal * 1.1;
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                <div
                  className="w-full rounded-t-sm min-h-[2px]"
                  style={{ height: `${Math.max(pct, 3)}%`, backgroundColor: d.value === 0 ? "var(--card-bg)" : onTarget ? "#34C759" : "#007AFF" }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Foods */}
      {stats.topFoods.length > 0 && (
        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider px-1" style={{ color: "var(--text-secondary)" }}>Häufigste Lebensmittel</span>
          <div className="space-y-2">
            {stats.topFoods.map((f) => {
              const maxCount = stats.topFoods[0]?.count ?? 1;
              const pct = (f.count / maxCount) * 100;
              return (
                <div key={f.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] font-medium truncate" style={{ color: "var(--text-color)" }}>{f.name}</span>
                    <span className="text-[13px] font-bold tabular-nums shrink-0 ml-3" style={{ color: "var(--text-secondary)" }}>{f.count}×</span>
                  </div>
                  <div className="h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: "var(--card-bg)" }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: "#34C759" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default NutritionStatsBlock;
