import React from "react";
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    Cell,
    PieChart,
    Pie
} from "recharts";

type ChartType = "area" | "bar" | "pie";

interface StatsChartProps {
    title: string;
    valueDisplay?: string; // e.g. "12.5 t"
    data: any[];
    dataKey?: string; // key for value in data objects
    labelKey?: string; // key for X-Axis label
    unit?: string;
    type: ChartType;
    color?: string; // main color hex
    height?: number;
}

const COLORS = ["#007AFF", "#F59E0B", "#10B981", "#8B5CF6", "#F43F5E", "#6366F1"];

export const StatsChart: React.FC<StatsChartProps> = ({
    title,
    valueDisplay,
    data,
    dataKey = "value",
    labelKey = "label",
    unit = "",
    type,
    color = "#007AFF",
    height = 220,
}) => {
    const isPie = type === "pie";

    // Gradient ID generation to avoid conflicts
    const gradientId = `gradient-${title.replace(/\s+/g, "-").toLowerCase()}`;

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-[#1C1C1E] border border-white/10 rounded-xl px-3 py-2 shadow-xl">
                    <p className="text-white/60 text-xs mb-1">{label}</p>
                    <p className="text-white font-semibold text-sm">
                        {payload[0].value.toLocaleString("de-DE")} {unit}
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="w-full bg-zinc-900/80 border border-white/5 backdrop-blur-md rounded-3xl p-6 flex flex-col items-start gap-4 shadow-xl">
            <div className="w-full flex items-end justify-between px-1">
                <div className="flex flex-col">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">{title}</h3>
                    {valueDisplay && (
                        <span className="text-3xl font-black text-white tracking-tight">
                            {valueDisplay}
                        </span>
                    )}
                </div>
            </div>

            <div style={{ width: "100%", height }} className="relative mt-2">
                {data.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-sm font-medium">
                        Keine Daten
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        {type === "area" || type === "bar" ? (
                            <AreaChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={color} stopOpacity={0.5} />
                                        <stop offset="95%" stopColor={color} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} opacity={0.2} />
                                <XAxis
                                    dataKey={labelKey}
                                    stroke="#52525b"
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
                                    stroke="#52525b"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ stroke: "white", strokeWidth: 1, strokeOpacity: 0.1, strokeDasharray: "4 4" }} />
                                <Area
                                    type="monotone"
                                    dataKey={dataKey}
                                    stroke={color}
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill={`url(#${gradientId})`}
                                    animationDuration={1500}
                                    activeDot={{ r: 6, strokeWidth: 0, fill: "white" }}
                                />
                            </AreaChart>
                        ) : (
                            <PieChart>
                                <Pie
                                    data={data}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey={dataKey}
                                    nameKey="name" // expecting matches SportSplitPoint
                                    stroke="none"
                                >
                                    {data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const item = payload[0].payload;
                                            // Custom tooltip for Pie
                                            return (
                                                <div className="bg-[#18181b] border border-white/10 rounded-xl px-4 py-3 shadow-[0_8px_30px_rgb(0,0,0,0.5)]">
                                                    <p className="text-white font-bold text-sm mb-0.5">{item.name}</p>
                                                    <p className="text-zinc-400 text-xs font-mono">{item.value} {unit}</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                            </PieChart>
                        )}
                    </ResponsiveContainer>
                )}
            </div>

            {isPie && data.length > 0 && (
                <div className="w-full flex flex-wrap gap-3 mt-1 justify-center">
                    {data.slice(0, 5).map((entry, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-white/5 py-1 px-3 rounded-full border border-white/5">
                            <div className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]" style={{ background: COLORS[idx % COLORS.length] }} />
                            <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wide">{entry.name}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
