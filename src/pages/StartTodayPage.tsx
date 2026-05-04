import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
    Dumbbell, Footprints, Bike, Star, AlertTriangle,
    ChevronRight, Plus, Play, Trash2, X, MapPin, Sparkles
} from "lucide-react";
import { BottomSheet } from "../components/common/BottomSheet";
import { useModalStore } from "../store/useModalStore";
import type { CalendarEvent, TrainingType } from "../types/training";
import { useTodaysSessions } from "../hooks/useTodaysSessions";
import { useI18n } from "../i18n/useI18n";
import { startSession, startFreeTraining, startTrainingTemplate } from "../utils/startSession";
import { useLiveTrainingStore } from "../store/useLiveTrainingStore";
import { PageHeader } from "../components/ui/PageHeader";
import { AppButton } from "../components/ui/AppButton";
import { track } from "../analytics/track";
import { hapticButton, hapticSelect, hapticDestructive, hapticMedium } from "../native/haptics";
import { getActiveUserId } from "../utils/session";
import {
    getTemplates,
    saveTemplate,
    deleteTemplate,
    type TrainingTemplateLite,
    type TemplateExercise,
    type TemplateSet,
} from "../utils/trainingTemplatesStore";
import ExerciseLibraryModal from "../components/training/ExerciseLibraryModal";
import type { Exercise } from "../data/exerciseLibrary";
import { EXERCISES } from "../data/exerciseLibrary";
import { resolveExerciseImageSrc } from "../utils/exerciseImage";

const LOGO_FALLBACK = "/logo-dark.png";

function TemplateExerciseThumb({ exerciseId, name }: { exerciseId?: string; name: string }) {
    const src = React.useMemo(() => {
        const lib = EXERCISES.find(e => e.id === exerciseId) || EXERCISES.find(e => e.name === name || e.nameDe === name || e.nameEn === name);
        return lib ? resolveExerciseImageSrc(lib) : null;
    }, [exerciseId, name]);

    return (
        <img
            src={src || LOGO_FALLBACK}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = LOGO_FALLBACK; }}
        />
    );
}

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

function sportColor(_type: TrainingType): { color: string; bg: string } {
    return { color: "#007AFF", bg: "rgba(0,122,255,0.1)" };
}

// ---- Helper: default sets for a new exercise ----
function makeDefaultSets(count = 3): TemplateSet[] {
    return Array.from({ length: count }, () => ({ reps: undefined, weight: undefined }));
}

// Sport options for template modal
const TEMPLATE_SPORTS: { id: TrainingType; label: string; icon: React.ReactNode; color: string; bg: string }[] = [
    { id: "gym",      label: "Gym",      icon: <Dumbbell size={20} />,   color: "#007AFF", bg: "rgba(0,122,255,0.12)" },
    { id: "laufen",   label: "Laufen",   icon: <Footprints size={20} />, color: "#007AFF", bg: "rgba(0,122,255,0.12)" },
    { id: "radfahren",label: "Rad",      icon: <Bike size={20} />,       color: "#007AFF", bg: "rgba(0,122,255,0.12)" },
    { id: "custom",   label: "Custom",   icon: <Sparkles size={20} />,   color: "#007AFF", bg: "rgba(0,122,255,0.12)" },
];

// ---- Create Template Modal (BottomSheet editor) ----
function CreateTemplateModal({ open, onClose, onSave }: {
    open: boolean;
    onClose: () => void;
    onSave: (t: { title: string; sportType: TrainingType; exercises?: TemplateExercise[] }) => void;
}) {
    const { t } = useI18n();
    const [title, setTitle] = useState("");
    const [sport, setSport] = useState<TrainingType>("gym");
    const [exercises, setExercises] = useState<TemplateExercise[]>([]);
    const [showLibrary, setShowLibrary] = useState(false);
    const [cardioDuration, setCardioDuration] = useState<number | "">("");
    const [cardioDistance, setCardioDistance] = useState<number | "">("");
    const [customNameInput, setCustomNameInput] = useState("");
    const [showCustomInput, setShowCustomInput] = useState(false);

    // Reset form when sheet opens
    useEffect(() => {
        if (open) {
            setTitle("");
            setSport("gym");
            setExercises([]);
            setCardioDuration("");
            setCardioDistance("");
            setCustomNameInput("");
            setShowCustomInput(false);
        }
    }, [open]);

    const handleSportChange = (newSport: TrainingType) => {
        hapticSelect();
        setSport(newSport);
        setExercises([]);
        setCardioDuration("");
        setCardioDistance("");
        setCustomNameInput("");
        setShowCustomInput(false);
    };

    const isCardio = sport === "laufen" || sport === "radfahren";
    const activeSport = TEMPLATE_SPORTS.find((s) => s.id === sport)!;

    const handleSave = () => {
        if (!title.trim()) return;
        hapticMedium();
        let finalExercises: TemplateExercise[] | undefined;
        if (sport === "gym" || sport === "custom") {
            finalExercises = exercises.length > 0 ? exercises : undefined;
        } else if (isCardio) {
            const cardioType = cardioDuration as any as string;
            const cardioName = cardioType === "intervals" ? "Intervalle"
                : cardioType === "recovery" ? (sport === "laufen" ? "Regenerationslauf" : "Regenerationsfahrt")
                : (sport === "laufen" ? "Langer Lauf" : "Lange Radfahrt");
            finalExercises = [{ name: cardioName, sets: [{}] }];
        }
        onSave({ title: title.trim(), sportType: sport, exercises: finalExercises });
    };

    const handlePickExercise = (exercise: Exercise) => {
        hapticButton();
        setExercises((prev) => [...prev, { exerciseId: exercise.id, name: exercise.name, sets: makeDefaultSets() }]);
        // Library stays open — user can pick multiple exercises
    };

    const handleAddCustomExercise = () => {
        const name = customNameInput.trim();
        if (!name) return;
        setExercises((prev) => [...prev, { name, sets: makeDefaultSets() }]);
        setCustomNameInput("");
        setShowCustomInput(false);
    };

    const handleRemoveExercise = (idx: number) => {
        hapticDestructive();
        setExercises((prev) => prev.filter((_, i) => i !== idx));
    };

    const handleAddSet = (exIdx: number) => {
        hapticButton();
        setExercises((prev) =>
            prev.map((ex, i) => i === exIdx ? { ...ex, sets: [...(ex.sets ?? []), { reps: undefined, weight: undefined }] } : ex)
        );
    };

    const handleSetTypeCycle = (exIdx: number, setIdx: number) => {
        hapticSelect();
        const order: Array<"n" | "w" | "f" | "d"> = ["n", "w", "f", "d"];
        setExercises((prev) =>
            prev.map((ex, i) => {
                if (i !== exIdx) return ex;
                const sets = (ex.sets ?? []).map((s, si) => {
                    if (si !== setIdx) return s;
                    const current = s.type || "n";
                    const idx = order.indexOf(current as any);
                    const next = order[(idx + 1) % order.length];
                    // Init drops when switching to dropset
                    if (next === "d" && !s.drops?.length) {
                        return { ...s, type: next, drops: [] };
                    }
                    // Clear drops when switching away from dropset
                    if (next !== "d") {
                        return { ...s, type: next, drops: undefined };
                    }
                    return { ...s, type: next };
                });
                return { ...ex, sets };
            })
        );
    };

    const handleAddDrop = (exIdx: number, setIdx: number) => {
        hapticButton();
        setExercises((prev) =>
            prev.map((ex, i) => {
                if (i !== exIdx) return ex;
                const sets = (ex.sets ?? []).map((s, si) => {
                    if (si !== setIdx) return s;
                    return { ...s, drops: [...(s.drops ?? []), { reps: undefined, weight: undefined }] };
                });
                return { ...ex, sets };
            })
        );
    };

    const handleRemoveDrop = (exIdx: number, setIdx: number, dropIdx: number) => {
        hapticDestructive();
        setExercises((prev) =>
            prev.map((ex, i) => {
                if (i !== exIdx) return ex;
                const sets = (ex.sets ?? []).map((s, si) => {
                    if (si !== setIdx) return s;
                    return { ...s, drops: (s.drops ?? []).filter((_, di) => di !== dropIdx) };
                });
                return { ...ex, sets };
            })
        );
    };

    const handleDropChange = (exIdx: number, setIdx: number, dropIdx: number, field: "reps" | "weight", value: string) => {
        const num = value === "" ? 0 : parseFloat(value);
        if (isNaN(num)) return;
        setExercises((prev) =>
            prev.map((ex, i) => {
                if (i !== exIdx) return ex;
                const sets = (ex.sets ?? []).map((s, si) => {
                    if (si !== setIdx) return s;
                    const drops = (s.drops ?? []).map((d, di) => {
                        if (di !== dropIdx) return d;
                        return { ...d, [field]: num };
                    });
                    return { ...s, drops };
                });
                return { ...ex, sets };
            })
        );
    };

    const handleRemoveSet = (exIdx: number, setIdx: number) => {
        hapticDestructive();
        setExercises((prev) =>
            prev.map((ex, i) => i === exIdx ? { ...ex, sets: (ex.sets ?? []).filter((_, si) => si !== setIdx) } : ex)
        );
    };

    const handleSetChange = (exIdx: number, setIdx: number, field: "reps" | "weight", value: string) => {
        const num = value === "" ? 0 : parseFloat(value);
        if (isNaN(num)) return;
        setExercises((prev) =>
            prev.map((ex, i) =>
                i === exIdx ? { ...ex, sets: (ex.sets ?? []).map((s, si) => si === setIdx ? { ...s, [field]: num } : s) } : ex
            )
        );
    };

    const existingIds = exercises.map((e) => e.exerciseId).filter(Boolean) as string[];

    return (
        <>
            <BottomSheet
                open={open}
                onClose={onClose}
                height="88dvh"
                footer={
                    <div className="px-4 pt-3 pb-2">
                        <button
                            onClick={handleSave}
                            disabled={!title.trim()}
                            className="w-full py-3.5 rounded-2xl font-bold text-[15px] text-white active:scale-[0.97] transition-all disabled:opacity-40"
                            style={{ backgroundColor: activeSport.color, boxShadow: `0 4px 16px ${activeSport.color}55` }}
                        >
                            {t("startToday.saveTemplate")}
                        </button>
                    </div>
                }
            >
                <div className="px-5 pt-2 pb-6 space-y-5">
                    {/* Header */}
                    <div>
                        <h2 className="text-[28px] font-black tracking-tight" style={{ color: "var(--text-color)", letterSpacing: "-0.5px" }}>
                            {t("startToday.createTemplate")}
                        </h2>
                        <p className="text-[14px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
                            {t("startToday.saveYourFavorite")}
                        </p>
                    </div>

                    {/* Sport Selection */}
                    <div className="grid grid-cols-4 gap-2">
                        {TEMPLATE_SPORTS.map((s) => (
                            <button
                                key={s.id}
                                onClick={() => handleSportChange(s.id)}
                                className="flex flex-col items-center justify-center gap-2 py-3.5 rounded-2xl transition-all active:scale-[0.95]"
                                style={{
                                    backgroundColor: sport === s.id ? s.bg : "var(--button-bg)",
                                    border: `1.5px solid ${sport === s.id ? s.color : "var(--border-color)"}`,
                                    color: sport === s.id ? s.color : "var(--text-secondary)",
                                }}
                            >
                                {s.icon}
                                <span className="text-[11px] font-bold">{s.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Title */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider ml-1" style={{ color: "var(--text-secondary)" }}>{t("startToday.label")}</label>
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full rounded-2xl px-4 py-3.5 font-medium focus:outline-none border text-[15px]"
                            style={{ backgroundColor: "var(--button-bg)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
                            placeholder="z.B. Push Day, Oberkörper..."
                        />
                    </div>

                    {/* Gym / Custom exercises */}
                    {(sport === "gym" || sport === "custom") && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between ml-1">
                                <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                                    Übungen ({exercises.length})
                                </label>
                                {sport === "gym" && (
                                    <button
                                        onClick={() => setShowLibrary(true)}
                                        className="flex items-center gap-1 text-[13px] font-bold"
                                        style={{ color: activeSport.color }}
                                    >
                                        <Plus size={14} /> Bibliothek
                                    </button>
                                )}
                            </div>

                            {exercises.map((ex, exIdx) => (
                                <div
                                    key={exIdx}
                                    className="rounded-2xl overflow-hidden"
                                    style={{ backgroundColor: "var(--card-bg)" }}
                                >
                                    {/* Exercise Header — like live training */}
                                    <div className="flex items-center gap-3 px-4 pt-3 pb-1">
                                        <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center overflow-hidden" style={{ backgroundColor: "var(--input-bg)" }}>
                                            <TemplateExerciseThumb exerciseId={ex.exerciseId} name={ex.name} />
                                        </div>
                                        <span className="text-[15px] font-bold truncate flex-1" style={{ color: "var(--text-color)" }}>{ex.name}</span>
                                        <button
                                            onClick={() => handleRemoveExercise(exIdx)}
                                            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                                            style={{ backgroundColor: "var(--button-bg)" }}
                                        >
                                            <Trash2 size={14} style={{ color: "var(--text-muted)" }} />
                                        </button>
                                    </div>

                                    {/* Column Headers */}
                                    <div className="grid grid-cols-[40px_1fr_1fr_40px] gap-2 px-4 py-1">
                                        <span className="text-[10px] font-semibold text-center" style={{ color: "var(--text-muted)" }}>#</span>
                                        <span className="text-[10px] font-semibold text-center" style={{ color: "var(--text-muted)" }}>KG</span>
                                        <span className="text-[10px] font-semibold text-center" style={{ color: "var(--text-muted)" }}>WDH.</span>
                                        <span />
                                    </div>

                                    {/* Sets — identical to live training */}
                                    {(ex.sets ?? []).map((s, sIdx) => {
                                        const sType = s.type || "n";
                                        const typeLabel = sType === "w" ? "W" : sType === "f" ? "F" : sType === "d" ? "D" : String(sIdx + 1);
                                        const typeColor = sType === "w" ? "#EAB308" : sType === "f" ? "#FF3B30" : sType === "d" ? "#007AFF" : "var(--text-color)";
                                        return (
                                        <React.Fragment key={sIdx}>
                                        <div className="grid grid-cols-[40px_1fr_1fr_40px] gap-2 items-center px-4 py-0.5">
                                            <button
                                                type="button"
                                                onClick={() => handleSetTypeCycle(exIdx, sIdx)}
                                                className="text-sm font-bold text-center h-9 flex items-center justify-center cursor-pointer active:scale-90 transition-transform"
                                                style={{ color: typeColor }}
                                            >
                                                {typeLabel}
                                            </button>
                                            <input
                                                type="number"
                                                inputMode="decimal"
                                                step={0.5}
                                                value={s.weight || ""}
                                                placeholder="-"
                                                onChange={(e) => handleSetChange(exIdx, sIdx, "weight", e.target.value)}
                                                className="h-9 w-full rounded-3xl text-center text-base font-bold outline-none placeholder-zinc-400"
                                                style={{ backgroundColor: "var(--input-bg)", color: "var(--text-color)" }}
                                            />
                                            <input
                                                type="number"
                                                inputMode="numeric"
                                                value={s.reps || ""}
                                                placeholder="-"
                                                onChange={(e) => handleSetChange(exIdx, sIdx, "reps", e.target.value)}
                                                className="h-9 w-full rounded-3xl text-center text-base font-bold outline-none placeholder-zinc-400"
                                                style={{ backgroundColor: "var(--input-bg)", color: "var(--text-color)" }}
                                            />
                                            <button
                                                onClick={() => handleRemoveSet(exIdx, sIdx)}
                                                className="w-8 h-8 rounded-full flex items-center justify-center"
                                                style={{ backgroundColor: "var(--button-bg)" }}
                                            >
                                                <X size={12} style={{ color: "var(--text-muted)" }} />
                                            </button>
                                        </div>

                                        {/* Dropset rows */}
                                        {sType === "d" && (
                                            <>
                                                {(s.drops ?? []).map((drop, dIdx) => (
                                                    <div key={`drop-${sIdx}-${dIdx}`} className="grid grid-cols-[40px_1fr_1fr_40px] gap-2 items-center px-4 py-0.5">
                                                        <span className="text-xs font-bold text-center" style={{ color: "var(--text-muted)" }}>D{dIdx + 1}</span>
                                                        <input
                                                            type="number" inputMode="decimal" step={0.5}
                                                            value={drop.weight || ""} placeholder="-"
                                                            onChange={(e) => handleDropChange(exIdx, sIdx, dIdx, "weight", e.target.value)}
                                                            className="h-9 w-full rounded-3xl text-center text-base font-bold outline-none placeholder-zinc-400"
                                                            style={{ backgroundColor: "var(--input-bg)", color: "var(--text-color)" }}
                                                        />
                                                        <input
                                                            type="number" inputMode="numeric"
                                                            value={drop.reps || ""} placeholder="-"
                                                            onChange={(e) => handleDropChange(exIdx, sIdx, dIdx, "reps", e.target.value)}
                                                            className="h-9 w-full rounded-3xl text-center text-base font-bold outline-none placeholder-zinc-400"
                                                            style={{ backgroundColor: "var(--input-bg)", color: "var(--text-color)" }}
                                                        />
                                                        <button
                                                            onClick={() => handleRemoveDrop(exIdx, sIdx, dIdx)}
                                                            className="w-8 h-8 rounded-full flex items-center justify-center"
                                                            style={{ backgroundColor: "var(--button-bg)" }}
                                                        >
                                                            <X size={12} style={{ color: "var(--text-muted)" }} />
                                                        </button>
                                                    </div>
                                                ))}
                                                <div className="flex justify-center py-1.5">
                                                    <button
                                                        onClick={() => handleAddDrop(exIdx, sIdx)}
                                                        className="flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold"
                                                        style={{ backgroundColor: "var(--button-bg)", color: "var(--text-muted)" }}
                                                    >
                                                        <Plus size={12} /> DROP
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                        </React.Fragment>
                                        );
                                    })}

                                    {/* Add Set — like live training + button */}
                                    <div className="px-4 py-2">
                                        <button
                                            onClick={() => handleAddSet(exIdx)}
                                            className="w-full py-2 rounded-xl flex items-center justify-center gap-1.5 text-[13px] font-semibold transition-colors active:scale-[0.97]"
                                            style={{ backgroundColor: "var(--button-bg)", color: "var(--text-color)" }}
                                        >
                                            <Plus size={15} />
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {/* Custom: inline name input */}
                            {sport === "custom" && showCustomInput ? (
                                <div className="rounded-2xl border p-4 flex items-center gap-2" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}>
                                    <input
                                        type="text" autoFocus value={customNameInput}
                                        onChange={(e) => setCustomNameInput(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === "Enter") handleAddCustomExercise(); }}
                                        placeholder="Übungsname..."
                                        className="flex-1 px-3 py-2 rounded-lg border text-sm"
                                        style={{ backgroundColor: "var(--input-bg)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
                                    />
                                    <button onClick={handleAddCustomExercise} disabled={!customNameInput.trim()} className="px-3 py-2 rounded-lg text-sm font-bold disabled:opacity-40" style={{ color: activeSport.color }}>OK</button>
                                    <button onClick={() => { setShowCustomInput(false); setCustomNameInput(""); }} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--button-bg)" }}>
                                        <X size={12} style={{ color: "var(--text-secondary)" }} />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={sport === "gym" ? () => setShowLibrary(true) : () => setShowCustomInput(true)}
                                    className="w-full py-8 border-2 border-dashed rounded-3xl flex flex-col items-center gap-2 transition-all active:scale-[0.98]"
                                    style={{ borderColor: "var(--border-color)", backgroundColor: "var(--button-bg)" }}
                                >
                                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: activeSport.bg, color: activeSport.color }}>
                                        {activeSport.icon}
                                    </div>
                                    <span className="text-[13px] font-semibold" style={{ color: "var(--text-secondary)" }}>{t("startToday.addExercises")}</span>
                                </button>
                            )}
                        </div>
                    )}

                    {/* Cardio type selection */}
                    {isCardio && (
                        <div className="space-y-3">
                            <label className="text-[13px] font-bold uppercase tracking-wider ml-1" style={{ color: "var(--text-muted)" }}>
                                {t("startToday.cardioType" as any)}
                            </label>
                            <div className="space-y-2">
                                {[
                                    {
                                        key: "long",
                                        title: sport === "laufen" ? "Langer Lauf" : "Lange Radfahrt",
                                        desc: "Gleichmäßiges Tempo, Ausdauer aufbauen",
                                        icon: <MapPin size={20} />,
                                    },
                                    {
                                        key: "intervals",
                                        title: "Intervalle",
                                        desc: "Wechsel zwischen schnell und langsam",
                                        icon: <Sparkles size={20} />,
                                    },
                                    {
                                        key: "recovery",
                                        title: sport === "laufen" ? "Regenerationslauf" : "Regenerationsfahrt",
                                        desc: "Lockeres Tempo, aktive Erholung",
                                        icon: <Play size={20} />,
                                    },
                                ].map((option) => {
                                    const isSelected = (cardioDuration as any) === option.key;
                                    return (
                                        <button
                                            key={option.key}
                                            onClick={() => setCardioDuration(option.key as any)}
                                            className="w-full rounded-2xl p-4 flex items-center gap-4 text-left active:scale-[0.98] transition-transform"
                                            style={{
                                                backgroundColor: isSelected ? "rgba(0,122,255,0.1)" : "var(--card-bg)",
                                                border: isSelected ? "1.5px solid #007AFF" : "1px solid var(--border-color)",
                                            }}
                                        >
                                            <div
                                                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                                                style={{
                                                    backgroundColor: isSelected ? "rgba(0,122,255,0.15)" : "var(--button-bg)",
                                                    color: isSelected ? "#007AFF" : "var(--text-muted)",
                                                }}
                                            >
                                                {option.icon}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[15px] font-bold" style={{ color: isSelected ? "#007AFF" : "var(--text-color)" }}>
                                                    {option.title}
                                                </div>
                                                <div className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                                                    {option.desc}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </BottomSheet>

            <ExerciseLibraryModal
                open={showLibrary}
                category="gym"
                onClose={() => setShowLibrary(false)}
                existingExerciseIds={existingIds}
                onPick={handlePickExercise}
            />
        </>
    );
}

// ---- Confirmation Sheet ----
function ConfirmStartSheet({ label: pendingLabel, onConfirm, onCancel }: {
    label: string;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    const { t } = useI18n();
    return (
        <BottomSheet
            open
            onClose={onCancel}
            height="auto"
            showHandle
            header={
                <div className="text-center space-y-1 px-6">
                    <p className="text-[15px] font-bold" style={{ color: "var(--text-color)" }}>{t("startToday.startTraining")}</p>
                    <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>{pendingLabel}</p>
                </div>
            }
            contentClassName="px-6 pb-6 pt-2 space-y-3"
        >
            <button
                onPointerDown={() => { hapticMedium(); onConfirm(); }}
                className="w-full py-4 rounded-2xl text-[17px] font-bold text-white active:scale-[0.97] transition-transform"
                style={{ backgroundColor: "#007AFF" }}
            >
                {t("startToday.start")}
            </button>
            <button
                onPointerDown={() => { hapticButton(); onCancel(); }}
                className="w-full py-3 rounded-2xl text-[15px] font-semibold active:scale-[0.97] transition-transform"
                style={{ color: "var(--text-secondary)", backgroundColor: "var(--button-bg)" }}
            >
                {t("common.cancel")}
            </button>
        </BottomSheet>
    );
}

// ---- Main Page ----
export default function StartTodayPage({ events, onPlanTraining }: StartTodayPageProps) {
    const { t, formatDate } = useI18n();
    const { sessions, status, primarySession } = useTodaysSessions(events);
    const activeWorkout = useLiveTrainingStore((s) => s.activeWorkout);
    const hasActiveWorkout = !!activeWorkout?.isActive;
    const [templates, setTemplates] = useState<TrainingTemplateLite[]>(() => getTemplates());
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [confirmPending, setConfirmPending] = useState<{ label: string; onConfirm: () => void } | null>(null);

    const refreshTemplates = useCallback(() => {
        setTemplates(getTemplates());
    }, []);

    // Listen for templates saved from LiveTrainingPage
    useEffect(() => {
        const handler = () => setTemplates(getTemplates());
        window.addEventListener("trainq:template-saved", handler);
        return () => window.removeEventListener("trainq:template-saved", handler);
    }, []);

    const askConfirm = useCallback((label: string, action: () => void) => {
        setConfirmPending({ label, onConfirm: action });
    }, []);

    const handleFreeTraining = (sport: TrainingType = "gym") => {
        if (hasActiveWorkout) return;
        hapticButton();
        const label = sport === "laufen" ? "Laufen · Cardio" : sport === "radfahren" ? "Radfahren · Cardio" : "Gym · Krafttraining";
        askConfirm(label, () => startFreeTraining(sport));
    };

    const handleStartTemplate = (tpl: TrainingTemplateLite) => {
        if (hasActiveWorkout) return;
        hapticButton();
        askConfirm(tpl.title, () => startTrainingTemplate(tpl));
    };

    const handleDeleteTemplate = (id: string) => {
        hapticDestructive();
        deleteTemplate(id);
        refreshTemplates();
    };

    const handleCreateTemplate = (input: { title: string; sportType: TrainingType; exercises?: TemplateExercise[] }) => {
        saveTemplate(input);
        refreshTemplates();
        setShowCreateModal(false);
    };

    const todaySessions = status === "single" && primarySession ? [primarySession] : sessions;
    const hasSessions = status !== "none" && todaySessions.length > 0;

    return (
        <div className="w-full h-full pt-safe">
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
                            {t("startToday.activeWorkoutWarning")}
                        </p>
                    </div>
                )}

                {/* ── HEUTE GEPLANT ── */}
                <section className="space-y-2.5">
                    <h2
                        className="text-[13px] font-bold uppercase tracking-wider pl-1"
                        style={{ color: "var(--text-muted)" }}
                    >
                        {t("today.section.planned")}
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
                                {t("today.empty.title")}
                            </p>
                            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                                {t("today.empty.subtitle")}
                            </p>
                        </div>
                    )}
                </section>

                {/* ── SCHNELLSTART — 3 gleichwertige Sport-Buttons ── */}
                <section className="space-y-2.5">
                    <h2
                        className="text-[13px] font-bold uppercase tracking-wider pl-1"
                        style={{ color: "var(--text-muted)" }}
                    >
                        {t("startToday.quickStart")}
                    </h2>

                    <div className="grid grid-cols-3 gap-3">
                        {/* Gym */}
                        <button
                            onClick={() => handleFreeTraining("gym")}
                            disabled={hasActiveWorkout}
                            className="rounded-[20px] p-5 border flex flex-col items-center gap-3 active:scale-[0.96] transition-transform disabled:opacity-50"
                            style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}
                        >
                            <div
                                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                                style={{ backgroundColor: "rgba(0,122,255,0.1)", color: "#007AFF" }}
                            >
                                <Dumbbell size={26} />
                            </div>
                            <div className="text-center">
                                <p className="text-[13px] font-bold" style={{ color: "var(--text-color)" }}>{t("training.mode.gym")}</p>
                                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{t("startToday.strength")}</p>
                            </div>
                        </button>

                        {/* Laufen */}
                        <button
                            onClick={() => handleFreeTraining("laufen")}
                            disabled={hasActiveWorkout}
                            className="rounded-[20px] p-5 border flex flex-col items-center gap-3 active:scale-[0.96] transition-transform disabled:opacity-50"
                            style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}
                        >
                            <div
                                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                                style={{ backgroundColor: "rgba(0,122,255,0.1)", color: "#007AFF" }}
                            >
                                <Footprints size={26} />
                            </div>
                            <div className="text-center">
                                <p className="text-[13px] font-bold" style={{ color: "var(--text-color)" }}>{t("training.mode.running")}</p>
                                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>GPS-Tracking</p>
                            </div>
                        </button>

                        {/* Radfahren */}
                        <button
                            onClick={() => handleFreeTraining("radfahren")}
                            disabled={hasActiveWorkout}
                            className="rounded-[20px] p-5 border flex flex-col items-center gap-3 active:scale-[0.96] transition-transform disabled:opacity-50"
                            style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}
                        >
                            <div
                                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                                style={{ backgroundColor: "rgba(0,122,255,0.1)", color: "#007AFF" }}
                            >
                                <Bike size={26} />
                            </div>
                            <div className="text-center">
                                <p className="text-[13px] font-bold" style={{ color: "var(--text-color)" }}>{t("training.mode.cycling")}</p>
                                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>GPS-Tracking</p>
                            </div>
                        </button>
                    </div>
                </section>

                {/* ── VORLAGEN ── */}
                <section className="space-y-2.5">
                    <h2
                        className="text-[13px] font-bold uppercase tracking-wider pl-1"
                        style={{ color: "var(--text-muted)" }}
                    >
                        {t("startToday.myTemplates")}
                    </h2>

                    {/* Empty state */}

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
                            onClick={() => {
                                setShowCreateModal(true);
                            }}
                            className="w-full rounded-2xl border-2 border-dashed py-3.5 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                            style={{ borderColor: "var(--border-color)" }}
                        >
                            <Plus size={16} style={{ color: "var(--text-secondary)" }} />
                            <span className="text-[13px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                                {t("startToday.createTemplate")}
                            </span>
                        </button>
                    </section>
            </div>

            <CreateTemplateModal
                open={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSave={handleCreateTemplate}
            />

            {confirmPending && (
                <ConfirmStartSheet
                    label={confirmPending.label}
                    onConfirm={() => {
                        const fn = confirmPending.onConfirm;
                        setConfirmPending(null);
                        fn();
                    }}
                    onCancel={() => setConfirmPending(null)}
                />
            )}
        </div>
    );
}
