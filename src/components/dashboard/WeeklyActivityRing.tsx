import React, { useMemo } from "react";
import { motion } from "framer-motion";

interface WeeklyActivityRingProps {
    currentMinutes: number;
    goalMinutes: number;
}

export const WeeklyActivityRing: React.FC<WeeklyActivityRingProps> = ({
    currentMinutes,
    goalMinutes,
}) => {
    const percentage = Math.min(100, Math.max(0, (currentMinutes / goalMinutes) * 100));
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    // Dynamic feedback text
    const feedbackText = useMemo(() => {
        if (percentage === 0) return "Auf geht's!";
        if (percentage < 25) return "Guter Start!";
        if (percentage < 50) return "Weiter so!";
        if (percentage < 75) return "Halbzeit!";
        if (percentage < 100) return "Endspurt!";
        return "Ziel erreicht! 🔥";
    }, [percentage]);

    return (
        <div className="bg-white/10 backdrop-blur-xl border border-blue-500/20 p-4 rounded-2xl flex items-center gap-5 shadow-sm relative overflow-hidden">
            {/* Background Glow Effect */}
            <div className="absolute left-0 top-0 w-24 h-24 bg-blue-500/10 blur-3xl rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

            {/* Ring Container */}
            <div className="relative w-[80px] h-[80px] flex-shrink-0">
                <svg
                    width="80"
                    height="80"
                    viewBox="0 0 80 80"
                    className="transform -rotate-90"
                >
                    {/* Gradient Definition */}
                    <defs>
                        <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#3B82F6" /> {/* blue-500 */}
                            <stop offset="100%" stopColor="#22D3EE" /> {/* cyan-400 */}
                        </linearGradient>
                    </defs>

                    {/* Background Circle */}
                    <circle
                        cx="40"
                        cy="40"
                        r={radius}
                        stroke="#27272a" // zinc-800
                        strokeWidth="8"
                        fill="transparent"
                    />

                    {/* Progress Circle (Animated) */}
                    <motion.circle
                        cx="40"
                        cy="40"
                        r={radius}
                        stroke="url(#ringGradient)"
                        strokeWidth="8"
                        fill="transparent"
                        strokeDasharray={circumference}
                        initial={{ strokeDashoffset: circumference }}
                        animate={{ strokeDashoffset }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        strokeLinecap="round"
                    />
                </svg>

                {/* Center Icon */}
                <div className="absolute inset-0 flex items-center justify-center text-blue-400">
                    <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            d="M13 2L3 14H12L11 22L21 10H12L13 2Z"
                            stroke="none"
                        />
                    </svg>
                </div>
            </div>

            {/* Stats Text */}
            <div className="flex flex-col z-10">
                <div className="text-[26px] font-bold text-white tabular-nums leading-none mb-1">
                    {currentMinutes} <span className="text-[17px] font-normal text-zinc-500">/ {goalMinutes} min</span>
                </div>
                <div className="text-[15px] font-medium text-zinc-400">
                    {feedbackText}
                </div>
            </div>
        </div>
    );
};
