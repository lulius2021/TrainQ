import React, { useMemo, useState, useCallback } from "react";
import {
    Dumbbell, Footprints, Bike, Star, AlertTriangle,
    ChevronRight, Plus, Play, Trash2, X, MapPin
} from "lucide-react";
import type { CalendarEvent, TrainingType } from "../types/training";
import { useTodaysSessions } from "../hooks/useTodaysSessions";
import { useI18n } from "../i18n/useI18n";
import { startSession, startFreeTraining, startTrainingTemplate } from "../utils/startSession";
import { useLiveTrainingStore } from "../store/useLiveTrainingStore";
import { PageHeader } from "../components/ui/PageHeader";
import { AppButton } from "../components/ui/AppButton";
import {
    getTemplates,
    saveTemplate,
    deleteTemplate,
    type TrainingTemplateLite,
} from "../utils/trainingTemplatesStore";

interface StartTodayPageProps {
    events: CalendarEvent[];
    onPlanTraining: () => void;
}

function formatSportLabel(type: TrainingType): string {
    if (type === "laufen") return "Laufen";
    if (type === "radfahren") return "Radfahren";
    if (type === "custom") return "Custom";
    return "Gym";
}

function sportIcon(type: TrainingType) {
    if (type === "laufen") return <Footprints size={20} />;
    if (type === "radfahren") return <Bike size={20} />;
    if (type === "custom") return <Star size={20} />;
    return <Dumbbell size={20} />;
}

function sportColor(type: TrainingType): { color: string; bg: string } {
    if (type === "laufen") return { color: "#34C759", bg: "rgba(52,199,89,0.1)" };
    if (type === "radfahren") return { color: "#FF9500", bg: "rgba(255,149,0,0.1)" };
    if (type === "custom") return { color: "#AF52DE", bg: "rgba(175,82,222,0.1)" };
    return { color: "#007AFF", bg: "rgba(0,122,255,0.1)" };
}

// ---- Create Template Modal ----
function CreateTemplateModal({ open, onClose, onSave }: {
    open: boolean;
    onClose: () => void;
    onSave: (t: { title: string; sportType: TrainingType }) => void;
}) {
    const [title, setTitle] = useState("");
    const [sport, setSport] = useState<TrainingType>("gym");

    if (!open) return null;

    const handleSave = () => {
        if (!title.trim()) return;
        onSave({ title: title.trim(), sportType: sport });
        setTitle("");
        setSport("gym");
    };

    const sportOptions: { value: TrainingType; label: string }[] = [
        { value: "gym", label: "Gym" },
        { value: "laufen", label: "Laufen" },
        { value: "radfahren", label: "Radfahren" },
        { value: "custom", label: "Custom" },
    ];

    return (
        <div
            className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md rounded-t-[32px] p-6 pb-[calc(env(safe-area-inset-bottom)+24px)] border-t"
                style={{
                    backgroundColor: "var(--modal-bg)",
                    borderColor: "var(--border-color)",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold" style={{ color: "var(--text-color)" }}>Neue Vorlage</h3>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: "var(--button-bg)" }}
                    >
                        <X size={16} style={{ color: "var(--text-secondary)" }} />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label
                            className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block"
                            style={{ color: "var(--text-secondary)" }}
                        >
                            Bezeichnung
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="z.B. Push Day, Oberkörper..."
                            className="w-full px-4 py-3 rounded-xl border text-sm font-medium"
                            style={{
                                backgroundColor: "var(--input-bg)",
                                borderColor: "var(--border-color)",
                                color: "var(--text-color)",
                            }}
                        />
                    </div>

                    <div>
                        <label
                            className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block"
                            style={{ color: "var(--text-secondary)" }}
                        >
                            Sportart
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                            {sportOptions.map((o) => {
                                const sc = sportColor(o.value);
                                return (
                                    <button
                                        key={o.value}
                                        onClick={() => setSport(o.value)}
                                        className="py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-[0.97]"
                                        style={{
                                            backgroundColor: sport === o.value ? sc.bg : "var(--button-bg)",
                                            borderColor: sport === o.value ? sc.color : "var(--border-color)",
                                            color: sport === o.value ? sc.color : "var(--text-secondary)",
                                        }}
                                    >
                                        {o.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <AppButton
                        onClick={handleSave}
                        fullWidth
                        size="lg"
                        disabled={!title.trim()}
                        className="!rounded-2xl mt-2"
                    >
                        Vorlage erstellen
                    </AppButton>
                </div>
            </div>
        </div>
    );
}

// ---- Main Page ----
export default function StartTodayPage({ events, onPlanTraining }: StartTodayPageProps) {
    const { formatDate } = useI18n();
    const { sessions, status, primarySession } = useTodaysSessions(events);
    const activeWorkout = useLiveTrainingStore((s) => s.activeWorkout);
    const hasActiveWorkout = !!activeWorkout?.isActive;
    const [templates, setTemplates] = useState<TrainingTemplateLite[]>(() => getTemplates());
    const [showCreateModal, setShowCreateModal] = useState(false);

    const refreshTemplates = useCallback(() => {
        setTemplates(getTemplates());
    }, []);

    const handleFreeTraining = (sport: TrainingType = "gym") => {
        if (hasActiveWorkout) return;
        startFreeTraining(sport);
    };

    const handleStartTemplate = (tpl: TrainingTemplateLite) => {
        if (hasActiveWorkout) return;
        startTrainingTemplate(tpl);
    };

    const handleDeleteTemplate = (id: string) => {
        deleteTemplate(id);
        refreshTemplates();
    };

    const handleCreateTemplate = (input: { title: string; sportType: TrainingType }) => {
        saveTemplate(input);
        refreshTemplates();
        setShowCreateModal(false);
    };

    const todaySessions = status === "single" && primarySession ? [primarySession] : sessions;
    const hasSessions = status !== "none" && todaySessions.length > 0;

    return (
        <div className="w-full h-full pb-40" style={{ paddingTop: "env(safe-area-inset-top)" }}>
            <div className="w-full max-w-md mx-auto px-4 pt-2 space-y-6">

                {/* Active workout warning */}
                {hasActiveWorkout && (
                    <div
                        className="flex items-center gap-3 rounded-2xl px-4 py-3.5 border"
                        style={{
                            backgroundColor: "rgba(255,149,0,0.08)",
                            borderColor: "rgba(255,149,0,0.25)",
                        }}
                    >
                        <AlertTriangle size={18} className="text-amber-500 shrink-0" />
                        <p className="text-[13px] font-medium" style={{ color: "var(--text-color)" }}>
                            Ein Training läuft bereits. Beende es zuerst.
                        </p>
                    </div>
                )}

                {/* ── HEUTE GEPLANT ── */}
                <section className="space-y-2.5">
                    <h2
                        className="text-[11px] font-bold uppercase tracking-wider pl-1"
                        style={{ color: "var(--text-secondary)" }}
                    >
                        Heute geplant
                    </h2>

                    {hasSessions ? (
                        todaySessions.map((session) => {
                            const sc = sportColor(session.sportType);
                            return (
                                <button
                                    key={session.id}
                                    onClick={() => startSession(session)}
                                    disabled={hasActiveWorkout}
                                    className="w-full rounded-2xl p-4 border flex items-center gap-4 active:scale-[0.98] transition-transform text-left disabled:opacity-50"
                                    style={{
                                        backgroundColor: "var(--card-bg)",
                                        borderColor: "var(--border-color)",
                                    }}
                                >
                                    <div
                                        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                                        style={{ backgroundColor: sc.bg, color: sc.color }}
                                    >
                                        {sportIcon(session.sportType)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-[15px] font-bold truncate" style={{ color: "var(--text-color)" }}>
                                            {session.title || "Training"}
                                        </h3>
                                        <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                                            {session.startAt ? `${session.startAt} · ` : ""}{formatSportLabel(session.sportType)}
                                        </p>
                                    </div>
                                    <ChevronRight size={18} style={{ color: "var(--text-secondary)" }} className="shrink-0" />
                                </button>
                            );
                        })
                    ) : (
                        <div
                            className="rounded-2xl border border-dashed p-8 flex flex-col items-center gap-2"
                            style={{
                                borderColor: "var(--border-color)",
                                backgroundColor: "var(--card-bg)",
                            }}
                        >
                            <div
                                className="w-10 h-10 rounded-full flex items-center justify-center mb-1"
                                style={{ backgroundColor: "var(--button-bg)" }}
                            >
                                <Dumbbell size={18} style={{ color: "var(--text-secondary)" }} />
                            </div>
                            <p className="text-[13px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                                Kein Training geplant
                            </p>
                            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                                Plane Trainings im Kalender oder starte unten ein freies Workout
                            </p>
                        </div>
                    )}
                </section>

                {/* ── SCHNELLSTART — 3 gleichwertige Sport-Buttons ── */}
                <section className="space-y-2.5">
                    <h2
                        className="text-[11px] font-bold uppercase tracking-wider pl-1"
                        style={{ color: "var(--text-secondary)" }}
                    >
                        Schnellstart
                    </h2>

                    <div className="grid grid-cols-3 gap-2.5">
                        {/* Gym */}
                        <button
                            onClick={() => handleFreeTraining("gym")}
                            disabled={hasActiveWorkout}
                            className="rounded-2xl p-4 border flex flex-col items-center gap-3 active:scale-[0.96] transition-transform disabled:opacity-50"
                            style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}
                        >
                            <div
                                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                                style={{ backgroundColor: "rgba(0,122,255,0.1)", color: "#007AFF" }}
                            >
                                <Dumbbell size={26} />
                            </div>
                            <div className="text-center">
                                <p className="text-[13px] font-bold" style={{ color: "var(--text-color)" }}>Gym</p>
                                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-secondary)" }}>Krafttraining</p>
                            </div>
                        </button>

                        {/* Laufen */}
                        <button
                            onClick={() => handleFreeTraining("laufen")}
                            disabled={hasActiveWorkout}
                            className="rounded-2xl p-4 border flex flex-col items-center gap-3 active:scale-[0.96] transition-transform disabled:opacity-50"
                            style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}
                        >
                            <div
                                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                                style={{ backgroundColor: "rgba(52,199,89,0.1)", color: "#34C759" }}
                            >
                                <Footprints size={26} />
                            </div>
                            <div className="text-center">
                                <p className="text-[13px] font-bold" style={{ color: "var(--text-color)" }}>Laufen</p>
                                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-secondary)" }}>GPS-Tracking</p>
                            </div>
                        </button>

                        {/* Radfahren */}
                        <button
                            onClick={() => handleFreeTraining("radfahren")}
                            disabled={hasActiveWorkout}
                            className="rounded-2xl p-4 border flex flex-col items-center gap-3 active:scale-[0.96] transition-transform disabled:opacity-50"
                            style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}
                        >
                            <div
                                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                                style={{ backgroundColor: "rgba(255,149,0,0.1)", color: "#FF9500" }}
                            >
                                <Bike size={26} />
                            </div>
                            <div className="text-center">
                                <p className="text-[13px] font-bold" style={{ color: "var(--text-color)" }}>Radfahren</p>
                                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-secondary)" }}>GPS-Tracking</p>
                            </div>
                        </button>
                    </div>
                </section>

                {/* ── VORLAGEN ── */}
                {(templates.length > 0 || true) && (
                    <section className="space-y-2.5">
                        <h2
                            className="text-[11px] font-bold uppercase tracking-wider pl-1"
                            style={{ color: "var(--text-secondary)" }}
                        >
                            Meine Vorlagen
                        </h2>

                        {/* User-created templates */}
                        {templates.map((tpl) => {
                            const sc = sportColor(tpl.sportType);
                            const exCount = tpl.exercises?.length ?? 0;
                            return (
                                <div
                                    key={tpl.id}
                                    className="rounded-2xl border flex items-center overflow-hidden"
                                    style={{
                                        backgroundColor: "var(--card-bg)",
                                        borderColor: "var(--border-color)",
                                    }}
                                >
                                    <button
                                        onClick={() => handleStartTemplate(tpl)}
                                        disabled={hasActiveWorkout}
                                        className="flex-1 flex items-center gap-4 p-4 text-left disabled:opacity-50 min-w-0 active:scale-[0.98] transition-transform"
                                    >
                                        <div
                                            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                                            style={{ backgroundColor: sc.bg, color: sc.color }}
                                        >
                                            {sportIcon(tpl.sportType)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-[15px] font-bold truncate" style={{ color: "var(--text-color)" }}>
                                                {tpl.title}
                                            </h3>
                                            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                                                {formatSportLabel(tpl.sportType)}{exCount > 0 ? ` · ${exCount} Übungen` : ""}
                                            </p>
                                        </div>
                                        <ChevronRight size={18} style={{ color: "var(--text-secondary)" }} className="shrink-0" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteTemplate(tpl.id)}
                                        className="px-4 self-stretch flex items-center justify-center border-l"
                                        style={{ borderColor: "var(--border-color)" }}
                                    >
                                        <Trash2 size={14} style={{ color: "var(--danger, #FF3B30)" }} />
                                    </button>
                                </div>
                            );
                        })}

                        {/* Create template button */}
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="w-full rounded-2xl border-2 border-dashed py-3.5 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                            style={{ borderColor: "var(--border-color)" }}
                        >
                            <Plus size={16} style={{ color: "var(--text-secondary)" }} />
                            <span className="text-[13px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                                Vorlage erstellen
                            </span>
                        </button>
                    </section>
                )}
            </div>

            <CreateTemplateModal
                open={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSave={handleCreateTemplate}
            />
        </div>
    );
}
