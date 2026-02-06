import React, { useState, useEffect } from 'react';
import {
  Plus,
  Calendar,
  Sparkles,
  RefreshCw,
  ChevronRight,
  X,
  Clock,
  Dumbbell,
  Battery,
  Play
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { shiftWorkouts } from '../utils/trainingSchedule';
import { generateAdaptiveOptions, type AdaptiveOption } from '../services/AdaptiveService';
import { useLiveTrainingStore } from '../store/useLiveTrainingStore';
import { persistActiveLiveWorkout } from '../utils/trainingHistory';
import { getScopedItem, setScopedItem } from '../utils/scopedStorage';
import type { CalendarEvent, LiveWorkout } from '../types/training';
import { getActiveUserId } from '../utils/session';

// --- HELPER ---
const formatNumber = (num: number) => {
  return num.toLocaleString('de-DE');
};

const STORAGE_KEY_EVENTS = "trainq_calendar_events";

const DashboardPage = () => {
  const [showAdaptivModal, setShowAdaptivModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showTerminModal, setShowTerminModal] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showToast, setShowToast] = useState(false); // For visual feedback

  // MOCK DATA for Progress (Keep existing visuals)
  const weekMinutes = 1457;
  const goalMinutes = 300;

  const handleShiftConfirm = async () => {
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

  // --- ADAPTIVE MODAL ---
  const AdaptivModal = () => {
    if (!showAdaptivModal) return null;

    const [step, setStep] = useState(1);

    // Selection State
    const [time, setTime] = useState<number>(30);
    const [focus, setFocus] = useState<string>("Full Body");
    const [energy, setEnergy] = useState<1 | 2 | 3>(2);

    // Result
    const [options, setOptions] = useState<AdaptiveOption[]>([]);

    useEffect(() => {
      if (step === 4) {
        const results = generateAdaptiveOptions(time, focus as any, energy);
        setOptions(results);
      }
    }, [step, time, focus, energy]);

    const handleNext = () => setStep(p => p + 1);
    const handleBack = () => setStep(p => Math.max(1, p - 1));

    const handleSelectOption = (option: AdaptiveOption) => {
      // 1. Prepare Data
      const userId = getActiveUserId() || "user";
      const eventId = crypto.randomUUID();
      const now = new Date(); // Start immediately

      // 2. Create Live Workout Object
      const liveWorkout: LiveWorkout = {
        id: crypto.randomUUID(),
        calendarEventId: eventId,
        title: option.title,
        sport: "Gym", // Assume Gym for now or deduce
        startedAt: now.toISOString(),
        isActive: true,
        isMinimized: false,
        exercises: option.exercises,
        notes: `Adaptiv: ${option.description}`
      };

      // 3. Create Calendar Event (to persist "Planned/Open")
      // We set it as already started/active basically
      const calendarEvent: CalendarEvent = {
        id: eventId,
        userId,
        title: option.title,
        date: format(now, "yyyy-MM-dd"),
        startTime: format(now, "HH:mm"),
        endTime: "",
        type: "training",
        trainingType: "gym",
        trainingStatus: "open", // Or "completed" only after finish? "open" implies planned.
        description: option.description,
        workoutData: {
          exercises: option.exercises
        },
        adaptiveAppliedAt: now.toISOString(),
        adaptiveReasons: [option.intensity + " Intensity", focus + " Focus"]
      };

      // 4. Save to Storage (Calendar)
      // Manual append because we are outside MainAppShell's state scope
      try {
        const raw = getScopedItem(STORAGE_KEY_EVENTS, userId);
        const events = raw ? JSON.parse(raw) : [];
        events.push(calendarEvent);
        setScopedItem(STORAGE_KEY_EVENTS, JSON.stringify(events), userId);
      } catch (e) {
        console.error("Failed to save adaptive event", e);
      }

      // 5. Start Live Workout
      persistActiveLiveWorkout(liveWorkout); // Helper to save to specific key
      useLiveTrainingStore.getState().startWorkout(liveWorkout);

      // 6. Navigate
      setShowAdaptivModal(false);
      // Dispatch navigate event for MainAppShell
      window.dispatchEvent(new CustomEvent("trainq:navigate", { detail: { path: "/live-training", eventId } }));
    };

    const renderContent = () => {
      switch (step) {
        case 1: // TIME
          return (
            <div className="space-y-6 pt-2">
              <h3 className="text-xl font-bold text-white text-center">Wie viel Zeit hast du?</h3>
              <div className="grid grid-cols-1 gap-3">
                {[15, 30, 45, 60].map(m => (
                  <button
                    key={m}
                    onClick={() => { setTime(m); handleNext(); }}
                    className="p-5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 transition-all flex items-center justify-between group border border-white/5"
                  >
                    <div className="flex items-center gap-4">
                      <Clock className="text-blue-500" size={24} />
                      <span className="text-lg font-bold text-white">{m} Min</span>
                    </div>
                    <ChevronRight className="text-zinc-600 group-hover:text-white" />
                  </button>
                ))}
              </div>
            </div>
          );

        case 2: // FOCUS
          return (
            <div className="space-y-6 pt-2">
              <h3 className="text-xl font-bold text-white text-center">Was ist dein Ziel?</h3>
              <div className="grid grid-cols-1 gap-3">
                {[
                  { l: "Kraft", v: "Strength", i: <Dumbbell /> },
                  { l: "Ausdauer", v: "Cardio", i: <Play /> }, // Using Play icon as placeholder for Cardio/Motion
                  { l: "Full Body", v: "Full Body", i: <RefreshCw /> },
                  { l: "Oberkörper", v: "Upper", i: <div className="font-bold text-lg">UP</div> },
                  { l: "Unterkörper", v: "Lower", i: <div className="font-bold text-lg">LO</div> }
                ].map(item => (
                  <button
                    key={item.v}
                    onClick={() => { setFocus(item.v); handleNext(); }}
                    className="p-5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 transition-all flex items-center justify-between group border border-white/5"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-purple-500">{item.i}</div>
                      <span className="text-lg font-bold text-white">{item.l}</span>
                    </div>
                    <ChevronRight className="text-zinc-600 group-hover:text-white" />
                  </button>
                ))}
              </div>
            </div>
          );

        case 3: // ENERGY
          return (
            <div className="space-y-6 pt-2">
              <h3 className="text-xl font-bold text-white text-center">Wie viel Energie hast du?</h3>
              <div className="flex flex-col gap-4">
                {[
                  { v: 1, l: "Wenig", d: "Ruhiges Tempo, Fokus auf Technik", c: "bg-red-500/10 text-red-500 border-red-500/20" },
                  { v: 2, l: "Mittel", d: "Normales Training", c: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
                  { v: 3, l: "Viel", d: "Gib mir alles! High Volume.", c: "bg-green-500/10 text-green-500 border-green-500/20" }
                ].map((item) => (
                  <button
                    key={item.v}
                    onClick={() => { setEnergy(item.v as any); handleNext(); }}
                    className={`p-6 rounded-2xl border active:scale-95 transition-all text-left ${item.c} hover:brightness-125`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xl font-black uppercase tracking-wide">{item.l}</span>
                      <Battery size={24} className={item.v === 1 ? "rotate-90 text-red-500" : item.v === 3 ? "rotate-0 text-green-500" : "rotate-0 text-yellow-500"} />
                    </div>
                    <p className="text-sm opacity-80 font-medium">{item.d}</p>
                  </button>
                ))}
              </div>
            </div>
          );

        case 4: // SELECTION
          return (
            <div className="space-y-4 pt-0">
              <h3 className="text-xl font-bold text-white text-center mb-4">Dein Plan steht.</h3>
              <div className="grid grid-cols-1 gap-4">
                {options.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => handleSelectOption(opt)}
                    className="bg-zinc-800 rounded-2xl p-5 border border-zinc-700/50 hover:bg-zinc-750 active:scale-[0.98] transition-all text-left group relative overflow-hidden"
                  >
                    {/* Background Gradient Hint */}
                    <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br opacity-10 blur-xl rounded-full translate-x-12 -translate-y-6 ${opt.id.includes("quick") ? "from-yellow-500 to-orange-500" : opt.id.includes("power") ? "from-red-500 to-pink-500" : "from-blue-500 to-cyan-500"}`} />

                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${opt.id.includes("quick") ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" : opt.id.includes("power") ? "bg-red-500/10 text-red-500 border-red-500/20" : "bg-blue-500/10 text-blue-500 border-blue-500/20"}`}>
                          {opt.id.includes("quick") ? "Quick" : opt.id.includes("power") ? "Power" : "Focus"}
                        </span>
                        <span className="text-xs font-bold text-zinc-400 flex items-center gap-1">
                          <Clock size={12} /> {opt.durationMinutes} min
                        </span>
                      </div>
                      <h4 className="text-lg font-black text-white mb-1 group-hover:text-blue-400 transition-colors">{opt.title}</h4>
                      <p className="text-sm text-zinc-400 line-clamp-2">{opt.description}</p>

                      <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-4 text-xs font-medium text-zinc-500">
                        <span>{opt.exercises.length} Übungen</span>
                        <span>{opt.totalSets} Sätze</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
      }
    };

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setShowAdaptivModal(false)} />
        <div className="relative w-full max-w-sm bg-[#1c1c1e] rounded-[32px] p-6 shadow-2xl animate-in slide-in-from-bottom-10 fade-in zoom-in-95 duration-200 border border-white/10 min-h-[500px] flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="text-purple-500" size={18} />
              Adaptiv Generator
            </h2>
            <button onClick={() => setShowAdaptivModal(false)} className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 flex flex-col">
            {renderContent()}
          </div>

          {step > 1 && step < 4 && (
            <button onClick={handleBack} className="mt-4 text-sm text-zinc-500 font-medium self-center hover:text-white">Zurück</button>
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

        {/* HERO: ADAPTIV CARD */}
        <button
          onClick={() => setShowAdaptivModal(true)}
          className="w-full relative overflow-hidden bg-gradient-to-br from-purple-900/50 to-blue-900/50 rounded-[32px] p-6 border border-white/10 group active:scale-[0.98] transition-transform text-left"
        >
          <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/20 blur-[60px] rounded-full" />

          <div className="relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white mb-4 shadow-lg border border-white/10 group-hover:scale-110 transition-transform">
              <Sparkles size={24} fill="currentColor" />
            </div>
            <h2 className="text-2xl font-black text-white mb-1">Adaptive Workout</h2>
            <p className="text-zinc-300 text-sm font-medium leading-relaxed max-w-[240px]">
              Wenig Zeit? Generiere sofort einen perfekten Trainingsplan für jetzt.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-200">
              <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              Jetzt starten
            </div>
          </div>
        </button>

        {/* NÄCHSTES TRAINING (Placeholder for existing calendar logic if we had props, but reusing the static design for now since we don't have props passed in easily) */}
        {/* Ideally this would read from Calendar Storage, but for MVP of Adaptive feature, we keep visual hierarchy */}

        {/* AKTIONEN GRID */}
        <div>
          <h3 className="text-sm font-bold text-zinc-400 mb-2 pl-1 uppercase tracking-wider text-[11px]">Schnellzugriff</h3>
          <div className="grid grid-cols-2 gap-2.5">
            <button onClick={() => setShowPlanModal(true)} className="bg-zinc-800 rounded-[24px] p-4 flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform border border-zinc-700/30 h-28">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                <Plus size={22} strokeWidth={3} />
              </div>
              <span className="text-[13px] font-semibold text-zinc-200">Planen</span>
            </button>

            <button onClick={() => setShowShiftModal(true)} className="bg-zinc-800 rounded-[24px] p-4 flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform border border-zinc-700/30 h-28">
              <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500">
                <RefreshCw size={20} />
              </div>
              <span className="text-[13px] font-semibold text-zinc-200">Verschieben</span>
            </button>
          </div>
        </div>

        {/* PROGRESS CARD (Visual Filler) */}
        <div>
          <h3 className="text-sm font-bold text-zinc-400 mb-2 pl-1 uppercase tracking-wider text-[11px]">Status</h3>
          <div className="bg-zinc-800 rounded-[24px] p-6 flex items-center gap-6 border border-zinc-700/30 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full pointer-events-none" />
            <div className="relative w-16 h-16 shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path className="text-zinc-700/50" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                <path className="text-blue-500" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="75, 100" strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center font-bold text-white text-sm">
                75%
              </div>
            </div>
            <div>
              <div className="text-lg font-bold text-white leading-tight mb-1">Weekly Goal</div>
              <p className="text-xs text-zinc-400">Du bist gut unterwegs. Dranbleiben!</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DashboardPage;
