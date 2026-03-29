import React from "react";
import { BottomNav as NavBar } from "../components/layout/BottomNav";
import { useModalStore } from "../store/useModalStore";
import type { TabKey } from "../types";

interface MainLayoutProps {
    children: React.ReactNode;
    activeTab: TabKey;
    onTabChange: (tab: TabKey) => void;
    /** Called when the already-active tab is tapped — scroll-to-top signal. */
    onActiveTap?: (tab: TabKey) => void;
    showNavBar?: boolean;
    floatingWidget?: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
    children,
    activeTab,
    onTabChange,
    onActiveTap,
    showNavBar = true,
    floatingWidget
}) => {
    const modalOpen = useModalStore((s) => s.openCount > 0);

    return (
        <div className="relative flex h-full w-full flex-col overflow-hidden font-sans" style={{ backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}>
            {/* Main Content Area — tabs own their own scroll via absolute positioning */}
            <main
                className="flex-1 relative overflow-hidden w-full"
                style={{ backgroundColor: "var(--bg-color)", overflow: modalOpen ? "hidden" : undefined, pointerEvents: modalOpen ? "none" : undefined }}
            >
                {children}
            </main>

            {/* Floating Widget Area */}
            {floatingWidget}

            {/* Fixed Navigation */}
            {showNavBar && (
                <NavBar activeTab={activeTab} onChange={onTabChange} onActiveTap={onActiveTap} />
            )}
        </div>
    );
};
