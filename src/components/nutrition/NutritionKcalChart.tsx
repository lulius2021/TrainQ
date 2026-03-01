// src/components/nutrition/NutritionKcalChart.tsx
import React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface DataPoint {
  label: string;
  kcal: number;
  date: string;
}

interface NutritionKcalChartProps {
  data: DataPoint[];
  kcalGoal: number;
}

const ACCENT = "#007AFF";

const TooltipContent: React.FC<{ active?: boolean; payload?: any[] }> = ({
  active,
  payload,
}) => {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload as DataPoint;
  return (
    <div className="bg-[var(--card-bg)] border border-[var(--border-color)] shadow-xl rounded-2xl px-3 py-2">
      <p className="text-[10px] text-[var(--text-secondary)]">{item.date}</p>
      <p className="text-sm font-bold text-[var(--text-color)]">
        {item.kcal.toLocaleString("de-DE")} kcal
      </p>
    </div>
  );
};

const NutritionKcalChart: React.FC<NutritionKcalChartProps> = ({ data, kcalGoal }) => {
  const gradientId = "kcal-gradient";

  return (
    <div className="w-full bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] p-4">
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
        Kalorien
      </h4>
      {data.length === 0 ? (
        <div className="h-[180px] flex items-center justify-center text-sm text-[var(--text-secondary)]">
          Keine Daten
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={ACCENT} stopOpacity={0.4} />
                <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border-color)"
              vertical={false}
            />
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
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`)}
            />
            <Tooltip content={<TooltipContent />} />
            {kcalGoal > 0 && (
              <ReferenceLine
                y={kcalGoal}
                stroke="var(--text-secondary)"
                strokeDasharray="6 4"
                strokeOpacity={0.5}
              />
            )}
            <Area
              type="monotone"
              dataKey="kcal"
              stroke={ACCENT}
              strokeWidth={2.5}
              fillOpacity={1}
              fill={`url(#${gradientId})`}
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default NutritionKcalChart;
