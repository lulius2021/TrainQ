import React, { useEffect, useRef, useState } from "react";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { useI18n } from "../../i18n/useI18n";
import { useTheme } from "../../context/ThemeContext";

type Props = {
    open: boolean;
    onClose: () => void;
    initialSeconds?: number;
    onSave: (seconds: number) => void;
};

const ITEM_HEIGHT = 44; // Height of each picker item

function PickerColumn({
    items,
    value,
    onChange,
    label,
}: {
    items: string[];
    value: string;
    onChange: (val: string) => void;
    label?: string;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const isScrollingRef = useRef(false);

    useEffect(() => {
        if (!containerRef.current) return;
        if (isScrollingRef.current) return;

        const idx = items.indexOf(value);
        if (idx !== -1) {
            containerRef.current.scrollTop = idx * ITEM_HEIGHT;
        }
    }, [value, items]);

    const handleScroll = () => {
        if (!containerRef.current) return;
        isScrollingRef.current = true;

        const scrollTop = containerRef.current.scrollTop;
        const index = Math.round(scrollTop / ITEM_HEIGHT);
        const clampedIndex = Math.max(0, Math.min(items.length - 1, index));
        const newValue = items[clampedIndex];

        if (newValue !== value) {
            Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
            onChange(newValue);
        }

        clearTimeout((containerRef.current as any)._scrollTimer);
        (containerRef.current as any)._scrollTimer = setTimeout(() => {
            isScrollingRef.current = false;
            if (containerRef.current) {
                containerRef.current.scrollTo({
                    top: clampedIndex * ITEM_HEIGHT,
                    behavior: "smooth"
                });
            }
        }, 150);
    };

    return (
        <div className="flex flex-col items-center">
            {label && <div className="mb-2 text-xs font-semibold uppercase tracking-wider opacity-60">{label}</div>}
            <div className="relative h-[220px] w-24 overflow-hidden rounded-xl bg-black/5 dark:bg-white/5">
                {/* Selection Highlight */}
                <div
                    className="pointer-events-none absolute left-0 right-0 top-1/2 -mt-[22px] h-[44px] border-t border-b border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5"
                    style={{ zIndex: 10 }}
                />

                <div
                    ref={containerRef}
                    onScroll={handleScroll}
                    className="h-full w-full overflow-y-auto snap-y snap-mandatory scrollbar-hide"
                    style={{
                        scrollBehavior: "smooth",
                        scrollbarWidth: "none",
                        msOverflowStyle: "none"
                    }}
                >
                    <div style={{ height: ITEM_HEIGHT * 2 }} />
                    {items.map((item) => (
                        <div
                            key={item}
                            className="flex items-center justify-center snap-center text-2xl font-semibold transition-opacity duration-200"
                            style={{
                                height: ITEM_HEIGHT,
                                opacity: value === item ? 1 : 0.3,
                                transform: value === item ? "scale(1.1)" : "scale(1)"
                            }}
                        >
                            {item}
                        </div>
                    ))}
                    <div style={{ height: ITEM_HEIGHT * 2 }} />
                </div>
            </div>
        </div>
    );
}

export default function RestTimerModal({ open, onClose, initialSeconds = 90, onSave }: Props) {
    const { t } = useI18n();
    const { mode } = useTheme();
    const isLight = mode === "light";

    const [minutes, setMinutes] = useState("1");
    const [seconds, setSeconds] = useState("30");

    // Init on open
    useEffect(() => {
        if (open) {
            const m = Math.floor(initialSeconds / 60);
            const s = initialSeconds % 60;
            // Force 0-15 min range logic
            const safeM = Math.min(15, Math.max(0, m));
            setMinutes(String(safeM));
            setSeconds(String(s).padStart(2, "0"));
        }
    }, [open, initialSeconds]);

    // Arrays: 0-15 min, 00-59 sec
    // 0-15 min
    const minOptions = Array.from({ length: 16 }, (_, i) => String(i));
    // 00-59 sec
    const secOptions = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

    const handleApply = () => {
        const m = parseInt(minutes, 10) || 0;
        const s = parseInt(seconds, 10) || 0;
        const total = m * 60 + s;
        onSave(total);
        onClose();
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center bg-black/60 px-4 pb-6 sm:pb-0" data-overlay-open="true">
            <div className="absolute inset-0" onClick={onClose} />

            <div
                className="relative z-10 w-full max-w-sm overflow-hidden rounded-3xl shadow-2xl transition-all"
                style={{
                    background: isLight ? "#ffffff" : "#1e293b",
                    color: isLight ? "#0f172a" : "#f8fafc"
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-black/5 p-4 dark:border-white/5">
                    <button onClick={onClose} className="text-sm font-semibold opacity-70 hover:opacity-100">
                        {t("common.cancel")}
                    </button>
                    <div className="text-base font-bold">{t("training.exercise.rest")}</div>
                    <button
                        onClick={handleApply}
                        className="text-sm font-bold text-blue-500 hover:text-blue-600 dark:text-blue-400"
                    >
                        {t("common.done")}
                    </button>
                </div>

                {/* Pickers */}
                <div className="flex justify-center gap-2 py-8 relative">
                    <PickerColumn
                        // label={t("training.units.min")}
                        items={minOptions}
                        value={minutes}
                        onChange={setMinutes}
                    />

                    {/* Colon Separator - vertically centered */}
                    <div className="flex h-[220px] items-center pb-2 text-3xl font-bold opacity-80">:</div>

                    <PickerColumn
                        // label={t("training.units.secShort")}
                        items={secOptions}
                        value={seconds}
                        onChange={setSeconds}
                    />

                    {/* Unit Labels if needed, or stick to clean Apple Clock style (just numbers) */}
                    {/* The prompt says: "Links: Minuten (0-15). Mitte: Trennzeichen Doppelpunkt :. Rechts: Sekunden (00-59)." */}
                    {/* Visual: "Auswahl ... sieht wie eine Apple-Uhr aus (z.B. 1:11)." */}
                </div>
            </div>
        </div>
    );
}
