import React, { useEffect, useRef, useState, useCallback } from "react";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { BottomSheet } from "../common/BottomSheet";

type Props = {
    open: boolean;
    onClose: () => void;
    initialSeconds?: number;
    onSave: (seconds: number) => void;
};

const ITEM_H = 46;
const VISIBLE = 5; // rows visible in picker
const PICKER_H = ITEM_H * VISIBLE;

function DrumPicker({
    items,
    value,
    onChange,
    label,
}: {
    items: string[];
    value: string;
    onChange: (v: string) => void;
    label: string;
}) {
    const listRef = useRef<HTMLDivElement>(null);
    const currentIndexRef = useRef(items.indexOf(value));
    const touchStartY = useRef(0);
    const touchStartScroll = useRef(0);
    const lastHapticIndex = useRef(-1);
    const isSettlingRef = useRef(false);

    // Scroll to selected index
    const scrollToIndex = useCallback((idx: number, smooth = true) => {
        if (!listRef.current) return;
        listRef.current.scrollTo({ top: idx * ITEM_H, behavior: smooth ? "smooth" : "instant" });
    }, []);

    // Sync scroll when value changes externally
    useEffect(() => {
        const idx = items.indexOf(value);
        if (idx !== -1) {
            currentIndexRef.current = idx;
            scrollToIndex(idx, false);
        }
    }, [value, items, scrollToIndex]);

    const snapToNearest = useCallback(() => {
        if (!listRef.current) return;
        const raw = listRef.current.scrollTop;
        const idx = Math.round(raw / ITEM_H);
        const clamped = Math.max(0, Math.min(items.length - 1, idx));
        currentIndexRef.current = clamped;
        scrollToIndex(clamped, true);
        if (items[clamped] !== value) {
            onChange(items[clamped]);
        }
    }, [items, value, onChange, scrollToIndex]);

    const onTouchStart = (e: React.TouchEvent) => {
        if (!listRef.current) return;
        isSettlingRef.current = false;
        touchStartY.current = e.touches[0].clientY;
        touchStartScroll.current = listRef.current.scrollTop;
    };

    const onTouchMove = (e: React.TouchEvent) => {
        if (!listRef.current) return;
        e.stopPropagation();
        const dy = touchStartY.current - e.touches[0].clientY;
        listRef.current.scrollTop = touchStartScroll.current + dy;

        // Haptic feedback as user scrolls over items
        const raw = listRef.current.scrollTop;
        const idx = Math.round(raw / ITEM_H);
        if (idx !== lastHapticIndex.current) {
            lastHapticIndex.current = idx;
            Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
        }
    };

    const onTouchEnd = () => {
        isSettlingRef.current = true;
        snapToNearest();
    };

    // Also handle scroll (mouse wheel / momentum)
    const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const onScroll = () => {
        if (isSettlingRef.current) return;
        if (scrollTimer.current) clearTimeout(scrollTimer.current);
        scrollTimer.current = setTimeout(() => {
            isSettlingRef.current = false;
            snapToNearest();
        }, 120);
    };

    return (
        <div className="flex flex-col items-center gap-1.5">
            <span className="text-[13px] font-bold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
                {label}
            </span>
            <div className="relative" style={{ width: 88, height: PICKER_H }}>
                {/* Selection highlight — lowest layer, behind text */}
                <div
                    className="pointer-events-none absolute left-0 right-0"
                    style={{
                        top: ITEM_H * 2,
                        height: ITEM_H,
                        background: "var(--button-bg)",
                        borderRadius: 10,
                        zIndex: 1,
                    }}
                />
                {/* Scroll list — above highlight so text is visible */}
                <div
                    ref={listRef}
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                    onScroll={onScroll}
                    style={{
                        height: PICKER_H,
                        overflowY: "scroll",
                        scrollbarWidth: "none",
                        WebkitOverflowScrolling: "touch" as any,
                        position: "relative",
                        zIndex: 2,
                    }}
                >
                    {/* Top spacer */}
                    <div style={{ height: ITEM_H * 2 }} />
                    {items.map((item) => {
                        const isSelected = item === value;
                        return (
                            <div
                                key={item}
                                style={{
                                    height: ITEM_H,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: isSelected ? 26 : 22,
                                    fontWeight: isSelected ? 700 : 400,
                                    color: isSelected ? "var(--text-color)" : "var(--text-secondary)",
                                    transition: "font-size 0.15s, font-weight 0.15s",
                                    userSelect: "none",
                                }}
                            >
                                {item}
                            </div>
                        );
                    })}
                    {/* Bottom spacer */}
                    <div style={{ height: ITEM_H * 2 }} />
                </div>
                {/* Fades — above scroll list text, fixed to picker viewport (not scrolling) */}
                <div
                    className="pointer-events-none absolute inset-x-0 top-0"
                    style={{
                        height: ITEM_H * 2,
                        background: "linear-gradient(to bottom, var(--card-bg) 0%, transparent 100%)",
                        zIndex: 3,
                    }}
                />
                <div
                    className="pointer-events-none absolute inset-x-0 bottom-0"
                    style={{
                        height: ITEM_H * 2,
                        background: "linear-gradient(to top, var(--card-bg) 0%, transparent 100%)",
                        zIndex: 3,
                    }}
                />
            </div>
        </div>
    );
}

export default function RestTimerModal({ open, onClose, initialSeconds = 90, onSave }: Props) {
    const [minutes, setMinutes] = useState("1");
    const [seconds, setSeconds] = useState("30");

    useEffect(() => {
        if (open) {
            const m = Math.min(15, Math.max(0, Math.floor(initialSeconds / 60)));
            const s = initialSeconds % 60;
            setMinutes(String(m));
            setSeconds(String(s).padStart(2, "0"));
        }
    }, [open, initialSeconds]);

    const minOptions = Array.from({ length: 16 }, (_, i) => String(i));
    const secOptions = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

    const handleApply = () => {
        const m = parseInt(minutes, 10) || 0;
        const s = parseInt(seconds, 10) || 0;
        onSave(m * 60 + s);
        onClose();
    };

    const totalSec = (parseInt(minutes, 10) || 0) * 60 + (parseInt(seconds, 10) || 0);
    const preview = totalSec > 0
        ? `${parseInt(minutes, 10)}:${seconds}`
        : "0:00";

    const PRESETS = [
        { label: "1:00", seconds: 60 },
        { label: "1:30", seconds: 90 },
        { label: "2:00", seconds: 120 },
        { label: "3:00", seconds: 180 },
    ];

    const applyPreset = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        setMinutes(String(m));
        setSeconds(String(s).padStart(2, "0"));
        onSave(sec);
        onClose();
    };

    return (
        <BottomSheet
            open={open}
            onClose={onClose}
            height="auto"
            maxHeight="60dvh"
            footer={
                <div className="px-4 pt-3 pb-2 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3.5 rounded-2xl font-bold text-[15px] border transition-all active:scale-[0.97]"
                        style={{ borderColor: "var(--border-color)", color: "var(--text-secondary)", backgroundColor: "var(--button-bg)" }}
                    >
                        Abbrechen
                    </button>
                    <button
                        onClick={handleApply}
                        className="flex-1 py-3.5 rounded-2xl font-bold text-[15px] text-white transition-all active:scale-[0.97]"
                        style={{ backgroundColor: "#007AFF", boxShadow: "0 4px 16px rgba(0,122,255,0.35)" }}
                    >
                        Fertig
                    </button>
                </div>
            }
        >
            <div className="px-5 pt-2 pb-2">
                {/* Header */}
                <div className="flex items-baseline justify-between mb-4">
                    <h2 className="text-[22px] font-black" style={{ color: "var(--text-color)" }}>Pausenzeit</h2>
                    <span className="text-[28px] font-black tabular-nums" style={{ color: "#007AFF" }}>{preview}</span>
                </div>

                {/* Quick presets */}
                <div className="flex gap-2 mb-5">
                    {PRESETS.map((p) => (
                        <button
                            key={p.seconds}
                            onClick={() => applyPreset(p.seconds)}
                            className="flex-1 py-2 rounded-xl font-bold text-[14px] transition-all active:scale-[0.95]"
                            style={{ backgroundColor: "var(--button-bg)", color: "var(--text-color)", border: "1px solid var(--border-color)" }}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                {/* Drum pickers */}
                <div className="flex items-center justify-center gap-6">
                    <DrumPicker
                        label="Min"
                        items={minOptions}
                        value={minutes}
                        onChange={setMinutes}
                    />
                    <span className="text-[32px] font-black mb-4" style={{ color: "var(--text-color)" }}>:</span>
                    <DrumPicker
                        label="Sek"
                        items={secOptions}
                        value={seconds}
                        onChange={setSeconds}
                    />
                </div>
            </div>
        </BottomSheet>
    );
}
