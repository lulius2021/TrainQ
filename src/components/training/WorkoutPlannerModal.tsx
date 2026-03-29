import React, { useState } from 'react';
import { Clock, Plus, Dumbbell, Footprints, Bike, Sparkles, X } from 'lucide-react';
import ExerciseLibraryModal from './ExerciseLibraryModal';
import { getScopedItem, setScopedItem } from '../../utils/scopedStorage';
import { getActiveUserId } from '../../utils/session';
import type { CalendarEvent } from '../../types';
import { format } from 'date-fns';
import { BottomSheet } from '../common/BottomSheet';

interface WorkoutPlannerModalProps {
    open: boolean;
    onClose: () => void;
    onSave: () => void;
}

type SportType = 'gym' | 'run' | 'cycle' | 'custom';

const SPORTS: { id: SportType; label: string; icon: React.ReactNode; color: string; bg: string }[] = [
    { id: 'gym',    label: 'Gym',     icon: <Dumbbell size={20} />,   color: '#007AFF', bg: 'rgba(0,122,255,0.12)' },
    { id: 'run',    label: 'Laufen',  icon: <Footprints size={20} />, color: '#34C759', bg: 'rgba(52,199,89,0.12)' },
    { id: 'cycle',  label: 'Rad',     icon: <Bike size={20} />,       color: '#FF9500', bg: 'rgba(255,149,0,0.12)' },
    { id: 'custom', label: 'Custom',  icon: <Sparkles size={20} />,   color: '#AF52DE', bg: 'rgba(175,82,222,0.12)' },
];

export default function WorkoutPlannerModal({ open, onClose, onSave }: WorkoutPlannerModalProps) {
    const [title, setTitle] = useState("Manuelles Training");
    const [sport, setSport] = useState<SportType>("gym");
    const [startTime, setStartTime] = useState(format(new Date(), "HH:mm"));
    const [exercises, setExercises] = useState<any[]>([]);
    const [showLibrary, setShowLibrary] = useState(false);

    const handleAddExercise = (exercise: any) => {
        setExercises(prev => [...prev, { id: exercise.id, name: exercise.name, sets: [], rest: 60, target: { sets: 3, reps: 10 } }]);
        setShowLibrary(false);
    };

    const handleSave = () => {
        const userId = getActiveUserId() || "user";
        const dateStr = format(new Date(), "yyyy-MM-dd");
        const newEvent: CalendarEvent = {
            id: `manual_${Date.now()}`,
            date: new Date(),
            title: title || "Training",
            type: sport === 'gym' ? 'strength' : sport === 'run' ? 'run' : sport === 'cycle' ? 'cycle' : 'custom',
            duration: 60,
            status: 'planned' as const,
            intensity: 'medium',
            workoutData: { exercises },
        };
        const coreEvent = {
            ...newEvent,
            date: dateStr,
            trainingType: sport === 'gym' ? 'gym' : sport === 'run' ? 'laufen' : sport === 'cycle' ? 'radfahren' : 'custom',
            trainingStatus: 'planned',
            adaptiveEstimatedMinutes: 60,
        };
        const STORAGE_KEY = "trainq_calendar_events";
        const existingRaw = getScopedItem(STORAGE_KEY, userId);
        const events: any[] = existingRaw ? JSON.parse(existingRaw) : [];
        events.push(coreEvent);
        setScopedItem(STORAGE_KEY, userId, JSON.stringify(events));
        window.dispatchEvent(new Event("trainq:update_events"));
        onSave();
        onClose();
    };

    const activeSport = SPORTS.find(s => s.id === sport)!;

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
                            className="w-full py-3.5 rounded-2xl font-bold text-[15px] text-white active:scale-[0.97] transition-all"
                            style={{ backgroundColor: "#007AFF", boxShadow: "0 4px 16px rgba(0,122,255,0.35)" }}
                        >
                            Plan speichern
                        </button>
                    </div>
                }
            >
                <div className="px-5 pt-2 pb-4 space-y-5">
                    {/* Header */}
                    <div>
                        <h2 className="text-[28px] font-black tracking-tight" style={{ color: "var(--text-color)", letterSpacing: "-0.5px" }}>
                            Training anlegen
                        </h2>
                        <p className="text-[14px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
                            Füge ein Training zum Kalender hinzu
                        </p>
                    </div>

                    {/* Sport Selection */}
                    <div className="grid grid-cols-4 gap-2">
                        {SPORTS.map(s => (
                            <button
                                key={s.id}
                                onClick={() => setSport(s.id)}
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
                        <label className="text-[11px] font-bold uppercase tracking-wider ml-1" style={{ color: "var(--text-secondary)" }}>Titel</label>
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full rounded-2xl px-4 py-3.5 font-medium focus:outline-none border text-[15px]"
                            style={{ backgroundColor: "var(--button-bg)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
                            placeholder="z.B. Oberkörper Push"
                        />
                    </div>

                    {/* Startzeit */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider ml-1" style={{ color: "var(--text-secondary)" }}>Startzeit</label>
                        <div className="flex items-center gap-3 rounded-2xl px-4 py-3.5 border" style={{ backgroundColor: "var(--button-bg)", borderColor: "var(--border-color)" }}>
                            <Clock size={18} style={{ color: "var(--text-secondary)" }} />
                            <input
                                type="time"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                className="bg-transparent font-medium focus:outline-none text-[15px] flex-1"
                                style={{ color: "var(--text-color)" }}
                            />
                        </div>
                    </div>

                    {/* Exercises */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between ml-1">
                            <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                                Übungen ({exercises.length})
                            </label>
                            <button
                                onClick={() => setShowLibrary(true)}
                                className="flex items-center gap-1 text-[13px] font-bold"
                                style={{ color: activeSport.color }}
                            >
                                <Plus size={14} /> Hinzufügen
                            </button>
                        </div>

                        {exercises.length > 0 ? (
                            <div className="space-y-2">
                                {exercises.map((ex, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center justify-between px-4 py-3 rounded-2xl border"
                                        style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}
                                    >
                                        <span className="font-semibold text-[14px]" style={{ color: "var(--text-color)" }}>{ex.name}</span>
                                        <button onClick={() => setExercises(exercises.filter((_, idx) => idx !== i))} style={{ color: "var(--text-secondary)" }}>
                                            <X size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowLibrary(true)}
                                className="w-full py-8 border-2 border-dashed rounded-3xl flex flex-col items-center gap-2 transition-all active:scale-[0.98]"
                                style={{ borderColor: "var(--border-color)", backgroundColor: "var(--button-bg)" }}
                            >
                                <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: activeSport.bg, color: activeSport.color }}>
                                    {activeSport.icon}
                                </div>
                                <span className="text-[13px] font-semibold" style={{ color: "var(--text-secondary)" }}>Übungen hinzufügen</span>
                            </button>
                        )}
                    </div>
                </div>
            </BottomSheet>

            <ExerciseLibraryModal
                open={showLibrary}
                onClose={() => setShowLibrary(false)}
                onPick={handleAddExercise}
                existingExerciseIds={exercises.map(e => e.id)}
            />
        </>
    );
}
