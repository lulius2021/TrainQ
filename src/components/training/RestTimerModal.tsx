import React, { useEffect, useState } from "react";
import { hapticLight } from "../../native/haptics";
import { BottomSheet } from "../common/BottomSheet";
import { useI18n } from "../../i18n/useI18n";

type Props = {
    open: boolean;
    onClose: () => void;
    initialSeconds?: number;
    onSave: (seconds: number) => void;
};

const minOptions = Array.from({ length: 16 }, (_, i) => i); // 0–15
const secOptions = Array.from({ length: 12 }, (_, i) => i * 5); // 0,5,10...55

export default function RestTimerModal({ open, onClose, initialSeconds = 90, onSave }: Props) {
    const { t } = useI18n();
    const [minutes, setMinutes] = useState(1);
    const [seconds, setSeconds] = useState(30);

    useEffect(() => {
        if (open) {
            const m = Math.min(15, Math.max(0, Math.floor(initialSeconds / 60)));
            const s = Math.round((initialSeconds % 60) / 5) * 5;
            setMinutes(m);
            setSeconds(s);
        }
    }, [open, initialSeconds]);

    const handleApply = () => {
        onSave(minutes * 60 + seconds);
        onClose();
    };

    const preview = `${minutes}:${String(seconds).padStart(2, "0")}`;

    const PRESETS = [
        { label: "1:00", sec: 60 },
        { label: "1:30", sec: 90 },
        { label: "2:00", sec: 120 },
        { label: "3:00", sec: 180 },
    ];

    const applyPreset = (sec: number) => {
        setMinutes(Math.floor(sec / 60));
        setSeconds(sec % 60);
        onSave(sec);
        onClose();
    };

    const selectStyle: React.CSSProperties = {
        appearance: "none",
        WebkitAppearance: "none",
        background: "var(--button-bg)",
        color: "var(--text-color)",
        border: "1px solid var(--border-color)",
        borderRadius: 14,
        fontSize: 28,
        fontWeight: 700,
        textAlign: "center",
        textAlignLast: "center",
        padding: "12px 8px",
        width: 100,
        cursor: "pointer",
    };

    return (
        <BottomSheet
            open={open}
            onClose={onClose}
            height="auto"
            maxHeight="55dvh"
            footer={
                <div className="px-4 pt-3 pb-2 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3.5 rounded-2xl font-bold text-[15px] border transition-all active:scale-[0.97]"
                        style={{ borderColor: "var(--border-color)", color: "var(--text-secondary)", backgroundColor: "var(--button-bg)" }}
                    >
                        {t("common.cancel")}
                    </button>
                    <button
                        onClick={handleApply}
                        className="flex-1 py-3.5 rounded-2xl font-bold text-[15px] text-white transition-all active:scale-[0.97]"
                        style={{ backgroundColor: "#007AFF", boxShadow: "0 4px 16px rgba(0,122,255,0.35)" }}
                    >
                        {t("common.done")}
                    </button>
                </div>
            }
        >
            <div className="px-5 pt-2 pb-4">
                {/* Header */}
                <div className="flex items-baseline justify-between mb-5">
                    <h2 className="text-[22px] font-black" style={{ color: "var(--text-color)" }}>{t("training.rest.title")}</h2>
                    <span className="text-[28px] font-black tabular-nums" style={{ color: "#007AFF" }}>{preview}</span>
                </div>

                {/* Quick presets */}
                <div className="flex gap-2 mb-6">
                    {PRESETS.map((p) => {
                        const isActive = p.sec === minutes * 60 + seconds;
                        return (
                            <button
                                key={p.sec}
                                onClick={() => applyPreset(p.sec)}
                                className="flex-1 py-2.5 rounded-xl font-bold text-[14px] transition-all active:scale-[0.95]"
                                style={{
                                    backgroundColor: isActive ? "#007AFF" : "var(--button-bg)",
                                    color: isActive ? "#fff" : "var(--text-color)",
                                    border: `1px solid ${isActive ? "#007AFF" : "var(--border-color)"}`,
                                }}
                            >
                                {p.label}
                            </button>
                        );
                    })}
                </div>

                {/* Native select pickers */}
                <div className="flex items-center justify-center gap-3">
                    <div className="flex flex-col items-center gap-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>{t("training.rest.min")}</span>
                        <select
                            value={minutes}
                            onChange={(e) => { setMinutes(Number(e.target.value)); hapticLight(); }}
                            style={selectStyle}
                        >
                            {minOptions.map((m) => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                    </div>

                    <span className="text-[36px] font-black mt-5" style={{ color: "var(--text-color)" }}>:</span>

                    <div className="flex flex-col items-center gap-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>{t("training.rest.sec")}</span>
                        <select
                            value={seconds}
                            onChange={(e) => { setSeconds(Number(e.target.value)); hapticLight(); }}
                            style={selectStyle}
                        >
                            {secOptions.map((s) => (
                                <option key={s} value={s}>{String(s).padStart(2, "0")}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>
        </BottomSheet>
    );
}
