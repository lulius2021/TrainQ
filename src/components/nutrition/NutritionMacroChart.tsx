// src/components/nutrition/NutritionMacroChart.tsx
import React from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface DataPoint {
  label: string;
  date: string;
  protein: number;
  carbs: number;
  fat: number;
}

interface NutritionMacroChartProps {
  data: DataPoint[];
}

const COLORS = {
  protein: "#3b82f6",
  carbs: "#f59e0b",
  fat: "#ec4899",
};

const TooltipContent: React.FC<{ active?: boolean; payload?: any[] }> = ({
  active,
  payload,
}) => {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload as DataPoint;
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] shadow-xl rounded-2xl px-3 py-2 space-y-0.5">
      <p className="text-[10px] text-[var(--text-secondary)]">{item.date}</p>
      <p className="text-xs font-semibold" style={{ color: COLORS.protein }}>
        P: {Math.round(item.protein)}g
      </p>
      <p className="text-xs font-semibold" style={{ color: COLORS.carbs }}>
        K: {Math.round(item.carbs)}g
      </p>
      <p className="text-xs font-semibold" style={{ color: COLORS.fat }}>
        F: {Math.round(item.fat)}g
      </p>
    </div>
  );
};

const NutritionMacroChart: React.FC<NutritionMacroChartProps> = ({ data }) => {
  return (
    <div className="w-full bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          Makros
        </h4>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[10px] font-semibold text-[var(--text-secondary)]">
            <span className="w-2 h-2 rounded-full" style={{ background: COLORS.protein }} />
            Protein
          </span>
          <span className="flex items-center gap-1 text-[10px] font-semibold text-[var(--text-secondary)]">
            <span className="w-2 h-2 rounded-full" style={{ background: COLORS.carbs }} />
            Carbs
          </span>
          <span className="flex items-center gap-1 text-[10px] font-semibold text-[var(--text-secondary)]">
            <span className="w-2 h-2 rounded-full" style={{ background: COLORS.fat }} />
            Fett
          </span>
        </div>
      </div>
      {data.length === 0 ? (
        <div className="h-[180px] flex items-center justify-center text-sm text-[var(--text-secondary)]">
          Keine Daten
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="label"
              stroke="var(--text-secondary)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval="preserveStartEnd"
              minTickGap={20}
            />
            <YAxis
              stroke="var(--text-secondary)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}g`}
            />
            <Tooltip content={<TooltipContent />} />
            <Bar dataKey="protein" stackId="macros" fill={COLORS.protein} radius={[0, 0, 0, 0]} />
            <Bar dataKey="carbs" stackId="macros" fill={COLORS.carbs} radius={[0, 0, 0, 0]} />
            <Bar dataKey="fat" stackId="macros" fill={COLORS.fat} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default NutritionMacroChart;
