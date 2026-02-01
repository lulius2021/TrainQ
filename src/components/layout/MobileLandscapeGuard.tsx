import React from 'react';
import { Smartphone } from 'lucide-react';

export const MobileLandscapeGuard = () => {
    return (
        <div
            id="mobile-landscape-guard"
            className="fixed inset-0 z-[9999] h-screen w-screen flex-col items-center justify-center bg-black text-white px-6 text-center"
        >
            <Smartphone size={64} className="animate-spin-slow mb-6 rotate-90" />
            <h2 className="text-2xl font-bold mb-2">Bitte drehen</h2>
            <p className="text-zinc-400">TrainQ ist für das Hochformat optimiert.</p>
        </div>
    );
};
