import React, { useState } from 'react';
import {
  Plus,
  Calendar,
  Sparkles,
  RefreshCw,
  ChevronRight,
  X,
  Check
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { shiftWorkouts } from '../utils/trainingSchedule';

// --- HELPER ---
const formatNumber = (num: number) => {
  return num.toLocaleString('de-DE');
};

const DashboardPage = () => {
  const [showAdaptivModal, setShowAdaptivModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showTerminModal, setShowTerminModal] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showToast, setShowToast] = useState(false); // For visual feedback

  // MOCK DATA
  const today = new Date();
  const weekMinutes = 1457;
  const goalMinutes = 300;

  const handleShiftConfirm = async () => {
    // Backend update
    try {
      await shiftWorkouts(1);
      setShowShiftModal(false);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      console.log("Plan shifted by +1 day");
    } catch (err) {
      console.error("Shift failed", err);
    }
  };

  // --- MODALS ---

  const AdaptivModal = () => {
    const [step, setStep] = useState(1);
    const [completed, setCompleted] = useState(false);

    if (!showAdaptivModal) return null;

    const steps = [
      { id: 1, label: 'Zeit', options: ['< 30 min', '30-60 min', '60-90 min', '> 90 min'] },
      { id: 2, label: 'Energie', options: ['Niedrig', 'Mittel', 'Hoch'] },
      { id: 3, label: 'Stress', options: ['Wenig', 'Mittel', 'Viel'] },
      { id: 4, label: 'Belastung', options: ['Regenerativ', 'Erhaltend', 'Fordernd'] },
    ];

    const currentStep = steps.find(s => s.id === step);

    const handleOptionClick = () => {
      if (step < 4) {
        setStep(step + 1);
      } else {
        setCompleted(true);
        setTimeout(() => {
          setShowAdaptivModal(false);
          setStep(1);
          setCompleted(false);
        }, 1500);
      }
    };

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setShowAdaptivModal(false)} />
        <div className="relative w-full max-w-sm bg-[#1c1c1e] rounded-[32px] p-6 shadow-2xl animate-in slide-in-from-bottom-10 fade-in zoom-in-95 duration-200 border border-white/10">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Sparkles className="text-purple-500" size={24} />
              Adaptiv Check
            </h2>
            <button onClick={() => setShowAdaptivModal(false)} className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
              <X size={20} />
            </button>
          </div>

          {!completed && currentStep ? (
            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <span className="text-sm font-bold text-zinc-500 uppercase tracking-widest">{currentStep.label}</span>
                <span className="text-xs font-mono text-zinc-600">{step} / 4</span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {currentStep.options.map((opt) => (
                  <button
                    key={opt}
                    onClick={handleOptionClick}
                    className={`
                           p-4 rounded-2xl text-left font-semibold active:scale-95 transition-all outline-none border border-transparent 
                           ${currentStep.id === 2 && (opt === 'Hoch' ? 'bg-green-500/10 text-green-400 border-green-500/30' : opt === 'Mittel' ? 'bg-blue-500/10 text-blue-400' : 'bg-red-500/10 text-red-400')}
                           ${currentStep.id !== 2 && 'bg-zinc-800 text-white hover:border-zinc-700'}
                         `}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-10 animate-in zoom-in">
              <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={32} strokeWidth={3} />
              </div>
              <h3 className="text-xl font-bold text-white">Fertig!</h3>
              <p className="text-zinc-400 mt-2">Dein Plan wurde angepasst.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const ShiftModal = () => {
    if (!showShiftModal) return null;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowShiftModal(false)} />
        <div className="relative w-full max-w-xs bg-[#1c1c1e] rounded-3xl p-6 border border-zinc-800 shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-500 mb-4 mx-auto">
            <RefreshCw size={24} />
          </div>
          <h3 className="text-xl font-bold text-center text-white mb-2">Plan verschieben?</h3>
          <p className="text-center text-zinc-400 text-sm mb-6">Alle geplanten Trainings ab heute werden um einen Tag nach hinten geschoben.</p>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setShowShiftModal(false)} className="py-3 rounded-xl bg-zinc-800 text-white font-semibold active:scale-95 transition-transform">Abbrechen</button>
            <button onClick={handleShiftConfirm} className="py-3 rounded-xl bg-blue-600 text-white font-bold active:scale-95 transition-transform">Verschieben</button>
          </div>
        </div>
      </div>
    )
  };

  return (
    <div className="min-h-screen bg-[#121214] text-white pb-32">
      <AdaptivModal />
      <ShiftModal />

      {/* TOAST */}
      {showToast && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[200] bg-white text-black px-6 py-3 rounded-full font-bold shadow-xl animate-in slide-in-from-top-4 fade-in">
          Plan verschoben!
        </div>
      )}

      {/* HEADER: Native iOS Sticky Header */}
      <div className="sticky top-0 z-50 bg-[#121214]/95 backdrop-blur-xl border-b border-white/5 pt-[env(safe-area-inset-top)]">
        <div className="px-6 pb-4 mt-[10px]">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-0">Dashboard</h1>
        </div>
      </div>

      {/* CONTENT */}
      {/* Increased top padding slightly to give breath below header */}
      <div className="p-4 pt-4 space-y-4 max-w-md mx-auto">

        {/* NÄCHSTES TRAINING */}
        <div>
          <h3 className="text-sm font-bold text-zinc-400 mb-2 pl-1 uppercase tracking-wider text-[11px]">Nächstes Training</h3>
          <div className="bg-zinc-800 rounded-[24px] p-5 flex items-center justify-between active:scale-[0.98] active:opacity-80 transition-all border border-zinc-700/30">
            <div>
              <h3 className="text-xl font-bold text-white">Beine (Hypertrophie)</h3>
              <p className="text-zinc-400 text-sm mt-0.5">Heute • 18:00 Uhr</p>
            </div>
            <ChevronRight className="text-zinc-600" />
          </div>
        </div>

        {/* AKTIONEN */}
        <div>
          <h3 className="text-sm font-bold text-zinc-400 mb-2 pl-1 uppercase tracking-wider text-[11px]">Schnellzugriff</h3>
          <div className="grid grid-cols-2 gap-2.5">

            <button onClick={() => setShowPlanModal(true)} className="bg-zinc-800 rounded-[20px] p-4 flex flex-col items-center gap-2 active:scale-95 transition-transform border border-zinc-700/30">
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                <Plus size={22} strokeWidth={3} />
              </div>
              <span className="text-[13px] font-semibold text-zinc-200">Planen</span>
            </button>

            <button onClick={() => setShowTerminModal(true)} className="bg-zinc-800 rounded-[20px] p-4 flex flex-col items-center gap-2 active:scale-95 transition-transform border border-zinc-700/30">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                <Calendar size={22} />
              </div>
              <span className="text-[13px] font-semibold text-zinc-200">Termin</span>
            </button>

            <button
              onClick={() => setShowAdaptivModal(true)}
              className="relative bg-zinc-800 rounded-[20px] p-4 flex flex-col items-center gap-2 active:scale-95 transition-transform group border border-purple-500/30 overflow-hidden"
            >
              <div className="absolute inset-0 bg-purple-500/5" />
              <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/30 animate-pulse-slow">
                <Sparkles size={20} fill="currentColor" />
              </div>
              <span className="text-[13px] font-bold text-white group-hover:text-purple-300 transition-colors">Adaptiv</span>
            </button>

            <button onClick={() => setShowShiftModal(true)} className="bg-zinc-800 rounded-[20px] p-4 flex flex-col items-center gap-2 active:scale-95 transition-transform border border-zinc-700/30">
              <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-500">
                <RefreshCw size={20} />
              </div>
              <span className="text-[13px] font-semibold text-zinc-200">Verschieben</span>
            </button>

          </div>
        </div>

        {/* PROGRESS CARD */}
        <div>
          <h3 className="text-sm font-bold text-zinc-400 mb-2 pl-1 uppercase tracking-wider text-[11px]">Wochenziel</h3>
          <div className="bg-zinc-800 rounded-[24px] p-6 flex items-center gap-6 border border-zinc-700/30 relative overflow-hidden">

            {/* Background Glow */}
            <div className="absolute right-0 top-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full pointer-events-none" />

            <div className="relative w-16 h-16 shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path className="text-zinc-700/50" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                <path className="text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="100, 100" strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-blue-500 text-lg">⚡️</span>
              </div>
            </div>

            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-bold text-white tracking-tight">{formatNumber(weekMinutes)}</span>
                <span className="text-sm font-medium text-zinc-500">/ {goalMinutes} min</span>
              </div>
              <p className="text-[11px] font-bold text-green-500 mt-1 uppercase tracking-wide">Ziel übertroffen +485%</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DashboardPage;
