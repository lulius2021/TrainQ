import React from "react";

export const PortraitLock: React.FC = () => {
    return (
        <div className="fixed inset-0 z-[100] hidden h-screen w-screen flex-col items-center justify-center bg-black text-white landscape:flex md:landscape:hidden">
            <div className="animate-pulse">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="64"
                    height="64"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mb-4"
                >
                    <path d="M12 3a9 9 0 1 0 9 9" />
                    <path d="M12 3v9" />
                    <path d="M16 7l-4-4-4 4" />
                </svg>
            </div>
            <p className="font-bold text-lg">Bitte Handy drehen</p>
            <p className="text-sm text-gray-400 mt-2">TrainQ ist für Portrait-Modus optimiert.</p>
        </div>
    );
};
