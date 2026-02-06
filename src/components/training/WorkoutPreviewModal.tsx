
import React from 'react';
import { Play, Clock, X, Dumbbell, Footprints, Bike } from 'lucide-react';
import type { CalendarEvent } from '../../pages/CalendarPage'; // or types/training if we unify

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

    const exercises = event.workoutData?.exercises || [];

    return (
        <div className="fixed inset-0 z-[150] flex items-end justify-center sm:items-center p-0 sm:p-4">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Sheet */}
            <div className="relative w-full max-w-sm bg-[#1c1c1e] rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl animate-in slide-in-from-bottom-10 border-t border-white/10 sm:border ring-1 ring-white/5">

                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-2xl bg-${baseColor}/20 flex items-center justify-center border border-${baseColor}/20`}>
                            {getIcon()}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white leading-tight">{event.title}</h2>
                            <div className="flex items-center gap-2 mt-1 text-zinc-400 text-sm font-medium">
                                <Clock size={14} />
                                <span>{event.duration} min</span>
                                <span className="text-zinc-600">•</span>
                                <span className="capitalize">{event.type}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 bg-zinc-800 rounded-full text-zinc-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="mb-8">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Geplante Übungen</h3>

                    {exercises.length > 0 ? (
                        <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-1">
                            {exercises.map((ex, i) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/50 border border-white/5">
                                    <span className="text-sm font-medium text-white truncate max-w-[70%]">{ex.name}</span>
                                    <span className="text-xs font-bold text-zinc-400 bg-zinc-700/50 px-2 py-1 rounded">
                                        {ex.sets.length} Sets
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 bg-zinc-800/30 rounded-xl border border-dashed border-zinc-700">
                            <p className="text-sm text-zinc-500">Keine Details verfügbar</p>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-4 rounded-xl bg-zinc-800 text-white font-bold text-sm hover:bg-zinc-700 transition-colors"
                    >
                        Schließen
                    </button>
                    <button
                        onClick={() => onStart(event)}
                        className="flex-[2] py-4 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-500 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
                    >
                        <Play size={18} fill="currentColor" />
                        Training starten
                    </button>
                </div>

            </div>
        </div>
    );
};

export default WorkoutPreviewModal;
