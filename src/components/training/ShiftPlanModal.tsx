import React, { useState } from 'react';
import { Calendar, ArrowRight } from 'lucide-react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useI18n } from '../../i18n/useI18n';
import { BottomSheet } from '../common/BottomSheet';

interface ShiftPlanModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (days: number) => void;
}

const ShiftPlanModal: React.FC<ShiftPlanModalProps> = ({ isOpen, onClose, onConfirm }) => {
    const { t } = useI18n();
    const [selectedDays, setSelectedDays] = useState<number>(1);

    const options = [
        { label: t('shiftPlan.oneDay'), value: 1 },
        { label: t('shiftPlan.twoDays'), value: 2 },
        { label: t('shiftPlan.threeDays'), value: 3 },
        { label: t('shiftPlan.oneWeek'), value: 7 },
    ];

    const handleConfirm = () => {
        try { Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {}); } catch { }
        onConfirm(selectedDays);
    };

    return (
        <BottomSheet
            open={isOpen}
            onClose={onClose}
            height="auto"
            maxHeight="60dvh"
            footer={
                <div className="px-4 pt-3 pb-2">
                    <button
                        onClick={handleConfirm}
                        className="w-full py-3.5 rounded-2xl font-bold text-[15px] text-white active:scale-[0.97] transition-all"
                        style={{ backgroundColor: "#007AFF", boxShadow: "0 4px 16px rgba(0,122,255,0.35)" }}
                    >
                        {t('shiftPlan.confirm')}
                    </button>
                </div>
            }
        >
            <div className="px-5 pt-2 pb-4 space-y-5">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "rgba(0,122,255,0.12)", color: "#007AFF" }}>
                        <Calendar size={20} />
                    </div>
                    <div>
                        <h2 className="text-[20px] font-black leading-tight" style={{ color: "var(--text-color)" }}>{t('shiftPlan.title')}</h2>
                        <p className="text-[13px] mt-0.5" style={{ color: "var(--text-secondary)" }}>{t('shiftPlan.subtitle')}</p>
                    </div>
                </div>

                {/* Options */}
                <div className="grid grid-cols-2 gap-2.5">
                    {options.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => setSelectedDays(opt.value)}
                            className="w-full py-4 rounded-2xl font-bold text-[15px] transition-all active:scale-[0.96]"
                            style={{
                                backgroundColor: selectedDays === opt.value ? "#007AFF" : "var(--button-bg)",
                                color: selectedDays === opt.value ? "#fff" : "var(--text-color)",
                                boxShadow: selectedDays === opt.value ? "0 4px 12px rgba(0,122,255,0.3)" : "none",
                            }}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                {/* Info */}
                <div className="rounded-2xl p-3.5 flex items-start gap-3" style={{ backgroundColor: "var(--button-bg)" }}>
                    <ArrowRight size={15} className="shrink-0 mt-0.5" style={{ color: "var(--text-secondary)" }} />
                    <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                        {t('shiftPlan.infoPrefix')}{' '}
                        <span className="font-bold" style={{ color: "var(--text-color)" }}>{t('shiftPlan.fromToday')}</span>{' '}
                        {t('shiftPlan.infoMid')}{' '}
                        <span className="font-bold" style={{ color: "#007AFF" }}>
                            {selectedDays} {selectedDays === 1 ? t('shiftPlan.day') : t('shiftPlan.days')}
                        </span>{' '}
                        {t('shiftPlan.infoSuffix')}
                    </p>
                </div>
            </div>
        </BottomSheet>
    );
};

export default ShiftPlanModal;
