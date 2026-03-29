// src/components/nutrition/NutritionMacroChart.tsx
// Pure SVG stacked bar chart — no Recharts (avoids React 19 crash)
import React, { useRef, useState, useEffect } from "react";

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

const COLORS = { protein: "#3b82f6", carbs: "#f59e0b", fat: "#ec4899" };
const H = 180;
const PAD = { top: 10, right: 12, bottom: 24, left: 40 };

const NutritionMacroChart: React.FC<NutritionMacroChartProps> = ({ data }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    const cw = ref.current.clientWidth;
    if (cw > 0) setW(cw);
  }, []);

  const chartW = w - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const maxTotal = Math.max(...data.map(d => d.protein + d.carbs + d.fat), 50);

  const barW = Math.max(4, Math.min(20, (chartW / data.length) * 0.6));
  const gap = (chartW - barW * data.length) / Math.max(data.length - 1, 1);

  const toY = (v: number) => PAD.top + chartH - (v / maxTotal) * chartH;
  const barX = (i: number) => PAD.left + i * (barW + gap);

  // Y-axis ticks
  const yTicks: number[] = [];
  const step = Math.max(Math.ceil(maxTotal / 4 / 25) * 25, 25);
  for (let v = 0; v <= maxTotal; v += step) yTicks.push(v);

  const xInterval = Math.max(1, Math.floor(data.length / 5));

  return (
    <div className="w-full bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Makros</h4>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[10px] font-semibold text-[var(--text-secondary)]">
            <span className="w-2 h-2 rounded-full" style={{ background: COLORS.protein }} /> Protein
          </span>
          <span className="flex items-center gap-1 text-[10px] font-semibold text-[var(--text-secondary)]">
            <span className="w-2 h-2 rounded-full" style={{ background: COLORS.carbs }} /> Carbs
          </span>
          <span className="flex items-center gap-1 text-[10px] font-semibold text-[var(--text-secondary)]">
            <span className="w-2 h-2 rounded-full" style={{ background: COLORS.fat }} /> Fett
          </span>
        </div>
      </div>
      <div ref={ref} style={{ width: "100%", height: H }}>
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-[var(--text-secondary)]">
            Keine Daten
          </div>
        ) : w > 0 ? (
          <svg width={w} height={H}>
            {/* Grid */}
            {yTicks.map(v => (
              <line key={v} x1={PAD.left} x2={w - PAD.right} y1={toY(v)} y2={toY(v)}
                stroke="var(--border-color)" strokeDasharray="3 3" />
            ))}
            {/* Bars */}
            {data.map((d, i) => {
              const total = d.protein + d.carbs + d.fat;
              if (total === 0) return null;
              const x = barX(i);
              const fatH = (d.fat / maxTotal) * chartH;
              const carbsH = (d.carbs / maxTotal) * chartH;
              const proteinH = (d.protein / maxTotal) * chartH;
              const baseY = PAD.top + chartH;
              return (
                <g key={i}>
                  <rect x={x} y={baseY - proteinH} width={barW} height={proteinH} fill={COLORS.protein} rx={0} />
                  <rect x={x} y={baseY - proteinH - carbsH} width={barW} height={carbsH} fill={COLORS.carbs} rx={0} />
                  <rect x={x} y={baseY - proteinH - carbsH - fatH} width={barW} height={fatH} fill={COLORS.fat} rx={2} />
                </g>
              );
            })}
            {/* Y labels */}
            {yTicks.map(v => (
              <text key={v} x={PAD.left - 6} y={toY(v) + 3} textAnchor="end"
                fontSize={10} fill="var(--text-secondary)">{v}g</text>
            ))}
            {/* X labels */}
            {data.map((d, i) => i % xInterval === 0 || i === data.length - 1 ? (
              <text key={i} x={barX(i) + barW / 2} y={H - 4} textAnchor="middle"
                fontSize={10} fill="var(--text-secondary)">{d.label}</text>
            ) : null)}
          </svg>
        ) : null}
      </div>
    </div>
  );
};

export default NutritionMacroChart;
