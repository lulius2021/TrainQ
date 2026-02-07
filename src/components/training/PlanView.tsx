
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Minus, Plus, FileText, Layout, Info, HelpCircle } from "lucide-react";
import { AppCard } from "../ui/AppCard";

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
    onShowPreview,
    isPro,
    freeLimitRemaining,
}: PlanViewProps) {
    const [showRoutineInfo, setShowRoutineInfo] = useState(false);

    // Cast motion div to any to avoid strict typescript errors with props
    const MotionDiv = motion.div as any;

    // Trigger education overlay once when switching to routine
    useEffect(() => {
        if (activeTab === "routine") {
            const hasSeenInfo = localStorage.getItem("trainq_seen_routine_info");
            if (!hasSeenInfo) {
                setShowRoutineInfo(true);
                localStorage.setItem("trainq_seen_routine_info", "true");
            }
        }
    }, [activeTab]);

    return (
        <div className="space-y-8 pb-32">
            {/* --- Segmented Control --- */}
            <div className="relative p-1 bg-zinc-900 rounded-2xl border border-white/5 flex">
                {/* Background Pill Animation */}
                <MotionDiv
                    layout
                    className="absolute top-1 bottom-1 bg-zinc-800 rounded-xl shadow-sm z-0"
                    initial={false}
                    animate={{
                        left: activeTab === "weekly" ? "4px" : "50%",
                        width: "calc(50% - 4px)",
                        x: activeTab === "weekly" ? 0 : 0
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />

                <button
                    onClick={() => onTabChange("weekly")}
                    className={`relative z-10 flex-1 py-4 text-center font-bold text-lg transition-colors duration-200 ${activeTab === "weekly" ? "text-white" : "text-zinc-500"
                        }`}
                >
                    Wochenplan
                </button>
                <button
                    onClick={() => onTabChange("routine")}
                    className={`relative z-10 flex-1 py-4 text-center font-bold text-lg transition-colors duration-200 ${activeTab === "routine" ? "text-white" : "text-zinc-500"
                        }`}
                >
                    Routine
                </button>
            </div>

            {/* Routine Info Badge */}
            <AnimatePresence>
                {activeTab === "routine" && (
                    <MotionDiv
                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                        animate={{ opacity: 1, height: "auto", marginTop: -10 }}
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="pt-4 flex justify-center">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium">
                                <Info size={14} />
                                Flexibel trainieren ohne festes Datum
                            </div>
                        </div>
                    </MotionDiv>
                )}
            </AnimatePresence>


            {/* --- Date & Duration Picker (Pills) --- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* Start Date Pill */}
                <div className="relative group">
                    <div className="absolute inset-0 bg-blue-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative bg-zinc-900 border border-white/10 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-blue-500/50 transition-all active:scale-[0.98]">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">Startdatum</span>
                            <div className="flex items-center gap-2">
                                <span className="text-white font-bold text-lg font-mono">{new Date(startDateISO).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
                            </div>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
                            <Calendar size={20} />
                        </div>
                        {/* Hidden Input for functionality */}
                        <input
                            type="date"
                            value={startDateISO}
                            onChange={(e) => onStartDateChange(e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        />
                    </div>
                </div>

                {/* Duration Pill */}
                <div className="relative group">
                    <div className="absolute inset-0 bg-orange-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative bg-zinc-900 border border-white/10 rounded-2xl p-3 flex items-center justify-between hover:border-orange-500/50 transition-all">
                        <div className="flex flex-col pl-1">
                            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">Dauer</span>
                            <span className="text-white font-bold text-lg">{durationWeeks} Wochen</span>
                        </div>

                        <div className="flex items-center gap-1 bg-black/40 rounded-xl p-1 border border-white/5">
                            <button
                                onClick={() => onDurationChange(Math.max(1, durationWeeks - 1))}
                                className="w-9 h-9 flex items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 active:scale-95 transition-all"
                            >
                                <Minus size={16} />
                            </button>
                            <button
                                onClick={() => onDurationChange(Math.min(52, durationWeeks + 1))}
                                className="w-9 h-9 flex items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 active:scale-95 transition-all"
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Template Section --- */}
            <div className="grid grid-cols-2 gap-4">
                <button
                    onClick={onOpenWorkoutTemplates}
                    className="group relative h-40 rounded-3xl overflow-hidden border border-white/5 hover:border-blue-500/50 transition-all active:scale-[0.98]"
                >
                    {/* Background with Gradient/Image-look */}
                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-black z-0" />
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/20 via-transparent to-transparent opacity-50" />

                    <div className="absolute top-4 right-4 p-2 bg-white/5 rounded-2xl backdrop-blur-md border border-white/10 z-10 group-hover:scale-110 transition-transform">
                        <Layout size={24} className="text-blue-400" />
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent z-10 text-left">
                        <div className="text-white font-bold text-lg leading-tight">Workouts</div>
                        <div className="text-xs text-zinc-400 mt-1">Einzelne Vorlagen</div>
                    </div>
                </button>

                <button
                    onClick={onOpenPlanTemplates}
                    className="group relative h-40 rounded-3xl overflow-hidden border border-white/5 hover:border-purple-500/50 transition-all active:scale-[0.98]"
                >
                    {/* Background with Gradient/Image-look */}
                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-black z-0" />
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-purple-500/20 via-transparent to-transparent opacity-50" />

                    <div className="absolute top-4 right-4 p-2 bg-white/5 rounded-2xl backdrop-blur-md border border-white/10 z-10 group-hover:scale-110 transition-transform">
                        <FileText size={24} className="text-purple-400" />
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent z-10 text-left">
                        <div className="text-white font-bold text-lg leading-tight">Pläne</div>
                        <div className="text-xs text-zinc-400 mt-1">Ganze Wochenpläne</div>
                    </div>
                </button>
            </div>

            {/* --- Routine Education --- */}
            <AnimatePresence>
                {activeTab === "routine" && (
                    <MotionDiv
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="space-y-4"
                    >
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Warum Routinen?</h3>
                            {showRoutineInfo && (
                                <button onClick={() => setShowRoutineInfo(false)} className="text-xs text-blue-500">Ausblenden</button>
                            )}
                        </div>

                        <div className="p-4 bg-gradient-to-b from-blue-500/10 to-transparent rounded-2xl border border-blue-500/20">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                                    <Info className="text-blue-500" size={20} />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="font-bold text-white text-sm">Maximale Flexibilität</h4>
                                    <p className="text-sm text-zinc-300 leading-snug">
                                        Routinen sind dein Werkzeug für maximale Flexibilität. Ideal, wenn dein Alltag unvorhersehbar ist.
                                    </p>
                                    <div className="pt-2 flex items-center gap-2 text-xs text-blue-400 font-medium">
                                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                        Jederzeit manuell startbar
                                    </div>
                                </div>
                            </div>
                        </div>
                    </MotionDiv>
                )}
            </AnimatePresence>
        </div>
    );
}
