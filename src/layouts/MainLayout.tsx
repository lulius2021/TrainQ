import React from "react";
import { NavBar } from "../components/NavBar";
import type { TabKey } from "../types";

interface MainLayoutProps {
    children: React.ReactNode;
    activeTab: TabKey;
    onTabChange: (tab: TabKey) => void;
    showNavBar?: boolean;
    floatingWidget?: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
    children,
    activeTab,
    onTabChange,
    showNavBar = true,
    floatingWidget
}) => {
    return (
        <div className="relative flex h-full w-full flex-col overflow-hidden font-[SF Pro Display,sans-serif]"
            style={{ background: "transparent", color: "var(--text)" }}>
            {/* Main Content Area */}
            <main
                className="flex-1 overflow-y-auto overflow-x-hidden w-full pt-[env(safe-area-inset-top)] pb-[120px]"
                style={{
                    // Force hardware acceleration for smooth scrolling
                    WebkitOverflowScrolling: "touch",
                }}
            >
                <div className="mx-auto w-full max-w-md px-5">
                    {children}
                </div>
            </main>

            {/* Floating Widget Area */}
            {floatingWidget}

            {/* Fixed Navigation */}
            {showNavBar && (
                <NavBar activeTab={activeTab} onChange={onTabChange} />
            )}
        </div>
    );
};
