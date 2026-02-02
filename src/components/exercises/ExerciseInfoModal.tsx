import React, { useEffect } from "react";
import { X, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Exercise } from "../../data/exerciseLibrary";
import { useExerciseImage } from "../../hooks/useExerciseImage";

interface ExerciseInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
    exercise: Exercise | null;
}

const MuscleBadge = ({ muscle }: { muscle: string }) => {
    const formatMuscle = (m: string) => m.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
    return (
        <span className="px-2 py-1 rounded-md bg-[#007AFF]/20 text-xs font-medium text-[#007AFF] border border-[#007AFF]/20">
            {formatMuscle(muscle)}
        </span>
    );
};

export default function ExerciseInfoModal({ isOpen, onClose, exercise }: ExerciseInfoModalProps) {
    // Prevent body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => { document.body.style.overflow = ""; };
    }, [isOpen]);

    const imageUrl = useExerciseImage(exercise);

    // Resolve Instructions
    const instructions = (exercise as any)?.instructions || (exercise?.cues?.join("\n- "));

    return (
        <AnimatePresence>
            {isOpen && exercise && (
                <motion.div
                    initial={{ opacity: 0, y: "100%" }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="fixed inset-0 z-[70] bg-zinc-950 flex flex-col sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:h-[85vh] sm:rounded-3xl sm:border sm:border-white/10 sm:overflow-hidden sm:shadow-2xl"
                >
                    {/* Header */}
                    <div className="sticky top-0 z-10 flex items-center justify-between px-4 pb-4 pt-20 bg-zinc-950/80 backdrop-blur-md border-b border-white/5 shrink-0">
                        <h2 className="text-lg font-bold text-white truncate pr-4">
                            {exercise.name || "Übung"}
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Scrollable Body */}
                    <div className="overflow-y-auto flex-1 bg-zinc-950 overscroll-contain">

                        {/* Image Section */}
                        <div className="w-full aspect-video bg-zinc-800 border border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-2xl flex items-center justify-center relative overflow-hidden shrink-0">
                            {imageUrl ? (
                                <img
                                    src={imageUrl}
                                    alt={exercise.name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center text-zinc-700 gap-2">
                                    <Info size={40} />
                                    <span className="text-sm">Kein Bild verfügbar</span>
                                </div>
                            )}
                        </div>

                        {/* Content Section */}
                        <div className="p-6 space-y-6 pb-20">

                            {/* Muscles */}
                            {exercise.primaryMuscles && exercise.primaryMuscles.length > 0 && (
                                <div>
                                    <div className="flex flex-wrap gap-2">
                                        {exercise.primaryMuscles.map((m) => (
                                            <MuscleBadge key={m} muscle={m} />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Instructions */}
                            <div>
                                <h4 className="text-sm font-bold text-zinc-500 uppercase mt-6 mb-2 tracking-wider">
                                    Anleitung
                                </h4>
                                <div className="text-zinc-400 leading-relaxed whitespace-pre-wrap text-base">
                                    {instructions ? (
                                        instructions
                                    ) : (
                                        <span className="text-zinc-600 italic">Keine Anleitung verfügbar.</span>
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
