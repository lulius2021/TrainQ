import React, { useRef, useEffect, useState, memo } from 'react';

interface WheelPickerProps {
    value: number;
    onChange: (value: number) => void;
    options: number[];
    unit?: string;
    height?: number;
    itemHeight?: number;
}

const WheelPicker: React.FC<WheelPickerProps> = memo(({
    value,
    onChange,
    options,
    unit = '',
    height = 200,
    itemHeight = 40
}) => {
    const scrollerRef = useRef<HTMLDivElement>(null);
    const isScrolling = useRef(false);
    const [localValue, setLocalValue] = useState(value);

    // Sync external value change to scroll position (only if not scrolling)
    useEffect(() => {
        if (isScrolling.current) return;
        setLocalValue(value);
        const index = options.indexOf(value);
        if (index !== -1 && scrollerRef.current) {
            scrollerRef.current.scrollTop = index * itemHeight;
        }
    }, [value, options, itemHeight]);

    const handleScroll = () => {
        if (!scrollerRef.current) return;
        const scrollTop = scrollerRef.current.scrollTop;
        const index = Math.round(scrollTop / itemHeight);
        const clampedIndex = Math.max(0, Math.min(index, options.length - 1));
        const newValue = options[clampedIndex];

        if (newValue !== localValue) {
            setLocalValue(newValue);
            onChange(newValue);
        }
    };

    const handleScrollStart = () => { isScrolling.current = true; };
    const handleScrollEnd = () => {
        isScrolling.current = false;
        // Native CSS snap handles the alignment.
        // We just ensure the final value is synced.
        if (scrollerRef.current) {
            const scrollTop = scrollerRef.current.scrollTop;
            const index = Math.round(scrollTop / itemHeight);
            const clampedIndex = Math.max(0, Math.min(index, options.length - 1));
            const newValue = options[clampedIndex];
            if (newValue !== localValue) {
                setLocalValue(newValue);
                onChange(newValue);
            }
        }
    };

    // Calculate center overlay items
    const overlayTop = (height - itemHeight) / 2;

    return (
        <div className="relative w-full overflow-hidden select-none touch-pan-y" style={{ height }}>
            {/* Selection Highlight */}
            <div
                className="absolute left-0 right-0 z-10 pointer-events-none border-t border-b border-white/10 bg-white/5"
                style={{ top: overlayTop, height: itemHeight }}
            />

            {/* Gradients */}
            <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-[#1c1c1e] to-transparent z-20 pointer-events-none" />
            <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-[#1c1c1e] to-transparent z-20 pointer-events-none" />

            {/* Scroll Container */}
            <div
                ref={scrollerRef}
                className="absolute inset-0 overflow-y-auto no-scrollbar snap-y snap-mandatory"
                style={{ paddingTop: overlayTop, paddingBottom: overlayTop }}
                onScroll={handleScroll}
                onTouchStart={handleScrollStart}
                onTouchEnd={handleScrollEnd}
                onMouseDown={handleScrollStart}
                onMouseUp={handleScrollEnd}
            >
                {options.map((opt, i) => (
                    <div
                        key={opt}
                        className={`
                            flex items-center justify-center snap-center transition-opacity duration-200
                            ${opt === localValue ? 'text-white font-bold text-xl' : 'text-zinc-500 text-base scale-95'}
                        `}
                        style={{ height: itemHeight }}
                    >
                        {opt}{unit}
                    </div>
                ))}
            </div>
        </div>
    );
});

export default WheelPicker;
