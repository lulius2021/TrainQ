import React, { useEffect, useRef } from "react";
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
    const mainRef = useRef<HTMLElement>(null);
    // All tabs are edge-to-edge — no title headers, pages handle their own spacing
    const isEdgeToEdge = true;

    // Scroll to top when switching tabs
    useEffect(() => {
        if (mainRef.current) {
            mainRef.current.scrollTop = 0;
        }
    }, [activeTab]);

    return (
        <div className="relative flex h-full w-full flex-col overflow-hidden font-sans" style={{ backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}>
            {/* Main Content Area */}
            <main
                ref={mainRef}
                className={`flex-1 overflow-y-auto overflow-x-hidden w-full ${isEdgeToEdge ? "pb-[100px] pt-0" : "pt-[env(safe-area-inset-top)] pb-[120px]"}`}
                style={{
                    WebkitOverflowScrolling: "touch",
                    backgroundColor: "var(--bg-color)",
                }}
            >
                <div className={`mx-auto w-full ${isEdgeToEdge ? "h-full px-0 max-w-none" : "max-w-md px-5"}`}>
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
