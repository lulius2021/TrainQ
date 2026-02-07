
import React, { useState } from 'react';
import { X, Clock, Plus, Dumbbell, Footprints, Bike, AlertCircle, Calendar } from 'lucide-react';
import ExerciseLibraryModal from './ExerciseLibraryModal';
import { getScopedItem, setScopedItem } from '../../utils/scopedStorage';
import { getActiveUserId } from '../../utils/session';
import type { CalendarEvent } from '../../types';
import { format } from 'date-fns';

interface WorkoutPlannerModalProps {
    onClose: () => void;
    onSave: () => void; // Trigger refresh in parent
}

type SportType = 'gym' | 'run' | 'cycle' | 'custom';

export default function WorkoutPlannerModal({ onClose, onSave }: WorkoutPlannerModalProps) {
    const [title, setTitle] = useState("Manuelles Training");
    const [sport, setSport] = useState<SportType>("gym");
    const [startTime, setStartTime] = useState(format(new Date(), "HH:mm"));
    const [exercises, setExercises] = useState<any[]>([]); // Minimal exercise objects
    const [showLibrary, setShowLibrary] = useState(false);

    const handleAddExercise = (exercise: any) => {
        // Transform library exercise to "live" exercise format (or minimal persistable format)
        const newItem = {
            id: exercise.id,
            name: exercise.name,
            sets: [], // Empty sets initially
            rest: 60,
            target: { sets: 3, reps: 10 } // Default targets
        };
        setExercises([...exercises, newItem]);
        setShowLibrary(false); // Close library after pick (or keep open? Prompt implies "Multi-Select Sync" -> "Close" might be annoying if multi. Let's keep it open or just use onPick)
        // The prompt says "Multi-Select Sync" which implies the library might need to support checking multiple items and *then* adding. 
        // But looking at ExerciseLibraryModal, 'onPick' is called immediately.
        // Effectively, we can just keep adding. But for better UX we might want to keep library open.
        // However, ExerciseLibraryModal usually has a Close button. So we can just let user pick multiple times if the modal supports staying open?
        // Actually ExerciseLibraryModal closes via 'onClose'. 'onPick' adds it.
        // Let's rely on standard behavior: click add -> adds to list.
    };

    const handleSave = () => {
        // 1. Create Workout Object
        const userId = getActiveUserId() || "user";
        const dateStr = format(new Date(), "yyyy-MM-dd"); // Assuming "Today" for now as per prompt "CalendarState für Heute"

        // Construct event
        const newEvent: CalendarEvent = {
            id: `manual_${Date.now()}`,
            date: new Date(), // Actually needs to be strictly today's date obj
            title: title || "Training",
            type: sport === 'gym' ? 'strength' : sport === 'run' ? 'run' : sport === 'cycle' ? 'cycle' : 'custom',
            duration: 60, // Estimated default
            status: 'planned' as const,
            intensity: 'medium',
            workoutData: {
                exercises: exercises
            }
        };

        // 2. Persist
        const STORAGE_KEY = "trainq_calendar_events";
        const existingRaw = getScopedItem(STORAGE_KEY, userId);
        let events: any[] = existingRaw ? JSON.parse(existingRaw) : [];

        // Ensure we persist a "CoreEvent" structure which matches CalendarEvent largely but dates are strings in JSON
        const coreEvent = {
            ...newEvent,
            date: dateStr, // Save as string
            trainingType: sport === 'gym' ? 'gym' : sport === 'run' ? 'laufen' : sport === 'cycle' ? 'radfahren' : 'custom',
            trainingStatus: 'planned',
            adaptiveEstimatedMinutes: 60
        };

        events.push(coreEvent);
        setScopedItem(STORAGE_KEY, userId, JSON.stringify(events));

        // IMMEDIATE REFRESH: Dispatch global event for Calendar
        window.dispatchEvent(new Event("trainq:update_events"));

        onSave();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[9000] bg-[#121214] flex flex-col animate-in slide-in-from-bottom-10">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 pt-12 sm:pt-4 border-b border-white/10 bg-[#1c1c1e]">
                <h2 className="text-xl font-bold text-white">Training anlegen</h2>
                <button onClick={onClose} className="p-2 bg-zinc-800 rounded-full text-zinc-400 hover:text-white">
                    <X size={20} />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* 1. Sport Selection */}
                <div className="grid grid-cols-4 gap-2">
                    {[
                        { id: 'gym', label: 'Gym', icon: <Dumbbell size={20} />, color: 'bg-blue-600', border: 'border-blue-500' },
                        { id: 'run', label: 'Run', icon: <Footprints size={20} />, color: 'bg-red-600', border: 'border-red-500' },
                        { id: 'cycle', label: 'Cycle', icon: <Bike size={20} />, color: 'bg-green-600', border: 'border-green-500' },
                        { id: 'custom', label: 'Custom', icon: <AlertCircle size={20} />, color: 'bg-yellow-600', border: 'border-yellow-500' },
                    ].map(opt => (
                        <button
                            key={opt.id}
                            onClick={() => setSport(opt.id as SportType)}
                            className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border transition-all ${sport === opt.id ? `${opt.color} ${opt.border} text-white` : 'bg-zinc-800/50 border-white/5 text-zinc-400'}`}
                        >
                            {opt.icon}
                            <span className="text-xs font-bold">{opt.label}</span>
                        </button>
                    ))}
                </div>

                {/* 2. Inputs */}
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Titel</label>
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-[#1c1c1e] border border-white/10 rounded-2xl p-4 text-white font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="z.B. Oberkörper Push"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Startzeit</label>
                        <div className="flex items-center gap-2 bg-[#1c1c1e] border border-white/10 rounded-2xl p-4">
                            <Clock className="text-zinc-500" size={20} />
                            <input
                                type="time"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                className="bg-transparent text-white font-medium focus:outline-none w-full"
                            />
                        </div>
                    </div>
                </div>

                {/* 3. Exercises */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Übungen ({exercises.length})</label>
                        <button
                            onClick={() => setShowLibrary(true)}
                            className="flex items-center gap-1 text-xs font-bold text-blue-400 hover:text-blue-300"
                        >
                            <Plus size={14} /> Hinzufügen
                        </button>
                    </div>

                    {exercises.length > 0 ? (
                        <div className="space-y-2">
                            {exercises.map((ex, i) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-[#1c1c1e] rounded-2xl border border-white/5">
                                    <span className="font-medium text-white">{ex.name}</span>
                                    <button onClick={() => setExercises(exercises.filter((_, idx) => idx !== i))} className="text-zinc-500 hover:text-red-400">
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div
                            onClick={() => setShowLibrary(true)}
                            className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-zinc-800 rounded-3xl bg-zinc-900/30 text-zinc-500 gap-2 cursor-pointer hover:border-zinc-700 transition-colors"
                        >
                            <Calendar size={24} className="opacity-50" />
                            <span className="text-sm font-medium">Noch keine Übungen</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/10 bg-[#1c1c1e] pb-[160px]">
                <button
                    onClick={handleSave}
                    className="w-full py-4 bg-blue-600 rounded-2xl font-bold text-white hover:bg-blue-500 active:scale-[0.98] transition-all shadow-lg shadow-blue-900/20"
                >
                    Plan speichern
                </button>
            </div>

            {/* Library Modal Overlay */}
            <ExerciseLibraryModal
                open={showLibrary}
                onClose={() => setShowLibrary(false)}
                onPick={handleAddExercise}
                existingExerciseIds={exercises.map(e => e.id)}
            />
        </div>
    );
}
