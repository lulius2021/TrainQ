import React from "react";

export const LoadingScreen: React.FC = () => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-color)]">
            <div className="flex flex-col items-center gap-4">
                {/* Simple CSS Spinner */}
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--border-color)] border-t-[var(--accent-color)]"></div>
                <div className="text-sm font-medium text-[var(--text-secondary)] animate-pulse">
                    Laden...
                </div>
            </div>
        </div>
    );
};
