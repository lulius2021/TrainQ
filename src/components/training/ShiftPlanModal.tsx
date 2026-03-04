import React, { useState } from 'react';
import { Calendar, X, ArrowRight } from 'lucide-react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useSafeAreaInsets } from '../../hooks/useSafeAreaInsets';
import { useI18n } from '../../i18n/useI18n';

interface ShiftPlanModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (days: number) => void;
}

const ShiftPlanModal: React.FC<ShiftPlanModalProps> = ({ isOpen, onClose, onConfirm }) => {
    const { t } = useI18n();
    const [selectedDays, setSelectedDays] = useState<number>(1);
    const insets = useSafeAreaInsets();

    if (!isOpen) return null;

    const options = [
        { label: t('shiftPlan.oneDay'), value: 1 },
        { label: t('shiftPlan.twoDays'), value: 2 },
        { label: t('shiftPlan.threeDays'), value: 3 },
        { label: t('shiftPlan.oneWeek'), value: 7 },
    ];

    const handleConfirm = () => {
        try {
            Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
        } catch { }
        onConfirm(selectedDays);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div
                className="relative w-full max-w-sm max-h-[85vh] rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 border border-[var(--border-color)] flex flex-col"
                style={{ backgroundColor: "var(--modal-bg)" }}
            >
                {/* Fixed Header */}
                <div className="flex items-center justify-between p-6 pb-2 z-10" style={{ backgroundColor: "var(--modal-bg)" }}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-500">
                            <Calendar size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold leading-tight" style={{ color: "var(--text-color)" }}>{t('shiftPlan.title')}</h3>
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t('shiftPlan.subtitle')}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity" style={{ backgroundColor: "var(--button-bg)", color: "var(--text-muted)" }}>
                        <X size={18} />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div
                    className="flex-1 overflow-y-auto px-6 pt-4 pb-[160px] overscroll-contain"
                    style={{ scrollbarWidth: 'none' }}
                >
                    {/* Input Grid */}
                    <div className="grid grid-cols-2 gap-3 mb-8 place-items-center w-full">
                        {options.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => setSelectedDays(opt.value)}
                                className={`w-full p-4 rounded-2xl border font-bold text-sm transition-all active:scale-95 text-center ${selectedDays === opt.value
                                    ? 'shadow-lg'
                                    : 'hover:opacity-80'
                                    }`}
                                style={{
                                    backgroundColor: selectedDays === opt.value ? 'var(--text-color)' : 'var(--button-bg)',
                                    color: selectedDays === opt.value ? 'var(--bg-color)' : 'var(--text-muted)',
                                    borderColor: selectedDays === opt.value ? 'var(--text-color)' : 'var(--border-color)'
                                }}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {/* Info Text */}
                    <div className="rounded-2xl p-4 mb-6 border border-[var(--border-color)]" style={{ backgroundColor: "var(--card-bg)" }}>
                        <div className="flex items-start gap-3">
                            <div className="mt-1 min-w-[16px]">
                                <ArrowRight size={16} style={{ color: "var(--text-muted)" }} />
                            </div>
                            <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                                {t('shiftPlan.infoPrefix')} <span className="font-bold" style={{ color: "var(--text-color)" }}>{t('shiftPlan.fromToday')}</span> {t('shiftPlan.infoMid')} <span className="font-bold" style={{ color: "var(--text-color)" }}>{selectedDays} {selectedDays === 1 ? t('shiftPlan.day') : t('shiftPlan.days')}</span> {t('shiftPlan.infoSuffix')}
                            </p>
                        </div>
                    </div>

                    {/* Confirm Button */}
                    <button
                        onClick={handleConfirm}
                        className="w-full py-4 rounded-2xl bg-blue-600 text-white font-bold text-base hover:bg-blue-500 active:scale-[0.98] transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                    >
                        {t('shiftPlan.confirm')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ShiftPlanModal;
