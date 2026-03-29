// PageNavBar — the one shared navigation bar primitive for all screens.
//
// Four modes:
//   large  — 34px title, used on top-level tab pages (Dashboard, Profile, Plan, Today)
//   inline — 17px title, used on navigated screens without a back label
//   back   — 17px title with a back button, used on screens pushed from a tab
//   modal  — 17px title with an X close button, used on sheets and modal pages
//
// Surface behavior:
//   large / inline / back — transparent at rest; blurred when parent PageScrollContainer
//                           has scrolled past 10px (via .is-scrolled CSS class toggle)
//   modal                 — always blurred (data-mode="modal" triggers the CSS rule)
//
// Safe area:
//   Handled internally via pt-safe. No page may add top padding separately.
//
// Usage:
//   <PageNavBar mode="large" title="Dashboard" rightAction={<NotifButton />} />
//   <PageNavBar mode="back" title="Challenges" onBack={handleBack} />
//   <PageNavBar mode="modal" title="Settings" onBack={onClose} />

import React from "react";
import { ChevronLeft, X } from "lucide-react";

export type NavMode = "large" | "inline" | "back" | "modal";

interface PageNavBarProps {
    /** Visual and behavioral mode. */
    mode: NavMode;
    /** Title text shown in the bar. */
    title: string;
    /** Back / close handler. Required for back and modal modes; ignored for large. */
    onBack?: () => void;
    /** Optional trailing slot — icon buttons, badges, etc. */
    rightAction?: React.ReactNode;
}

export function PageNavBar({ mode, title, onBack, rightAction }: PageNavBarProps) {
    if (mode === "large") {
        return (
            <div className="page-nav-bar sticky top-0 z-10 w-full pt-safe" data-mode={mode}>
                {/* Trailing action row — sits in the 44pt bar area above the large title */}
                <div className="flex items-center justify-end px-4 h-11">
                    {rightAction ?? <div aria-hidden />}
                </div>
                {/* Large title */}
                <div className="px-4 pb-3">
                    <h1
                        className="text-[34px] font-black tracking-tight leading-tight"
                        style={{ color: "var(--text-color)" }}
                    >
                        {title}
                    </h1>
                </div>
            </div>
        );
    }

    // inline / back / modal — compact 44pt bar
    const showBack = (mode === "back" || mode === "inline") && !!onBack;
    const showClose = mode === "modal" && !!onBack;

    return (
        <div className="page-nav-bar sticky top-0 z-10 w-full pt-safe" data-mode={mode}>
            <div className="relative flex items-center justify-between px-4 h-11">
                {/* Left — back button or spacer */}
                {showBack ? (
                    <button
                        onClick={onBack}
                        className="flex items-center -ml-2 h-11 pr-3 shrink-0"
                        style={{ color: "var(--accent-color)" }}
                        aria-label="Zurück"
                    >
                        <ChevronLeft size={28} strokeWidth={2.2} />
                    </button>
                ) : (
                    <div className="w-8 shrink-0" aria-hidden />
                )}

                {/* Center — title, absolutely centered so it doesn't shift with button widths */}
                <span
                    className="absolute left-1/2 -translate-x-1/2 text-[17px] font-semibold truncate max-w-[55%] pointer-events-none"
                    style={{ color: "var(--text-color)" }}
                >
                    {title}
                </span>

                {/* Right — close button, rightAction, or spacer */}
                {showClose ? (
                    <button
                        onClick={onBack}
                        className="w-8 h-8 flex items-center justify-center rounded-full shrink-0"
                        style={{ background: "var(--button-bg)" }}
                        aria-label="Schließen"
                    >
                        <X size={16} style={{ color: "var(--text-secondary)" }} />
                    </button>
                ) : (
                    rightAction ?? <div className="w-8 shrink-0" aria-hidden />
                )}
            </div>
        </div>
    );
}
