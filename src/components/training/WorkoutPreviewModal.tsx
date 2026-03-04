
import React from 'react';
import { Play, Clock, X, Dumbbell, Footprints, Bike, Trash2 } from 'lucide-react';
import type { CalendarEvent } from '../../types';
import { useLiveTrainingStore } from '../../store/useLiveTrainingStore';
import { persistActiveLiveWorkout } from '../../utils/trainingHistory';
import { getScopedItem, setScopedItem } from '../../utils/scopedStorage';
import { getActiveUserId } from '../../utils/session';

interface WorkoutPreviewModalProps {
    event: CalendarEvent | null;
    onClose: () => void;
    onStart: (event: CalendarEvent) => void;
}

const WorkoutPreviewModal = ({ event, onClose, onStart }: WorkoutPreviewModalProps) => {
    if (!event) return null;

    // Helper to get icon
    const getIcon = () => {
        switch (event.type) {
            case 'run': return <Footprints className="text-white" size={24} />;
            case 'cycle': return <Bike className="text-white" size={24} />;
            case 'strength': return <Dumbbell className="text-white" size={24} />;
            default: return <Dumbbell className="text-white" size={24} />;
        }
    };

    // Helper to get background color
    const getBgColor = () => {
        if (event.color) return event.color.replace('bg-', '');
        switch (event.type) {
            case 'run': return 'red-500';
            case 'cycle': return 'green-500';
            case 'strength': return 'blue-500';
            default: return 'blue-500';
        }
    };

    const baseColor = getBgColor();

    const handleDelete = () => {
        if (!event) return;
        if (window.confirm("Training löschen?")) {
            const userId = getActiveUserId() || "user";
            const storageKey = "trainq_calendar_events";
            const raw = getScopedItem(storageKey, userId);
            if (raw) {
                try {
                    const events = JSON.parse(raw);
                    const updatedEvents = events.filter((e: any) => e.id !== event.id);
                    setScopedItem(storageKey, JSON.stringify(updatedEvents), userId);
                    window.dispatchEvent(new Event("trainq:update_events"));
                    onClose();
                } catch (e) { if (import.meta.env.DEV) console.error(e); }
            }
        }
    };

    const exercises = event.workoutData?.exercises || [];

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal Box */}
            <div className="relative w-full max-w-sm bg-[var(--card-bg)] rounded-[32px] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 border border-[var(--border-color)] ring-1 ring-[var(--border-color)] max-h-[80vh] shrink-0">

                {/* Header (Fixed) */}
                <div className="shrink-0 flex justify-between items-start p-6 pb-4 border-b border-[var(--border-color)] bg-[var(--card-bg)] z-10 rounded-t-[32px]">
                    <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-2xl bg-${baseColor}/20 flex items-center justify-center border border-${baseColor}/20 shrink-0`}>
                            {getIcon()}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-[var(--text-color)] leading-tight line-clamp-1">{event.title}</h2>
                            <div className="flex items-center gap-2 mt-1 text-[var(--text-secondary)] text-sm font-medium">
                                <Clock size={14} />
                                <span>{event.duration} min</span>
                                <span className="opacity-50">•</span>
                                <span className="capitalize">{event.type}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex bg-[var(--button-bg)] rounded-full p-1 gap-1 items-center shrink-0">
                        <button onClick={handleDelete} className="p-2 rounded-full text-[var(--text-secondary)] hover:text-red-500 hover:bg-[var(--button-bg)] transition-colors active:scale-95">
                            <Trash2 size={18} />
                        </button>
                        <div className="w-[1px] h-4 bg-[var(--border-color)]"></div>
                        <button onClick={onClose} className="p-2 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-color)] hover:bg-[var(--button-bg)] transition-colors active:scale-95">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Content (Scrollable) */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div>
                        <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-3 sticky top-0 bg-[var(--card-bg)] py-1 z-10">Geplante Übungen</h3>

                        {exercises.length > 0 ? (
                            <div className="space-y-2">
                                {exercises.map((ex: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-[var(--button-bg)] border border-[var(--border-color)]">
                                        <span className="text-sm font-medium text-[var(--text-color)] break-words line-clamp-2 max-w-[70%]">{ex.name}</span>
                                        <span className="text-xs font-bold text-[var(--text-secondary)] bg-[var(--input-bg)] px-2 py-1 rounded shrink-0">
                                            {ex.sets.length} Sets
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 bg-[var(--button-bg)] rounded-xl border border-dashed border-[var(--border-color)]">
                                <p className="text-sm text-[var(--text-secondary)]">Keine Details verfügbar</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions (Fixed) */}
                <div className="shrink-0 p-6 pt-4 bg-[var(--card-bg)] border-t border-[var(--border-color)] rounded-b-[32px]">
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-4 rounded-xl bg-[var(--button-bg)] text-[var(--text-color)] font-bold text-sm hover:opacity-80 transition-colors"
                        >
                            Schließen
                        </button>
                        <button
                            onClick={() => {
                                // Direct Logic Implementation as requested
                                if (!event) return;

                                // 1. Construct Live Workout Object
                                // Use existing workoutData or create fallback
                                const exercises = event.workoutData?.exercises || [];
                                const liveWorkout = {
                                    id: crypto.randomUUID(),
                                    calendarEventId: event.id,
                                    title: event.title,
                                    sport: event.type === 'strength' ? 'Gym' : event.type === 'run' ? 'Laufen' : event.type === 'cycle' ? 'Radfahren' : 'Custom',
                                    startedAt: new Date().toISOString(),
                                    isActive: true,
                                    exercises: exercises,
                                    notes: `Started from Calendar: ${event.title}`
                                };

                                // 2. Persist & Set State
                                persistActiveLiveWorkout(liveWorkout as any);
                                useLiveTrainingStore.getState().startWorkout(liveWorkout as any);

                                // 3. Navigate
                                window.dispatchEvent(new CustomEvent("trainq:navigate", {
                                    detail: { path: "/live-training", eventId: event.id }
                                }));

                                // 4. Close Modal
                                onClose();
                            }}
                            className="flex-[2] py-4 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-500 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
                        >
                            <Play size={18} fill="currentColor" />
                            Training starten
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default WorkoutPreviewModal;
