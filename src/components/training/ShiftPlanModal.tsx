import React, { useState } from 'react';
import { Calendar, ChevronRight, X, ArrowRight } from 'lucide-react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

interface ShiftPlanModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (days: number) => void;
}

const ShiftPlanModal: React.FC<ShiftPlanModalProps> = ({ isOpen, onClose, onConfirm }) => {
    const [selectedDays, setSelectedDays] = useState<number>(1);

    if (!isOpen) return null;

    const options = [
        { label: '+1 Tag', value: 1 },
        { label: '+2 Tage', value: 2 },
        { label: '+3 Tage', value: 3 },
        { label: '+1 Woche', value: 7 },
    ];

    const handleConfirm = async () => {
        try {
            await Haptics.impact({ style: ImpactStyle.Medium });
        } catch { }
        onConfirm(selectedDays);
    };

    const handleSelect = async (val: number) => {
        try {
            await Haptics.impact({ style: ImpactStyle.Light });
        } catch { }
        setSelectedDays(val);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center pointer-events-none p-0 sm:p-4">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/80 backdrop-blur-sm pointer-events-auto transition-opacity animate-in fade-in"
                onClick={onClose}
            />

            {/* Sheet */}
            <div
                className="relative w-full max-w-sm bg-[#1c1c1e] rounded-[32px] p-6 pb-8 shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 pointer-events-auto border border-white/10 ring-1 ring-white/5"
                style={{ marginBottom: 'calc(100px + env(safe-area-inset-bottom))' }} // 100px bottom offset per Logic
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-500">
                            <Calendar size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white leading-tight">Plan verschieben</h3>
                            <p className="text-xs text-zinc-400">Ausfall kompensieren</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white">
                        <X size={18} />
                    </button>
                </div>

                {/* Input Grid */}
                <div className="grid grid-cols-2 gap-3 mb-8">
                    {options.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => handleSelect(opt.value)}
                            className={`p-4 rounded-xl border font-bold text-sm transition-all active:scale-95 ${selectedDays === opt.value
                                    ? 'bg-white text-black border-white shadow-lg'
                                    : 'bg-zinc-800 text-zinc-300 border-zinc-700/50 hover:bg-zinc-700'
                                }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                    {/* Custom Input Placeholder if needed later, currently logic handles pure numbers */}
                </div>

                {/* Info Text */}
                <div className="bg-zinc-800/50 rounded-xl p-4 mb-6 border border-white/5">
                    <div className="flex items-start gap-3">
                        <div className="mt-1 min-w-[16px]">
                            <ArrowRight size={16} className="text-zinc-500" />
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                            Alle geplanten Trainings <span className="text-zinc-200 font-bold">ab heute</span> werden um <span className="text-white font-bold">{selectedDays} {selectedDays === 1 ? 'Tag' : 'Tage'}</span> nach hinten geschoben.
                        </p>
                    </div>
                </div>

                {/* Confirm Button */}
                <button
                    onClick={handleConfirm}
                    className="w-full py-4 rounded-2xl bg-blue-600 text-white font-bold text-base hover:bg-blue-500 active:scale-[0.98] transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                >
                    Bestätigen
                </button>

            </div>
        </div>
    );
};

export default ShiftPlanModal;
