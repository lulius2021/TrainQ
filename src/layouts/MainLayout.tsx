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
    const isCalendar = activeTab === "calendar";
    // Dashboard should also be full-width/edge-to-edge to support its native sticky header
    const isEdgeToEdge = activeTab === "calendar" || activeTab === "dashboard";

    return (
        <div className="relative flex h-full w-full flex-col overflow-hidden font-[SF Pro Display,sans-serif] bg-transparent text-white">
            {/* Main Content Area */}
            <main
                className={`flex-1 overflow-y-auto overflow-x-hidden w-full ${isEdgeToEdge ? "pb-0 pt-0" : "pt-[env(safe-area-inset-top)] pb-[120px]"}`}
                style={{
                    // Force hardware acceleration for smooth scrolling
                    WebkitOverflowScrolling: "touch",
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
