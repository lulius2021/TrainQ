// SegmentedControl — the one shared tab picker for all multi-view screens.
//
// Replaces all ad-hoc pill tab implementations (ChallengesPage, etc.).
// Matches iOS segmented control proportions: 32px height, 10px outer radius, 8px inner radius.
//
// Usage:
//   <SegmentedControl
//     options={[
//       { label: "Aktiv", value: "active", count: 3 },
//       { label: "Abgeschlossen", value: "done" },
//       { label: "Entdecken", value: "discover" },
//     ]}
//     value={activeTab}
//     onChange={setActiveTab}
//   />

import React from "react";

export interface SegmentOption {
    label: string;
    value: string;
    /** Optional numeric badge shown at reduced opacity next to the label. */
    count?: number;
}

interface SegmentedControlProps {
    options: SegmentOption[];
    value: string;
    onChange: (value: string) => void;
    /** Additional Tailwind classes on the outer container. */
    className?: string;
}

export function SegmentedControl({ options, value, onChange, className }: SegmentedControlProps) {
    return (
        <div
            role="tablist"
            className={`flex bg-[var(--button-bg)] rounded-[10px] p-[3px] gap-[2px]${className ? ` ${className}` : ""}`}
            style={{ height: 32 }}
        >
            {options.map((opt) => {
                const active = opt.value === value;
                return (
                    <button
                        key={opt.value}
                        role="tab"
                        aria-selected={active}
                        onClick={() => onChange(opt.value)}
                        className={[
                            "flex-1 rounded-[8px] text-[13px] font-semibold",
                            "flex items-center justify-center gap-1",
                            "transition-all duration-150",
                            active
                                ? "bg-[var(--card-bg)] text-[var(--text-color)] shadow-sm"
                                : "text-[var(--text-secondary)]",
                        ].join(" ")}
                    >
                        {opt.label}
                        {opt.count !== undefined && (
                            <span className="text-[12px] opacity-60">{opt.count}</span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
