import React, { useRef, useState, useEffect } from "react";
import {
    Area,
    AreaChart,
    CartesianGrid,
    XAxis,
    YAxis,
    Cell,
    PieChart,
    Pie
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
const yAxisTickFormatter = (val: number) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val;

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
                {data.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-sm font-medium" style={{ color: theme.colors.textSecondary }}>
                        Keine Daten
                    </div>
                ) : chartWidth > 0 ? (
                    <>
                        {type === "area" || type === "bar" ? (
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
                        ) : (
                            <PieChart width={chartWidth} height={height}>
                                <Pie
                                    data={data}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey={dataKey}
                                    nameKey="name"
                                    stroke="none"
                                    isAnimationActive={false}
                                >
                                    {data.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                            </PieChart>
                        )}
                    </>
                ) : null}
            </div>

            {isPie && data.length > 0 && (
                <div className="w-full flex flex-wrap gap-3 mt-1 justify-center">
                    {data.slice(0, 5).map((entry, idx) => (
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
