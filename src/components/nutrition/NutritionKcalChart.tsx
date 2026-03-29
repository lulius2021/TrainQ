// src/components/nutrition/NutritionKcalChart.tsx
// Pure SVG — no Recharts (avoids React 19 crash)
import React, { useRef, useState, useEffect } from "react";

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
const H = 180;
const PAD = { top: 10, right: 12, bottom: 24, left: 40 };

const NutritionKcalChart: React.FC<NutritionKcalChartProps> = ({ data, kcalGoal }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    const cw = ref.current.clientWidth;
    if (cw > 0) setW(cw);
  }, []);

  const maxKcal = Math.max(...data.map(d => d.kcal), kcalGoal, 100);
  const chartW = w - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const toX = (i: number) => PAD.left + (chartW / Math.max(data.length - 1, 1)) * i;
  const toY = (v: number) => PAD.top + chartH - (v / maxKcal) * chartH;

  const areaPath = data.length > 1
    ? `M${data.map((d, i) => `${toX(i)},${toY(d.kcal)}`).join(" L")} L${toX(data.length - 1)},${PAD.top + chartH} L${toX(0)},${PAD.top + chartH} Z`
    : "";
  const linePath = data.length > 1
    ? `M${data.map((d, i) => `${toX(i)},${toY(d.kcal)}`).join(" L")}`
    : "";

  // Y-axis ticks
  const yTicks: number[] = [];
  const step = Math.max(Math.ceil(maxKcal / 4 / 100) * 100, 100);
  for (let v = 0; v <= maxKcal; v += step) yTicks.push(v);

  // X-axis labels (show ~5)
  const xInterval = Math.max(1, Math.floor(data.length / 5));

  return (
    <div className="w-full bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] p-4">
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
        Kalorien
      </h4>
      <div ref={ref} style={{ width: "100%", height: H }}>
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-[var(--text-secondary)]">
            Keine Daten
          </div>
        ) : w > 0 ? (
          <svg width={w} height={H}>
            {/* Grid lines */}
            {yTicks.map(v => (
              <line key={v} x1={PAD.left} x2={w - PAD.right} y1={toY(v)} y2={toY(v)}
                stroke="var(--border-color)" strokeDasharray="3 3" />
            ))}
            {/* Goal line */}
            {kcalGoal > 0 && (
              <line x1={PAD.left} x2={w - PAD.right} y1={toY(kcalGoal)} y2={toY(kcalGoal)}
                stroke="var(--text-secondary)" strokeDasharray="6 4" strokeOpacity={0.5} />
            )}
            {/* Area fill */}
            <defs>
              <linearGradient id="kcal-g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={ACCENT} stopOpacity={0.4} />
                <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
              </linearGradient>
            </defs>
            {areaPath && <path d={areaPath} fill="url(#kcal-g)" />}
            {linePath && <path d={linePath} fill="none" stroke={ACCENT} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />}
            {/* Dots */}
            {data.map((d, i) => d.kcal > 0 ? (
              <circle key={i} cx={toX(i)} cy={toY(d.kcal)} r={3} fill={ACCENT} />
            ) : null)}
            {/* Y labels */}
            {yTicks.map(v => (
              <text key={v} x={PAD.left - 6} y={toY(v) + 3} textAnchor="end"
                fontSize={10} fill="var(--text-secondary)">
                {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
              </text>
            ))}
            {/* X labels */}
            {data.map((d, i) => i % xInterval === 0 || i === data.length - 1 ? (
              <text key={i} x={toX(i)} y={H - 4} textAnchor="middle"
                fontSize={10} fill="var(--text-secondary)">
                {d.label}
              </text>
            ) : null)}
          </svg>
        ) : null}
      </div>
    </div>
  );
};

export default NutritionKcalChart;
