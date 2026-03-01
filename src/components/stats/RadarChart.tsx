import React, { useMemo } from "react";

interface RadarDataPoint {
    label: string;
    value: number; // 0..1 normalized (or up to maxValue)
    fullMark?: number; // max reference
}

interface RadarChartProps {
    data: RadarDataPoint[];
    size?: number;
    color?: string; // hex or tailwind color class
    className?: string;
}

export const RadarChart: React.FC<RadarChartProps> = ({
    data,
    size = 300,
    color = "#3b82f6", // blue-500
    className = "",
}) => {
    const padding = 40;
    const w = size;
    const h = size;
    const center = size / 2;
    const radius = (size - padding * 2) / 2;

    const points = useMemo(() => {
        const total = data.length;
        if (total < 3) return null; // Need at least 3 points for a polygon

        const angleStep = (Math.PI * 2) / total;

        return data.map((d, i) => {
            const angle = i * angleStep - Math.PI / 2; // -PI/2 to start at top
            const val = Math.min(1, Math.max(0, d.value / (d.fullMark || 1)));
            const r = radius * val;
            const x = center + Math.cos(angle) * r;
            const y = center + Math.sin(angle) * r;

            const labelR = radius + 20;
            const labelX = center + Math.cos(angle) * labelR;
            const labelY = center + Math.sin(angle) * labelR;

            return { x, y, labelX, labelY, label: d.label, value: d.value };
        });
    }, [data, center, radius]);

    // Background Grid (Concentric webs)
    const gridLevels = [0.25, 0.5, 0.75, 1];
    const gridShapes = useMemo(() => {
        if (!data.length) return [];
        const angleStep = (Math.PI * 2) / data.length;

        return gridLevels.map((level) => {
            const levelRadius = radius * level;
            const d = data
                .map((_, i) => {
                    const angle = i * angleStep - Math.PI / 2;
                    const x = center + Math.cos(angle) * levelRadius;
                    const y = center + Math.sin(angle) * levelRadius;
                    return `${i === 0 ? "M" : "L"} ${x},${y}`;
                })
                .join(" ");
            return d + " Z";
        });
    }, [data.length, center, radius]);

    const axes = useMemo(() => {
        if (!data.length) return [];
        const angleStep = (Math.PI * 2) / data.length;
        return data.map((_, i) => {
            const angle = i * angleStep - Math.PI / 2;
            const x = center + Math.cos(angle) * radius;
            const y = center + Math.sin(angle) * radius;
            return { x1: center, y1: center, x2: x, y2: y };
        });
    }, [data.length, center, radius]);

    const polygonPath = useMemo(() => {
        if (!points) return "";
        return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`).join(" ") + " Z";
    }, [points]);

    if (!points) {
        return (
            <div
                className={`flex items-center justify-center text-xs ${className}`}
                style={{ width: size, height: size, color: "var(--text-muted)" }}
            >
                Zu wenig Daten
            </div>
        );
    }

    return (
        <div className={`relative ${className}`} style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
                {/* Definitions for Glow */}
                <defs>
                    <filter id="glow-radar" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                    <linearGradient id="radar-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.6" />
                        <stop offset="100%" stopColor={color} stopOpacity="0.1" />
                    </linearGradient>
                </defs>

                {/* Axes */}
                {axes.map((axis, i) => (
                    <line
                        key={`axis-${i}`}
                        x1={axis.x1}
                        y1={axis.y1}
                        x2={axis.x2}
                        y2={axis.y2}
                        stroke="var(--chart-grid)"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                    />
                ))}

                {/* Grid Levels */}
                {gridShapes.map((pathStr, i) => (
                    <path
                        key={`grid-${i}`}
                        d={pathStr}
                        fill="none"
                        stroke="var(--chart-grid)"
                        strokeWidth="1"
                    />
                ))}

                {/* The Data Polygon */}
                <path
                    d={polygonPath}
                    fill="url(#radar-gradient)"
                    stroke={color}
                    strokeWidth="2"
                    filter="url(#glow-radar)"
                    className="transition-all duration-500 ease-out"
                />

                {/* Vertex Dots */}
                {points.map((p, i) => (
                    <circle
                        key={`dot-${i}`}
                        cx={p.x}
                        cy={p.y}
                        r="3"
                        fill="white"
                        stroke={color}
                        strokeWidth="1.5"
                        className="transition-all duration-500 ease-out"
                    />
                ))}

                {/* Labels */}
                {points.map((p, i) => (
                    <text
                        key={`label-${i}`}
                        x={p.labelX}
                        y={p.labelY}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="var(--muted, #a1a1aa)"
                        fontSize="10"
                        className="font-medium uppercase tracking-wider"
                    >
                        {p.label}
                    </text>
                ))}
            </svg>
        </div>
    );
};
