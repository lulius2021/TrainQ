import React, { useState } from 'react';
import {
  Plus,
  Calendar,
  Sparkles,
  RefreshCw,
  ChevronRight,
  X
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const DashboardPage = () => {
  const [showAdaptivModal, setShowAdaptivModal] = useState(false);
  const today = new Date();

  // --- COMPONENT: ADAPTIV MODAL ---
  const AdaptivModal = () => {
    if (!showAdaptivModal) return null;

    return (
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center px-4 pb-4 sm:p-0">
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
          onClick={() => setShowAdaptivModal(false)}
        />
        <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-[32px] p-6 shadow-2xl animate-in slide-in-from-bottom-10 duration-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Sparkles className="text-purple-500" size={20} />
              Adaptives Training
            </h2>
            <button onClick={() => setShowAdaptivModal(false)} className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
              <X size={18} />
            </button>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase">Zeit heute</label>
              <div className="grid grid-cols-2 gap-2">
                <button className="py-3 bg-zinc-800 rounded-xl text-sm font-medium text-zinc-400 border border-transparent hover:border-zinc-600">Kurz</button>
                <button className="py-3 bg-blue-600 rounded-xl text-sm font-bold text-white shadow-lg shadow-blue-900/20">Normal</button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase">Energie</label>
              <div className="grid grid-cols-3 gap-2">
                <button className="py-3 bg-zinc-800 rounded-xl text-sm font-medium text-zinc-400 border border-transparent hover:border-zinc-600">Low</button>
                <button className="py-3 bg-blue-600 rounded-xl text-sm font-bold text-white shadow-lg shadow-blue-900/20">Ok</button>
                <button className="py-3 bg-zinc-800 rounded-xl text-sm font-medium text-zinc-400 border border-transparent hover:border-zinc-600">High</button>
              </div>
            </div>
          </div>

          <button onClick={() => setShowAdaptivModal(false)} className="w-full mt-8 py-4 bg-white text-black font-bold rounded-2xl hover:bg-zinc-200 transition-colors">
            Anwenden
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-900 text-white pb-32">
      <AdaptivModal />

      {/* HEADER FIXED: 
          1. sticky top-0
          2. z-50 (to stay above content)
          3. bg-zinc-900/95 (higher opacity to prevent text bleeding)
          4. Reduced padding (pb-3)
      */}
      <div className="sticky top-0 z-50 pt-safe px-6 pb-3 bg-zinc-900/95 backdrop-blur-xl border-b border-white/5 shadow-sm shadow-black/20">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-zinc-500 font-medium text-sm mt-0.5">
          {format(today, 'EEEE, d. MMMM', { locale: de })}
        </p>
      </div>

      {/* CONTENT: 
          Reduced top padding (pt-2) to bring content closer to header
      */}
      <div className="p-4 pt-2 space-y-6">

        {/* NÄCHSTES TRAINING */}
        <div>
          <h3 className="text-sm font-bold text-white mb-3 pl-1">Nächstes Training</h3>
          <div className="bg-zinc-800 rounded-3xl p-5 flex items-center justify-between active:scale-[0.99] transition-transform border border-zinc-700/50">
            <div>
              <h3 className="text-xl font-bold text-white">Beine</h3>
              <p className="text-zinc-400">Heute</p>
            </div>
            <ChevronRight className="text-zinc-500" />
          </div>
        </div>

        {/* AKTIONEN */}
        <div>
          <h3 className="text-sm font-bold text-white mb-3 pl-1">Aktionen</h3>
          <div className="grid grid-cols-2 gap-3">

            <button className="bg-zinc-800 rounded-3xl p-4 flex flex-col items-center gap-3 active:scale-95 transition-transform border border-zinc-700/50">
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-900/20">
                <Plus size={20} strokeWidth={3} />
              </div>
              <span className="text-sm font-medium text-zinc-300">Training planen</span>
            </button>

            <button className="bg-zinc-800 rounded-3xl p-4 flex flex-col items-center gap-3 active:scale-95 transition-transform border border-zinc-700/50">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                <Calendar size={20} />
              </div>
              <span className="text-sm font-medium text-zinc-300">Termin eintragen</span>
            </button>

            {/* ADAPTIV */}
            <button
              onClick={() => setShowAdaptivModal(true)}
              className="relative bg-zinc-800 rounded-3xl p-4 flex flex-col items-center gap-3 active:scale-95 transition-transform group border border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.15)]"
            >
              <div className="absolute inset-0 bg-purple-500/5 rounded-3xl" />
              <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/40 animate-pulse-slow">
                <Sparkles size={20} fill="currentColor" />
              </div>
              <span className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors">Adaptiv</span>
            </button>

            <button className="bg-zinc-800 rounded-3xl p-4 flex flex-col items-center gap-3 active:scale-95 transition-transform border border-zinc-700/50">
              <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-500">
                <RefreshCw size={20} />
              </div>
              <span className="text-sm font-medium text-zinc-300">Plan verschieben</span>
            </button>

          </div>
        </div>

        {/* DIESE WOCHE */}
        <div>
          <h3 className="text-sm font-bold text-white mb-3 pl-1">Diese Woche</h3>
          <div className="bg-zinc-800 rounded-3xl p-6 flex items-center gap-6 border border-zinc-700/50">
            <div className="relative w-16 h-16 shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path className="text-zinc-700" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                <path className="text-blue-500" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="100, 100" strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
                  <span className="text-blue-500">⚡️</span>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-white">1457</span>
                <span className="text-sm text-zinc-500">/ 300 min</span>
              </div>
              <p className="text-xs text-zinc-400 mt-1">Ziel erreicht! 🔥</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DashboardPage;
