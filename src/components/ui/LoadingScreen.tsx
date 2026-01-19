import React from "react";

export const LoadingScreen: React.FC = () => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061226]">
            <div className="flex flex-col items-center gap-4">
                {/* Simple CSS Spinner */}
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-[#2563EB]"></div>
                <div className="text-sm font-medium text-gray-400 animate-pulse">
                    Laden...
                </div>
            </div>
        </div>
    );
};
