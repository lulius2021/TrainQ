import React, { useRef, useEffect, memo } from 'react';

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
    itemHeight = 44
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const stateRef = useRef({
        offsetY: 0,
        velocity: 0,
        animFrame: 0,
        touchStartY: 0,
        touchStartOffset: 0,
        lastTouchY: 0,
        lastTouchTime: 0,
        isDragging: false,
    });
    const propsRef = useRef({ onChange, options, itemHeight, height });
    propsRef.current = { onChange, options, itemHeight, height };

    const centerY = (height - itemHeight) / 2;
    const maxOffset = 0;
    const minOffset = -(options.length - 1) * itemHeight;

    function render() {
        const container = containerRef.current;
        if (!container) return;
        const s = stateRef.current;
        const { itemHeight: ih } = propsRef.current;
        const cy = (propsRef.current.height - ih) / 2;
        const children = container.children;
        for (let i = 0; i < children.length; i++) {
            const el = children[i] as HTMLElement;
            const y = s.offsetY + i * ih;
            const dist = Math.abs(y) / ih;
            const scale = Math.max(0.78, 1 - dist * 0.07);
            const opacity = Math.max(0.2, 1 - dist * 0.35);
            el.style.transform = `translateY(${cy + y}px) scale(${scale})`;
            el.style.opacity = String(opacity);
            el.style.fontWeight = dist < 0.5 ? '700' : '400';
            el.style.fontSize = dist < 0.5 ? '22px' : '17px';
            el.style.color = dist < 0.5 ? 'var(--text-color)' : 'var(--text-secondary)';
        }
    }

    function getSelectedIndex(): number {
        const s = stateRef.current;
        const { options: opts, itemHeight: ih } = propsRef.current;
        const idx = Math.round(-s.offsetY / ih);
        return Math.max(0, Math.min(idx, opts.length - 1));
    }

    function snapToNearest() {
        const s = stateRef.current;
        const { itemHeight: ih, options: opts, onChange: cb } = propsRef.current;
        const idx = getSelectedIndex();
        const target = -idx * ih;
        const start = s.offsetY;

        if (Math.abs(target - start) < 0.5) {
            s.offsetY = target;
            render();
            cb(opts[idx]);
            return;
        }

        const startTime = performance.now();
        const duration = 200; // ms

        function tick(now: number) {
            const elapsed = now - startTime;
            const t = Math.min(elapsed / duration, 1);
            const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
            s.offsetY = start + (target - start) * ease;
            render();
            if (t < 1) {
                s.animFrame = requestAnimationFrame(tick);
            } else {
                s.offsetY = target;
                render();
                cb(opts[idx]);
            }
        }
        cancelAnimationFrame(s.animFrame);
        s.animFrame = requestAnimationFrame(tick);
    }

    function coast() {
        const s = stateRef.current;
        const { options: opts, itemHeight: ih } = propsRef.current;
        const mn = -(opts.length - 1) * ih;

        if (Math.abs(s.velocity) < 0.3) {
            snapToNearest();
            return;
        }

        s.offsetY += s.velocity;

        // Rubber-band at edges
        if (s.offsetY > 0) {
            s.offsetY *= 0.4;
            s.velocity *= 0.4;
        } else if (s.offsetY < mn) {
            s.offsetY = mn + (s.offsetY - mn) * 0.4;
            s.velocity *= 0.4;
        }

        s.velocity *= 0.96;
        render();
        s.animFrame = requestAnimationFrame(coast);
    }

    // Sync from external value prop
    useEffect(() => {
        const s = stateRef.current;
        if (s.isDragging) return;
        const idx = options.indexOf(value);
        if (idx !== -1) {
            s.offsetY = -idx * itemHeight;
            render();
        }
    }, [value, options, itemHeight]);

    // Initial render
    useEffect(() => { render(); }, []);

    function onTouchStart(e: React.TouchEvent) {
        const s = stateRef.current;
        cancelAnimationFrame(s.animFrame);
        s.isDragging = true;
        s.velocity = 0;
        s.touchStartY = e.touches[0].clientY;
        s.touchStartOffset = s.offsetY;
        s.lastTouchY = e.touches[0].clientY;
        s.lastTouchTime = performance.now();
    }

    function onTouchMove(e: React.TouchEvent) {
        const s = stateRef.current;
        if (!s.isDragging) return;
        const { options: opts, itemHeight: ih } = propsRef.current;
        const mn = -(opts.length - 1) * ih;
        const y = e.touches[0].clientY;
        const dy = y - s.touchStartY;
        let next = s.touchStartOffset + dy;

        // Rubber-band
        if (next > 0) next *= 0.35;
        else if (next < mn) next = mn + (next - mn) * 0.35;

        const now = performance.now();
        const dt = now - s.lastTouchTime;
        if (dt > 0) {
            s.velocity = (y - s.lastTouchY) / Math.max(dt, 5) * 16;
        }
        s.lastTouchY = y;
        s.lastTouchTime = now;
        s.offsetY = next;
        render();
    }

    function onTouchEnd() {
        const s = stateRef.current;
        s.isDragging = false;
        s.velocity = Math.max(-30, Math.min(30, s.velocity));
        if (Math.abs(s.velocity) > 1.5) {
            coast();
        } else {
            snapToNearest();
        }
    }

    return (
        <div
            className="relative overflow-hidden select-none"
            style={{ height, touchAction: 'none' }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            {/* Selection highlight */}
            <div
                className="absolute left-1 right-1 z-0 pointer-events-none rounded-xl bg-[var(--button-bg)]"
                style={{ top: centerY - 2, height: itemHeight + 4 }}
            />

            {/* Gradient overlays */}
            <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-[var(--card-bg)] to-transparent z-10 pointer-events-none" />
            <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-[var(--card-bg)] to-transparent z-10 pointer-events-none" />

            {/* Items */}
            <div ref={containerRef} className="absolute inset-0 z-[5]">
                {options.map((opt) => (
                    <div
                        key={opt}
                        className="absolute left-0 right-0 flex items-center justify-center will-change-transform"
                        style={{ height: itemHeight, top: 0 }}
                    >
                        {opt}{unit}
                    </div>
                ))}
            </div>
        </div>
    );
});

export default WheelPicker;
