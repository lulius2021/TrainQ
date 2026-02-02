import React, { useState, useEffect, useMemo } from "react";
import { AppButton } from "../ui/AppButton";
import { EVENT_CATEGORIES } from "../../constants/events";
// import { getTemplates } from "../../utils/trainingTemplatesStore"; // Unused
import ExerciseLibraryModal from "../training/ExerciseLibraryModal";
import type { NewCalendarEvent, LiveExercise } from "../../types/training";
import type { Exercise } from "../../data/exerciseLibrary";
import { Dumbbell, Footprints, Bike, Star } from "lucide-react";

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
    { id: 'gym', label: 'Gym', icon: Dumbbell, color: 'bg-blue-600', border: 'border-blue-500' },
    { id: 'running', label: 'Laufen', icon: Footprints, color: 'bg-emerald-600', border: 'border-emerald-500' },
    { id: 'cycling', label: 'Radfahren', icon: Bike, color: 'bg-violet-600', border: 'border-violet-500' },
    { id: 'custom', label: 'Custom', icon: Star, color: 'bg-orange-600', border: 'border-orange-500' },
] as const;

export const AddEventModal: React.FC<AddEventModalProps> = ({
    isOpen,
    onClose,
    initialDate,
    mode,
    onSave,
}) => {
    // --- State ---
    const [title, setTitle] = useState("");
    const [date, setDate] = useState(initialDate || new Date().toISOString().split("T")[0]);
    const [startTime, setStartTime] = useState("18:00");
    const [endTime, setEndTime] = useState("19:00");
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
            case 'gym': return "Push, Pull, Legs...";
            case 'running': return "Laufrunde am Morgen...";
            case 'cycling': return "Radtour...";
            case 'custom': return "Benutzerdefiniertes Training...";
            default: return "Training...";
        }
    };

    const getDefaultTitle = () => {
        switch (trainingCategory) {
            case 'gym': return "Gym Workout";
            case 'running': return "Laufeinheit";
            case 'cycling': return "Radeinheit";
            case 'custom': return "Training";
            default: return "Training";
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
            startTime: startTime,
            endTime: endTime,
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
                <div className="w-full max-w-md bg-[#1c1c1e] border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh]">

                    {/* Header */}
                    <div className="flex justify-between items-center mb-5">
                        <h3 className="text-xl font-bold text-white">
                            {mode === 'appointment' ? 'Termin anlegen' : 'Training anlegen'}
                        </h3>
                        <button onClick={onClose} className="bg-white/10 p-2 rounded-full hover:bg-white/20">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto overscroll-contain space-y-6 pr-1 custom-scrollbar pb-[200px]">

                        {/* MODE A: APPOINTMENT */}
                        {mode === 'appointment' && (
                            <>
                                {/* Category Chips - Filtered for Appointment Types */}
                                <div>
                                    <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2.5 block">Kategorie</label>
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
                                                            : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:border-white/20'}
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
                                    <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 block">Titel</label>
                                    <input
                                        type="text"
                                        placeholder="Termin Name (z.B. Zahnarzt)"
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 text-white rounded-3xl px-4 py-3 text-[17px] focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all placeholder-white/50"
                                    />
                                </div>

                                {/* Notes */}
                                <div>
                                    <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 block">Notizen</label>
                                    <textarea
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        placeholder="Notizen zum Termin..."
                                        rows={4}
                                        className="w-full bg-white/5 border border-white/10 text-white rounded-3xl px-4 py-3 text-[15px] focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all placeholder-white/30 resize-none"
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
                                                    : 'bg-zinc-800 border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-zinc-400 hover:bg-zinc-700'}
                                      `}
                                        >
                                            <cat.icon className="mb-2 w-6 h-6" />
                                            <span className="text-sm font-medium">{cat.label}</span>
                                        </button>
                                    ))}
                                </div>

                                <div className="grid grid-cols-[1fr_auto] gap-3">
                                    <div>
                                        <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 block">Titel</label>
                                        <input
                                            type="text"
                                            value={title}
                                            onChange={e => setTitle(e.target.value)}
                                            placeholder={getPlaceholderTitle()}
                                            className="w-full bg-white/5 border border-white/10 text-white rounded-3xl px-4 py-3.5 text-[16px] focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all placeholder-white/30"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 block">Startzeit</label>
                                        <input
                                            type="time"
                                            value={startTime}
                                            onChange={e => setStartTime(e.target.value)}
                                            className="bg-white/5 border border-white/10 text-white rounded-3xl px-4 py-3.5 text-[16px] text-center focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all"
                                        />
                                    </div>
                                </div>

                                {/* SECTION 2: EXERCISES */}
                                <div className="space-y-4 pt-2">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Geplante Übungen</h4>
                                        <span className="text-xs text-white/30">{builtExercises.length} Übungen</span>
                                    </div>

                                    {/* Exercise List */}
                                    <div className="space-y-2">
                                        {builtExercises.map((ex, idx) => (
                                            <div key={ex.id || idx} className="flex justify-between items-center p-3.5 bg-white/5 rounded-2xl border border-white/10 group">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-lg">
                                                        {trainingCategory === 'gym' ? '🏋️' : trainingCategory === 'running' ? '🏃' : trainingCategory === 'cycling' ? '🚴' : '✨'}
                                                    </div>
                                                    <div>
                                                        <div className="text-white font-medium">{ex.name}</div>
                                                        <div className="flex items-center gap-2 mt-1.5">
                                                            <div className="flex items-center bg-white/10 rounded-2xl px-2 py-1 gap-1.5">
                                                                <input
                                                                    type="number"
                                                                    min={1} max={10}
                                                                    value={ex.sets?.length || 0}
                                                                    onChange={(e) => handleUpdateSets(idx, parseInt(e.target.value) || 3, ex.sets?.[0]?.reps || 10)}
                                                                    className="bg-transparent text-white text-xs font-bold w-4 text-center focus:outline-none"
                                                                />
                                                                <span className="text-white/40 text-[10px] uppercase font-bold tracking-wider">Sets</span>
                                                            </div>
                                                            <div className="text-white/30 text-[10px]">x</div>
                                                            <div className="flex items-center bg-white/10 rounded-2xl px-2 py-1 gap-1.5">
                                                                <input
                                                                    type="number"
                                                                    min={1} max={99}
                                                                    value={ex.sets?.[0]?.reps || 10}
                                                                    onChange={(e) => handleUpdateSets(idx, ex.sets?.length || 3, parseInt(e.target.value) || 10)}
                                                                    className="bg-transparent text-white text-xs font-bold w-5 text-center focus:outline-none"
                                                                />
                                                                <span className="text-white/40 text-[10px] uppercase font-bold tracking-wider">
                                                                    {trainingCategory === 'gym' || trainingCategory === 'custom' ? 'Reps' : 'Min'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveExercise(idx)}
                                                    className="w-8 h-8 rounded-full flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-white/5 transition-all"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}

                                        {builtExercises.length === 0 && (
                                            <div className="text-center py-6 border border-dashed border-white/10 rounded-2xl">
                                                <div className="text-white/30 text-sm">Noch keine Übungen geplant</div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Add Button */}
                                    <button
                                        onClick={() => setIsExerciseLibraryOpen(true)}
                                        className="w-full py-4 rounded-2xl border border-dashed border-white/20 flex items-center justify-center gap-2 text-white/60 hover:text-white hover:border-white/40 hover:bg-white/5 transition-all group"
                                    >
                                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                                        </div>
                                        <span className="font-medium">
                                            {trainingCategory === 'gym' ? 'Übung hinzufügen' : trainingCategory === 'running' ? 'Lauf/Intervall hinzufügen' : trainingCategory === 'cycling' ? 'Radfahrt hinzufügen' : 'Übung hinzufügen'}
                                        </span>
                                    </button>
                                </div>
                            </div>
                        )}


                        {/* COMMON: TIME SELECTION */}
                        <div className="pt-2 border-t border-white/10">
                            <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 block">Zeit</label>
                            <div className="grid grid-cols-2 gap-3">
                                <input
                                    type="date"
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                    className="bg-white/5 border border-white/10 focus:bg-white/10 focus:border-blue-500/50 text-white rounded-3xl px-3 py-3 text-[15px] focus:outline-none transition-all font-mono"
                                />
                                <div className="flex gap-2">
                                    <input
                                        type="time"
                                        value={startTime}
                                        onChange={e => setStartTime(e.target.value)}
                                        className="flex-1 bg-white/5 border border-white/10 focus:bg-white/10 focus:border-blue-500/50 text-white rounded-3xl px-2 py-3 text-[15px] text-center focus:outline-none transition-all font-mono"
                                    />
                                    <input
                                        type="time"
                                        value={endTime}
                                        onChange={e => setEndTime(e.target.value)}
                                        className="flex-1 bg-white/5 border border-white/10 focus:bg-white/10 focus:border-blue-500/50 text-white rounded-3xl px-2 py-3 text-[15px] text-center focus:outline-none transition-all font-mono"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-5 mt-2 border-t border-white/10">
                            <AppButton onClick={() => handleSubmit()} className="w-full bg-white text-black hover:bg-gray-200">
                                Speichern
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
