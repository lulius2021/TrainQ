import React, { useState, useEffect, useMemo } from "react";
import { AppButton } from "../ui/AppButton";
import { EVENT_CATEGORIES } from "../../constants/events";
// import { getTemplates } from "../../utils/trainingTemplatesStore"; // Unused
import ExerciseLibraryModal from "../training/ExerciseLibraryModal";
import type { NewCalendarEvent, LiveExercise } from "../../types/training";
import type { Exercise } from "../../data/exerciseLibrary";
import { Dumbbell, Footprints, Bike, Star } from "lucide-react";
import { useI18n } from "../../i18n/useI18n";

interface AddEventModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialDate?: string; // YYYY-MM-DD
    mode: 'appointment' | 'training';
    onSave: (eventData: NewCalendarEvent) => void;
}

const simpleId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const normalizeTitle = (t: unknown): string => String(t ?? "").trim();

type TrainingCategory = 'gym' | 'running' | 'cycling' | 'custom';

// Configuration for Sport Categories
const SPORT_CATEGORIES = [
    { id: 'gym', labelKey: 'addEvent.sport.gym', icon: Dumbbell, color: 'bg-blue-600', border: 'border-blue-500' },
    { id: 'running', labelKey: 'addEvent.sport.running', icon: Footprints, color: 'bg-emerald-600', border: 'border-emerald-500' },
    { id: 'cycling', labelKey: 'addEvent.sport.cycling', icon: Bike, color: 'bg-violet-600', border: 'border-violet-500' },
    { id: 'custom', labelKey: 'addEvent.sport.custom', icon: Star, color: 'bg-orange-600', border: 'border-orange-500' },
] as const;

export const AddEventModal: React.FC<AddEventModalProps> = ({
    isOpen,
    onClose,
    initialDate,
    mode,
    onSave,
}) => {
    const { t } = useI18n();
    // --- State ---
    const [title, setTitle] = useState("");
    const [date, setDate] = useState(initialDate || new Date().toISOString().split("T")[0]);
    const [startTime, setStartTime] = useState("18:00");
    const [endTime, setEndTime] = useState("19:00");
    const [isAllDay, setIsAllDay] = useState(false);
    const [category, setCategory] = useState("other");
    const [description, setDescription] = useState("");

    // Training-specific
    const [trainingCategory, setTrainingCategory] = useState<TrainingCategory>('gym');
    const [builtExercises, setBuiltExercises] = useState<LiveExercise[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [isExerciseLibraryOpen, setIsExerciseLibraryOpen] = useState(false);

    // --- Effects ---
    useEffect(() => {
        if (isOpen) {
            if (initialDate) setDate(initialDate);

            // Reset fields
            setTitle("");
            setStartTime("18:00");
            setEndTime("19:00");
            setIsAllDay(false);
            setDescription("");

            // Mode-specific defaults
            if (mode === 'appointment') {
                setCategory("other");
            } else {
                setCategory("training"); // default
                setTrainingCategory("gym");
                setBuiltExercises([]);
                setSelectedTemplateId(null);
            }
        }
    }, [isOpen, initialDate, mode]);

    // Force Scroll Lock (Direct Implementation)
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            // Also try to lock touch move on iOS if needed, but simple overflow hidden is usually enough for modern sticky/fixed
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // --- Handlers ---

    // Switch training category and clear exercises if changed to strictly separate
    const handleSetTrainingCategory = (newCat: TrainingCategory) => {
        if (newCat !== trainingCategory) {
            setTrainingCategory(newCat);
            setBuiltExercises([]); // Strict separation: Clear exercises when switching sport type
        }
    };

    const handleAddFromLibrary = (ex: Exercise) => {
        const newEx: LiveExercise = {
            id: simpleId(),
            exerciseId: ex.id,
            name: ex.name,
            sets: [
                { id: simpleId(), completed: false, reps: 10, weight: 0, setType: "normal" },
                { id: simpleId(), completed: false, reps: 10, weight: 0, setType: "normal" },
                { id: simpleId(), completed: false, reps: 10, weight: 0, setType: "normal" }
            ]
        };
        setBuiltExercises(prev => [...prev, newEx]);
    };

    const handleRemoveExercise = (index: number) => {
        setBuiltExercises(prev => prev.filter((_, i) => i !== index));
    };

    const handleUpdateSets = (index: number, setsCount: number, repsCount: number) => {
        setBuiltExercises(prev => {
            const next = [...prev];
            const ex = { ...next[index] };
            let currentSets = [...(ex.sets || [])];

            // Clamp values
            const targetSets = Math.max(1, Math.min(10, setsCount));
            const targetReps = Math.max(1, Math.min(100, repsCount));

            // Adjust sets count
            if (targetSets > currentSets.length) {
                const toAdd = targetSets - currentSets.length;
                for (let i = 0; i < toAdd; i++) {
                    currentSets.push({ id: simpleId(), completed: false, reps: targetReps, weight: 0, setType: "normal" });
                }
            } else if (targetSets < currentSets.length) {
                currentSets = currentSets.slice(0, targetSets);
            }

            // Sync reps if changed
            if (currentSets.some(s => s.reps !== targetReps)) {
                currentSets = currentSets.map(s => ({ ...s, reps: targetReps }));
            }

            ex.sets = currentSets;
            next[index] = ex;
            return next;
        });
    };

    const getPlaceholderTitle = () => {
        switch (trainingCategory) {
            case 'gym': return t("addEvent.placeholder.gym");
            case 'running': return t("addEvent.placeholder.running");
            case 'cycling': return t("addEvent.placeholder.cycling");
            case 'custom': return t("addEvent.placeholder.custom");
            default: return t("addEvent.placeholder.default");
        }
    };

    const getDefaultTitle = () => {
        switch (trainingCategory) {
            case 'gym': return t("addEvent.defaultTitle.gym");
            case 'running': return t("addEvent.defaultTitle.running");
            case 'cycling': return t("addEvent.defaultTitle.cycling");
            case 'custom': return t("addEvent.defaultTitle.custom");
            default: return t("addEvent.defaultTitle.default");
        }
    };

    const handleSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!normalizeTitle(title) && mode === 'appointment') return;

        // For training, default title if empty
        const finalTitle = normalizeTitle(title) || (mode === 'training' ? getDefaultTitle() : "");
        if (!finalTitle) return;

        // Determine Category/Color
        // We ensure the workout category is mapped to the event category
        let finalCategory = category;
        if (mode === 'training') {
            // Map sport category directly to event category
            finalCategory = trainingCategory;
        }

        // Check if category exists in definitions, else fallback
        const catDef = EVENT_CATEGORIES.find(c => c.id === finalCategory) || EVENT_CATEGORIES.find(c => c.id === 'other')!;

        // Construct Payload
        const payload: NewCalendarEvent = {
            title: finalTitle,
            date: date,
            startTime: isAllDay ? "" : startTime,
            endTime: isAllDay ? "" : endTime,
            type: "other", // Default type
            category: finalCategory,
            notes: description,
            color: catDef.color,
        } as any;

        if (mode === 'training') {
            if (builtExercises.length > 0) {
                payload.workoutData = {
                    exercises: builtExercises,
                    templateId: selectedTemplateId || undefined
                };
            }
        }

        onSave(payload);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
                <div className="w-full max-w-md bg-[var(--modal-bg)] border border-[var(--border-color)] rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh]">

                    {/* Header */}
                    <div className="flex justify-between items-center mb-5">
                        <h3 className="text-xl font-bold text-[var(--text-color)]">
                            {mode === 'appointment' ? t('addEvent.titleAppointment') : t('addEvent.titleTraining')}
                        </h3>
                        <button onClick={onClose} className="bg-[var(--button-bg)] p-2 rounded-full hover:bg-[var(--button-bg)]">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto overscroll-contain space-y-6 pr-1 custom-scrollbar pb-[200px]">

                        {/* MODE A: APPOINTMENT */}
                        {mode === 'appointment' && (
                            <>
                                {/* Category Chips - Filtered for Appointment Types */}
                                <div>
                                    <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2.5 block">{t('addEvent.category')}</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['physio', 'doctor', 'other'].map(catId => {
                                            const cat = EVENT_CATEGORIES.find(c => c.id === catId);
                                            if (!cat) return null;
                                            const isSelected = category === cat.id;
                                            return (
                                                <button
                                                    key={cat.id}
                                                    onClick={() => setCategory(cat.id)}
                                                    className={`
                                                        ${isSelected
                                                            ? `${cat.color} ${cat.border} text-white shadow-lg`
                                                            : 'bg-[var(--button-bg)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--button-bg)] hover:border-[var(--border-color)]'}
                                                    `}
                                                >
                                                    {cat.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Title Input */}
                                <div>
                                    <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 block">{t('addEvent.titleLabel')}</label>
                                    <input
                                        type="text"
                                        placeholder={t('addEvent.appointmentPlaceholder')}
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text-color)] rounded-3xl px-4 py-3 text-[17px] focus:outline-none focus:border-blue-500/50 focus:bg-[var(--input-bg)] transition-all placeholder-[var(--text-secondary)]"
                                    />
                                </div>

                                {/* Notes */}
                                <div>
                                    <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 block">{t('addEvent.notes')}</label>
                                    <textarea
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        placeholder={t('addEvent.notesPlaceholder')}
                                        rows={4}
                                        className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text-color)] rounded-3xl px-4 py-3 text-[15px] focus:outline-none focus:border-blue-500/50 focus:bg-[var(--input-bg)] transition-all placeholder-[var(--text-secondary)] resize-none"
                                    />
                                </div>
                            </>
                        )}

                        {/* MODE B: TRAINING (WORKOUT BUILDER) */}
                        {mode === 'training' && (
                            <div className="space-y-6">
                                {/* SECTION 1: META & CATEGORY - 2x2 GRID */}
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    {SPORT_CATEGORIES.map((cat) => (
                                        <button
                                            key={cat.id}
                                            onClick={() => handleSetTrainingCategory(cat.id as TrainingCategory)}
                                            className={`
                                        flex flex-col items-center justify-center p-4 rounded-3xl border transition-all h-24
                                        ${trainingCategory === cat.id
                                                    ? `${cat.color} border-transparent text-white ring-2 ring-white/20 shadow-lg`
                                                    : 'bg-[var(--button-bg)] border-[var(--button-bg)] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-[var(--text-secondary)] hover:bg-[var(--button-bg)]'}
                                      `}
                                        >
                                            <cat.icon className="mb-2 w-6 h-6" />
                                            <span className="text-sm font-medium">{t(cat.labelKey)}</span>
                                        </button>
                                    ))}
                                </div>

                                <div className="grid grid-cols-[1fr_auto] gap-3">
                                    <div>
                                        <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 block">{t('addEvent.titleLabel')}</label>
                                        <input
                                            type="text"
                                            value={title}
                                            onChange={e => setTitle(e.target.value)}
                                            placeholder={getPlaceholderTitle()}
                                            className="w-full bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text-color)] rounded-3xl px-4 py-3.5 text-[16px] focus:outline-none focus:border-blue-500/50 focus:bg-[var(--input-bg)] transition-all placeholder-[var(--text-secondary)]"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 block">{t('addEvent.startTime')}</label>
                                        {isAllDay ? (
                                            <button
                                                type="button"
                                                onClick={() => setIsAllDay(false)}
                                                className="bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded-3xl px-4 py-3.5 text-[15px] w-full text-center"
                                            >
                                                Ganztägig
                                            </button>
                                        ) : (
                                            <input
                                                type="time"
                                                value={startTime}
                                                onChange={e => setStartTime(e.target.value)}
                                                className="bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text-color)] rounded-3xl px-4 py-3.5 text-[16px] text-center focus:outline-none focus:border-blue-500/50 focus:bg-[var(--input-bg)] transition-all w-full"
                                            />
                                        )}
                                    </div>
                                </div>

                                {/* SECTION 2: EXERCISES */}
                                <div className="space-y-4 pt-2">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{t('addEvent.plannedExercises')}</h4>
                                        <span className="text-xs text-[var(--text-secondary)]">{builtExercises.length} {t('addEvent.exercises')}</span>
                                    </div>

                                    {/* Exercise List */}
                                    <div className="space-y-2">
                                        {builtExercises.map((ex, idx) => (
                                            <div key={ex.id || idx} className="flex justify-between items-center p-3.5 bg-[var(--button-bg)] rounded-2xl border border-[var(--border-color)] group">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-2xl bg-[var(--input-bg)] flex items-center justify-center text-lg">
                                                        {trainingCategory === 'gym' ? '🏋️' : trainingCategory === 'running' ? '🏃' : trainingCategory === 'cycling' ? '🚴' : '✨'}
                                                    </div>
                                                    <div>
                                                        <div className="text-[var(--text-color)] font-medium">{ex.name}</div>
                                                        <div className="flex items-center gap-2 mt-1.5">
                                                            <div className="flex items-center bg-[var(--input-bg)] rounded-2xl px-2 py-1 gap-1.5">
                                                                <input
                                                                    type="number"
                                                                    min={1} max={10}
                                                                    value={ex.sets?.length || 0}
                                                                    onChange={(e) => handleUpdateSets(idx, parseInt(e.target.value) || 3, ex.sets?.[0]?.reps || 10)}
                                                                    className="bg-transparent text-[var(--text-color)] text-xs font-bold w-4 text-center focus:outline-none"
                                                                />
                                                                <span className="text-[var(--text-secondary)] text-[10px] uppercase font-bold tracking-wider">Sets</span>
                                                            </div>
                                                            <div className="text-[var(--text-secondary)] text-[10px]">x</div>
                                                            <div className="flex items-center bg-[var(--input-bg)] rounded-2xl px-2 py-1 gap-1.5">
                                                                <input
                                                                    type="number"
                                                                    min={1} max={99}
                                                                    value={ex.sets?.[0]?.reps || 10}
                                                                    onChange={(e) => handleUpdateSets(idx, ex.sets?.length || 3, parseInt(e.target.value) || 10)}
                                                                    className="bg-transparent text-[var(--text-color)] text-xs font-bold w-5 text-center focus:outline-none"
                                                                />
                                                                <span className="text-[var(--text-secondary)] text-[10px] uppercase font-bold tracking-wider">
                                                                    {trainingCategory === 'gym' || trainingCategory === 'custom' ? 'Reps' : 'Min'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveExercise(idx)}
                                                    className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-red-400 hover:bg-[var(--button-bg)] transition-all"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}

                                        {builtExercises.length === 0 && (
                                            <div className="text-center py-6 border border-dashed border-[var(--border-color)] rounded-2xl">
                                                <div className="text-[var(--text-secondary)] text-sm">{t('addEvent.noExercisesPlanned')}</div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Add Button */}
                                    <button
                                        onClick={() => setIsExerciseLibraryOpen(true)}
                                        className="w-full py-4 rounded-2xl border border-dashed border-[var(--border-color)] flex items-center justify-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-color)] hover:border-[var(--border-color)] hover:bg-[var(--button-bg)] transition-all group"
                                    >
                                        <div className="w-6 h-6 rounded-full bg-[var(--button-bg)] flex items-center justify-center group-hover:bg-[var(--button-bg)] transition-colors">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                                        </div>
                                        <span className="font-medium">
                                            {trainingCategory === 'gym' ? t('addEvent.addExercise') : trainingCategory === 'running' ? t('addEvent.addRunInterval') : trainingCategory === 'cycling' ? t('addEvent.addRide') : t('addEvent.addExercise')}
                                        </span>
                                    </button>
                                </div>
                            </div>
                        )}


                        {/* COMMON: TIME SELECTION */}
                        <div className="pt-2 border-t border-[var(--border-color)]">
                            <div className="flex items-center justify-between mb-3">
                                <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{t('addEvent.time')}</label>
                                {/* Ganztägig toggle */}
                                <button
                                    type="button"
                                    onClick={() => setIsAllDay(v => !v)}
                                    className="flex items-center gap-2"
                                >
                                    <span className="text-xs font-medium" style={{ color: isAllDay ? "var(--accent-color)" : "var(--text-secondary)" }}>
                                        Ganztägig
                                    </span>
                                    <div className={`w-10 h-6 rounded-full relative transition-colors duration-200 ${isAllDay ? "bg-blue-500" : "bg-[var(--button-bg)]"}`}>
                                        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${isAllDay ? "translate-x-4" : "translate-x-0"}`} />
                                    </div>
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <input
                                    type="date"
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                    className="bg-[var(--input-bg)] border border-[var(--border-color)] focus:bg-[var(--input-bg)] focus:border-blue-500/50 text-[var(--text-color)] rounded-3xl px-3 py-3 text-[15px] focus:outline-none transition-all font-mono"
                                />
                                {isAllDay ? (
                                    <div className="flex items-center justify-center rounded-3xl bg-[var(--input-bg)] border border-[var(--border-color)] text-[var(--text-secondary)] text-[14px]">
                                        Ganztägig · 13:00 Uhr
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        <input
                                            type="time"
                                            value={startTime}
                                            onChange={e => setStartTime(e.target.value)}
                                            className="flex-1 bg-[var(--input-bg)] border border-[var(--border-color)] focus:bg-[var(--input-bg)] focus:border-blue-500/50 text-[var(--text-color)] rounded-3xl px-2 py-3 text-[15px] text-center focus:outline-none transition-all font-mono"
                                        />
                                        <input
                                            type="time"
                                            value={endTime}
                                            onChange={e => setEndTime(e.target.value)}
                                            className="flex-1 bg-[var(--input-bg)] border border-[var(--border-color)] focus:bg-[var(--input-bg)] focus:border-blue-500/50 text-[var(--text-color)] rounded-3xl px-2 py-3 text-[15px] text-center focus:outline-none transition-all font-mono"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="pt-5 mt-2 border-t border-[var(--border-color)]">
                            <AppButton onClick={() => handleSubmit()} className="w-full bg-white text-black hover:bg-gray-200">
                                {t('common.save')}
                            </AppButton>
                        </div>
                    </div>

                </div>
            </div >

            <ExerciseLibraryModal
                open={isExerciseLibraryOpen}
                category={trainingCategory}
                onClose={() => setIsExerciseLibraryOpen(false)}
                onPick={handleAddFromLibrary}
            />
        </>
    );
};
