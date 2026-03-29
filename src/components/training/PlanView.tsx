
import React from "react";
import { Calendar, Minus, Plus, Layout, FileText } from "lucide-react";

type PlanTab = "weekly" | "routine";

interface PlanViewProps {
    activeTab: PlanTab;
    onTabChange: (tab: PlanTab) => void;
    startDateISO: string;
    onStartDateChange: (dateISO: string) => void;
    durationWeeks: number;
    onDurationChange: (weeks: number) => void;
    onOpenWorkoutTemplates: () => void;
    onOpenPlanTemplates: () => void;
    onShowPreview: () => void;
    isPro: boolean;
    freeLimitRemaining?: number;
}

export default function PlanView({
    activeTab,
    onTabChange,
    startDateISO,
    onStartDateChange,
    durationWeeks,
    onDurationChange,
    onOpenWorkoutTemplates,
    onOpenPlanTemplates,
}: PlanViewProps) {
    const dateLabel = new Date(startDateISO).toLocaleDateString("de-DE", {
        day: "2-digit", month: "short", year: "numeric",
    });

    return (
        <div className="space-y-3">
            {/* Segmented control — compact */}
            <div
                className="flex p-1 rounded-2xl"
                style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border-color)" }}
            >
                {(["weekly", "routine"] as PlanTab[]).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => onTabChange(tab)}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
                        style={{
                            backgroundColor: activeTab === tab ? "var(--bg-color)" : "transparent",
                            color: activeTab === tab ? "var(--text-color)" : "var(--text-secondary)",
                            boxShadow: activeTab === tab ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
                        }}
                    >
                        {tab === "weekly" ? "Wochenplan" : "Routine"}
                    </button>
                ))}
            </div>

            {/* Date + Duration in one row */}
            <div
                className="flex items-center gap-3 px-4 py-3 rounded-[18px]"
                style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border-color)" }}
            >
                {/* Date picker */}
                <div className="flex items-center gap-2 flex-1 relative">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(0,122,255,0.1)" }}>
                        <Calendar size={16} className="text-blue-500" />
                    </div>
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Start</div>
                        <div className="text-sm font-semibold" style={{ color: "var(--text-color)" }}>{dateLabel}</div>
                    </div>
                    <input
                        type="date"
                        value={startDateISO}
                        onChange={(e) => onStartDateChange(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                </div>

                {/* Divider */}
                <div className="w-px h-8 self-center" style={{ backgroundColor: "var(--border-color)" }} />

                {/* Duration */}
                <div className="flex items-center gap-2">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Dauer</div>
                        <div className="text-sm font-semibold" style={{ color: "var(--text-color)" }}>{durationWeeks} Wo.</div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => onDurationChange(Math.max(1, durationWeeks - 1))}
                            className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-90 transition-transform"
                            style={{ backgroundColor: "var(--border-color)", color: "var(--text-secondary)" }}
                        >
                            <Minus size={14} />
                        </button>
                        <button
                            onClick={() => onDurationChange(Math.min(52, durationWeeks + 1))}
                            className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-90 transition-transform"
                            style={{ backgroundColor: "var(--border-color)", color: "var(--text-secondary)" }}
                        >
                            <Plus size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Template buttons — compact pill row */}
            <div className="flex gap-3">
                <button
                    onClick={onOpenWorkoutTemplates}
                    className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-[14px] active:scale-[0.97] transition-transform"
                    style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border-color)" }}
                >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(59,130,246,0.12)" }}>
                        <Layout size={14} className="text-blue-400" />
                    </div>
                    <div className="text-left">
                        <div className="text-xs font-bold" style={{ color: "var(--text-color)" }}>Workouts</div>
                        <div className="text-[10px]" style={{ color: "var(--text-secondary)" }}>Vorlagen</div>
                    </div>
                </button>
                <button
                    onClick={onOpenPlanTemplates}
                    className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-[14px] active:scale-[0.97] transition-transform"
                    style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border-color)" }}
                >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(168,85,247,0.12)" }}>
                        <FileText size={14} className="text-purple-400" />
                    </div>
                    <div className="text-left">
                        <div className="text-xs font-bold" style={{ color: "var(--text-color)" }}>Pläne</div>
                        <div className="text-[10px]" style={{ color: "var(--text-secondary)" }}>Wochenpläne</div>
                    </div>
                </button>
            </div>
        </div>
    );
}
