import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { History, Bike, MapPin, Timer } from "lucide-react";
import { IconDumbbellFill } from "../../assets/icons/IconDumbbellFill";
import { IconFigureRun } from "../../assets/icons/IconFigureRun";
import { AppButton } from "../ui/AppButton";
import type { WorkoutHistoryEntry } from "../../utils/workoutHistory";
import { formatPace, formatDistanceKm } from "../../utils/gpsUtils";
import { useModalStore } from "../../store/useModalStore";
import { hapticSheetClose } from "../../native/haptics";

interface WorkoutHistoryOverlayProps {
    open: boolean;
    onClose: () => void;
    workouts: WorkoutHistoryEntry[];
    onShare: (w: WorkoutHistoryEntry) => void;
}

function normalizeSport(s?: string): "Gym" | "Laufen" | "Radfahren" | "Custom" | "Unknown" {
    const t = (s || "").trim().toLowerCase();
    if (t === "gym") return "Gym";
    if (t === "laufen") return "Laufen";
    if (t === "radfahren") return "Radfahren";
    if (t === "custom") return "Custom";
    return "Unknown";
}

function toLocalDateLabel(iso?: string): string {
    if (!iso) return "–";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "–";
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function durationMinutes(w: WorkoutHistoryEntry): number {
    return Math.max(0, Math.round((w.durationSec ?? 0) / 60));
}

const CLOSE_OFFSET = 80;
const CLOSE_VELOCITY = 500;

const MotionDiv = motion.div as unknown as React.ComponentType<any>;

export const WorkoutHistoryOverlay: React.FC<WorkoutHistoryOverlayProps> = ({ open, onClose, workouts, onShare }) => {
    const dragControls = useDragControls();
    const push = useModalStore((s) => s.push);
    const pop  = useModalStore((s) => s.pop);
    const activateShield = useModalStore((s) => s.activateShield);

    useEffect(() => {
        if (open) { push(); return () => pop(); }
    }, [open, push, pop]);

    // Lock body scroll
    useEffect(() => {
        if (!open) return;
        const root = document.getElementById("root");
        root?.classList.add("modal-open");
        const preventScroll = (e: TouchEvent) => {
            const target = e.target as HTMLElement;
            if (target.closest("[data-sheet-content]")) return;
            e.preventDefault();
        };
        document.addEventListener("touchmove", preventScroll, { passive: false });
        return () => {
            root?.classList.remove("modal-open");
            document.removeEventListener("touchmove", preventScroll);
        };
    }, [open]);

    const handleClose = () => {
        hapticSheetClose();
        activateShield();
        onClose();
    };

    const handleDragEnd = (_: any, info: { offset: { y: number }; velocity: { y: number } }) => {
        if (info.offset.y > CLOSE_OFFSET || info.velocity.y > CLOSE_VELOCITY) handleClose();
    };

    return createPortal(
        <AnimatePresence>
            {open && (
                <MotionDiv
                    className="fixed inset-0"
                    style={{ zIndex: 150 }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0"
                        style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", touchAction: "none" }}
                        onPointerDown={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); handleClose(); } }}
                        onTouchMove={(e) => e.preventDefault()}
                    />

                    {/* Sheet */}
                    <div className="fixed left-0 right-0 bottom-0 flex justify-center">
                        <MotionDiv
                            className="w-full max-w-md flex flex-col rounded-t-[28px] shadow-2xl shadow-black/40"
                            style={{ height: "88dvh", background: "var(--card-bg)" }}
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "105%" }}
                            transition={{ type: "spring", stiffness: 420, damping: 38, mass: 0.9 }}
                            drag="y"
                            dragControls={dragControls}
                            dragListener={false}
                            dragConstraints={{ top: 0 }}
                            dragElastic={{ top: 0.15, bottom: 0 }}
                            onDragEnd={handleDragEnd}
                        >
                            {/* Handle + Header */}
                            <div
                                className="shrink-0"
                                onPointerDown={(e: React.PointerEvent) => {
                                    if ((e.target as HTMLElement).closest("button, a, input")) return;
                                    dragControls.start(e);
                                }}
                                style={{ cursor: "grab", touchAction: "none" }}
                            >
                                <div className="flex justify-center pt-3 pb-1">
                                    <div className="h-1.5 w-14 rounded-full" style={{ background: "var(--border-color)" }} />
                                </div>
                                <div className="flex items-center gap-3 px-5 pt-2 pb-3">
                                    <div className="p-2 rounded-2xl" style={{ backgroundColor: "var(--input-bg)" }}>
                                        <History className="w-5 h-5" style={{ color: "var(--text-color)" }} />
                                    </div>
                                    <h2 className="text-[17px] font-bold" style={{ color: "var(--text-color)" }}>Deine Historie</h2>
                                </div>
                            </div>

                            {/* Scrollable Content */}
                            <div
                                data-sheet-content
                                className="flex-1 min-h-0 overflow-y-auto px-4 pb-8 space-y-3"
                                style={{ overscrollBehavior: "contain" }}
                            >
                                {workouts.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                                        <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl" style={{ backgroundColor: "var(--input-bg)" }}>
                                            📅
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="font-medium" style={{ color: "var(--text-color)" }}>Keine Trainings gefunden</h3>
                                            <p className="text-sm max-w-xs" style={{ color: "var(--text-muted)" }}>Sobald du ein Training absolvierst, erscheint es hier in deiner Historie.</p>
                                        </div>
                                    </div>
                                )}

                                {workouts.map((w) => {
                                    const sport = normalizeSport(w.sport);
                                    const isCardio = sport === "Laufen" || sport === "Radfahren";
                                    const exCount = (w.exercises ?? []).length;
                                    const date = toLocalDateLabel(w.endedAt ?? w.startedAt);
                                    const mins = durationMinutes(w);

                                    const sportConfig = sport === "Laufen"
                                        ? { icon: <IconFigureRun width={16} height={16} />, color: "#34C759", bg: "rgba(52,199,89,0.1)" }
                                        : sport === "Radfahren"
                                        ? { icon: <Bike size={16} />, color: "#FF9500", bg: "rgba(255,149,0,0.1)" }
                                        : { icon: <IconDumbbellFill width={16} height={10} />, color: "#007AFF", bg: "rgba(0,122,255,0.1)" };

                                    return (
                                        <div key={w.id} className="rounded-2xl p-4 border" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}>
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: sportConfig.bg, color: sportConfig.color }}>
                                                        {sportConfig.icon}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-base font-bold" style={{ color: "var(--text-color)" }}>{w.title ?? "Training"}</h4>
                                                        <div className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--text-muted)" }}>{date}</div>
                                                    </div>
                                                </div>
                                                <div className="px-2 py-1 rounded-lg text-[11px] font-bold" style={{ backgroundColor: sportConfig.bg, color: sportConfig.color }}>
                                                    {sport}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 text-sm mb-3 flex-wrap" style={{ color: "var(--text-secondary)" }}>
                                                <span className="flex items-center gap-1.5"><Timer size={14} /> {mins} min</span>
                                                {isCardio && w.distanceKm != null && w.distanceKm > 0 ? (
                                                    <>
                                                        <span className="flex items-center gap-1.5" style={{ color: sportConfig.color }}>
                                                            <MapPin size={14} /> {formatDistanceKm(w.distanceKm * 1000)}
                                                        </span>
                                                        {w.paceSecPerKm != null && w.paceSecPerKm > 0 && (
                                                            <span className="flex items-center gap-1.5">⚡ {formatPace(w.paceSecPerKm)}</span>
                                                        )}
                                                    </>
                                                ) : (
                                                    <span className="flex items-center gap-1.5">
                                                        <IconDumbbellFill width={14} height={8} /> {exCount > 0 ? `${exCount} Übung${exCount === 1 ? "" : "en"}` : "—"}
                                                    </span>
                                                )}
                                                {!isCardio && w.totalVolume > 0 && (
                                                    <span className="flex items-center gap-1.5">{Math.round(w.totalVolume).toLocaleString("de-DE")} kg</span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2 pt-3 border-t" style={{ borderColor: "var(--border-color)" }}>
                                                <AppButton
                                                    onClick={() => onShare(w)}
                                                    variant="ghost"
                                                    size="sm"
                                                    className="rounded-2xl h-8 text-xs border w-full justify-center"
                                                    style={{ backgroundColor: "var(--input-bg)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
                                                >
                                                    Teilen / Exportieren
                                                </AppButton>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </MotionDiv>
                    </div>
                </MotionDiv>
            )}
        </AnimatePresence>,
        document.body
    );
};
