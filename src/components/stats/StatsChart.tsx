import React, { useRef, useState, useEffect, useMemo } from "react";
import {
    Area,
    AreaChart,
    CartesianGrid,
    XAxis,
    YAxis,
} from "recharts";
import { useTheme } from "../../theme/ThemeContext";

type ChartType = "area" | "bar" | "pie";

interface StatsChartProps {
    title: string;
    valueDisplay?: string;
    data: any[];
    dataKey?: string;
    labelKey?: string;
    unit?: string;
    type: ChartType;
    color?: string;
    height?: number;
}

const COLORS = ["#007AFF", "#F59E0B", "#10B981", "#8B5CF6", "#F43F5E", "#6366F1"];
const AREA_CHART_MARGIN = { top: 10, right: 0, left: -20, bottom: 0 };
const yAxisTickFormatter = (val: number): string => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : String(val);

// ── Custom SVG Donut (replaces Recharts PieChart which crashes with React 19) ──
function SvgDonut({ data, dataKey, size }: { data: any[]; dataKey: string; size: number }) {
    const total = data.reduce((sum, d) => sum + (d[dataKey] || 0), 0);
    if (total <= 0) return null;

    const cx = size / 2;
    const cy = size / 2;
    const outerR = size / 2 - 4;
    const innerR = outerR * 0.72;
    const gap = data.length > 1 ? 0.04 : 0;

    // Single segment → full donut ring (SVG arc can't draw a full circle, so use two circles)
    if (data.length === 1) {
        return (
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <circle cx={cx} cy={cy} r={outerR} fill={COLORS[0]} />
                <circle cx={cx} cy={cy} r={innerR} fill="var(--card-bg, #fff)" />
            </svg>
        );
    }

    let currentAngle = -Math.PI / 2;

    const paths = data.map((d, i) => {
        const value = d[dataKey] || 0;
        const sliceAngle = (value / total) * (2 * Math.PI) - gap;
        if (sliceAngle <= 0) return null;

        const startAngle = currentAngle + gap / 2;
        const endAngle = startAngle + sliceAngle;
        currentAngle = startAngle + sliceAngle + gap / 2;

        const largeArc = sliceAngle > Math.PI ? 1 : 0;

        const x1o = cx + outerR * Math.cos(startAngle);
        const y1o = cy + outerR * Math.sin(startAngle);
        const x2o = cx + outerR * Math.cos(endAngle);
        const y2o = cy + outerR * Math.sin(endAngle);
        const x1i = cx + innerR * Math.cos(endAngle);
        const y1i = cy + innerR * Math.sin(endAngle);
        const x2i = cx + innerR * Math.cos(startAngle);
        const y2i = cy + innerR * Math.sin(startAngle);

        const path = [
            `M ${x1o} ${y1o}`,
            `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2o} ${y2o}`,
            `L ${x1i} ${y1i}`,
            `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2i} ${y2i}`,
            `Z`,
        ].join(" ");

        return <path key={i} d={path} fill={COLORS[i % COLORS.length]} />;
    });

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {paths}
        </svg>
    );
}

export const StatsChart: React.FC<StatsChartProps> = ({
    title,
    valueDisplay,
    data,
    dataKey = "value",
    labelKey = "label",
    type,
    color = "#007AFF",
    height = 220,
}) => {
    const { theme } = useTheme();
    const isPie = type === "pie";
    const containerRef = useRef<HTMLDivElement>(null);
    const [chartWidth, setChartWidth] = useState(0);

    useEffect(() => {
        if (!containerRef.current) return;
        const w = containerRef.current.clientWidth;
        if (w > 0) setChartWidth(w);
    }, []);

    const gradientId = `gradient-${title.replace(/\s+/g, "-").toLowerCase()}`;

    const validPieData = useMemo(() => {
        if (!isPie) return [];
        return data.filter((d) => {
            const v = d[dataKey];
            return typeof v === "number" && Number.isFinite(v) && v > 0;
        });
    }, [data, dataKey, isPie]);

    return (
        <div
            className="w-full rounded-3xl p-6 flex flex-col items-start gap-4 shadow-xl border backdrop-blur-md transition-colors"
            style={{
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border
            }}
        >
            <div className="w-full flex items-end justify-between px-1">
                <div className="flex flex-col">
                    <h3 className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: theme.colors.textSecondary }}>{title}</h3>
                    {valueDisplay && (
                        <span className="text-3xl font-black tracking-tight" style={{ color: theme.colors.text }}>
                            {valueDisplay}
                        </span>
                    )}
                </div>
            </div>

            <div ref={containerRef} style={{ width: "100%", height }} className="relative mt-2">
                {data.length === 0 || (isPie && validPieData.length === 0) ? (
                    <div className="absolute inset-0 flex items-center justify-center text-sm font-medium" style={{ color: theme.colors.textSecondary }}>
                        Keine Daten
                    </div>
                ) : chartWidth > 0 ? (
                    <>
                        {isPie ? (
                            <div className="w-full h-full flex items-center justify-center">
                                <SvgDonut data={validPieData} dataKey={dataKey} size={Math.min(chartWidth, height)} />
                            </div>
                        ) : (
                            <AreaChart width={chartWidth} height={height} data={data} margin={AREA_CHART_MARGIN}>
                                <defs>
                                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={color} stopOpacity={0.5} />
                                        <stop offset="95%" stopColor={color} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="var(--chart-grid)"
                                    vertical={false}
                                />
                                <XAxis
                                    dataKey={labelKey}
                                    stroke="var(--text-secondary)"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={12}
                                    interval="preserveStartEnd"
                                    minTickGap={15}
                                    fontWeight={500}
                                />
                                <YAxis
                                    hide={false}
                                    stroke="var(--text-secondary)"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={yAxisTickFormatter}
                                />
                                <Area
                                    type="monotone"
                                    dataKey={dataKey}
                                    stroke={color}
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill={`url(#${gradientId})`}
                                    isAnimationActive={false}
                                    activeDot={false}
                                />
                            </AreaChart>
                        )}
                    </>
                ) : null}
            </div>

            {isPie && validPieData.length > 0 && (
                <div className="w-full flex flex-wrap gap-3 mt-1 justify-center">
                    {validPieData.slice(0, 5).map((entry, idx) => (
                        <div key={idx} className="flex items-center gap-2 py-1 px-3 rounded-full border border-transparent shadow-sm" style={{ backgroundColor: theme.colors.inputBackground }}>
                            <div className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]" style={{ background: COLORS[idx % COLORS.length] }} />
                            <span className="text-[10px] uppercase font-bold tracking-wide" style={{ color: theme.colors.textSecondary }}>{entry.name}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
