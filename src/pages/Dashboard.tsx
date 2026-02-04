import React, { useState } from 'react';
import {
  Plus,
  Calendar,
  Sparkles,
  RefreshCw,
  ChevronRight,
  X,
  Dumbbell,
  Clock,
  ArrowRight,
  Check,
  Play,
  Type
} from 'lucide-react';

const DashboardPage = () => {
  // MODAL STATES
  const [showAdaptivModal, setShowAdaptivModal] = useState(false);
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);

  // LOGIC STATES
  const [adaptivStep, setAdaptivStep] = useState<'input' | 'result'>('input');
  const [selectedWorkout, setSelectedWorkout] = useState<string | null>(null);

  // --- MOCK DATA ---
  const GENERATED_WORKOUT = [
    { name: 'Bankdrücken', sets: 3, reps: '8-10', weight: '80kg' },
    { name: 'Schrägbank KH', sets: 3, reps: '10-12', weight: '32kg' },
    { name: 'Seitheben Kabel', sets: 4, reps: '15', weight: '12kg' },
    { name: 'Trizeps Pushdown', sets: 3, reps: '12-15', weight: '25kg' },
  ];

  const WORKOUT_TYPES = ['Push Day', 'Pull Day', 'Beine', 'Ganzkörper', 'Cardio', 'Mobility'];

  // --- REUSABLE COMPONENTS (For Consistency) ---
  const ModalHeader = ({ title, icon: Icon, color, onClose }: any) => (
    <div className="flex justify-between items-center mb-6">
      <h2 className="text-lg font-bold text-white flex items-center gap-2">
        <Icon className={color} size={20} />
        {title}
      </h2>
      <button onClick={onClose} className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white">
        <X size={18} />
      </button>
    </div>
  );

  const Label = ({ children }: { children: React.ReactNode }) => (
    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1 block mb-2">
      {children}
    </label>
  );

  // --- 1. ADAPTIV MODAL ---
  const AdaptivModal = () => {
    if (!showAdaptivModal) return null;

    const handleClose = () => {
      setShowAdaptivModal(false);
      setTimeout(() => setAdaptivStep('input'), 300);
    };

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={handleClose} />
        <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">

          <ModalHeader
            title={adaptivStep === 'input' ? 'Adaptiv Check' : 'Dein Plan'}
            icon={Sparkles}
            color="text-purple-500"
            onClose={handleClose}
          />

          {adaptivStep === 'input' && (
            <div className="space-y-6 animate-in slide-in-from-left-4 duration-300">
              <div>
                <Label>Zeit heute</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button className="py-3 bg-zinc-800 rounded-2xl text-sm font-medium text-zinc-400">Kurz</button>
                  <button className="py-3 bg-blue-600 rounded-2xl text-sm font-bold text-white shadow-lg shadow-blue-900/20">Normal</button>
                </div>
              </div>
              <div>
                <Label>Energie</Label>
                <div className="grid grid-cols-3 gap-2">
                  <button className="py-3 bg-zinc-800 rounded-2xl text-sm font-medium text-zinc-400">Low</button>
                  <button className="py-3 bg-blue-600 rounded-2xl text-sm font-bold text-white shadow-lg shadow-blue-900/20">Ok</button>
                  <button className="py-3 bg-zinc-800 rounded-2xl text-sm font-medium text-zinc-400">High</button>
                </div>
              </div>
              <div>
                <Label>Stress</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button className="py-3 bg-zinc-800 rounded-2xl text-sm font-medium text-zinc-400">Hoch</button>
                  <button className="py-3 bg-blue-600 rounded-2xl text-sm font-bold text-white shadow-lg shadow-blue-900/20">Normal</button>
                </div>
              </div>
              <button
                onClick={() => setAdaptivStep('result')}
                className="w-full mt-4 py-4 bg-white text-black font-bold rounded-2xl hover:bg-zinc-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <Sparkles size={18} className="text-purple-600" />
                Plan generieren
              </button>
            </div>
          )}

          {adaptivStep === 'result' && (
            <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4 mb-4">
                <p className="text-xs text-purple-300 leading-relaxed">
                  Volumen angepasst. Fokus auf saubere Technik.
                </p>
              </div>
              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                {GENERATED_WORKOUT.map((ex, i) => (
                  <div key={i} className="bg-zinc-800/50 p-3 rounded-2xl flex items-center justify-between border border-zinc-800">
                    <div>
                      <h4 className="font-bold text-sm text-white">{ex.name}</h4>
                      <span className="text-xs text-zinc-500">{ex.sets} x {ex.reps}</span>
                    </div>
                    <div className="bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-700">
                      <span className="text-xs font-bold text-white">{ex.weight}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-2">
                <button
                  onClick={handleClose}
                  className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-900/30 hover:bg-blue-500 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <Play size={18} fill="currentColor" />
                  Starten
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // --- 2. WORKOUT MODAL (HIGH FIDELITY) ---
  const WorkoutModal = () => {
    if (!showWorkoutModal) return null;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={() => setShowWorkoutModal(false)} />
        <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200">

          <ModalHeader title="Training wählen" icon={Dumbbell} color="text-blue-500" onClose={() => setShowWorkoutModal(false)} />

          <div className="space-y-6">
            <div>
              <Label>Kategorie</Label>
              <div className="grid grid-cols-2 gap-3">
                {WORKOUT_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedWorkout(type)}
                    className={`
                       py-4 px-3 rounded-2xl text-sm font-bold transition-all border
                       ${selectedWorkout === type
                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20'
                        : 'bg-zinc-800 border-transparent text-zinc-400 hover:bg-zinc-750'
                      }
                     `}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowWorkoutModal(false)}
            className="w-full mt-6 py-4 bg-white text-black font-bold rounded-2xl hover:bg-zinc-200 active:scale-[0.98] transition-all"
          >
            Hinzufügen
          </button>
        </div>
      </div>
    );
  };

  // --- 3. EVENT MODAL (HIGH FIDELITY) ---
  const EventModal = () => {
    if (!showEventModal) return null;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={() => setShowEventModal(false)} />
        <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200">

          <ModalHeader title="Neuer Termin" icon={Calendar} color="text-emerald-500" onClose={() => setShowEventModal(false)} />

          <div className="space-y-6">
            {/* Styled Input Fields to match buttons */}
            <div>
              <Label>Titel</Label>
              <div className="flex items-center bg-zinc-800 rounded-2xl px-4 py-3 border border-transparent focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500 transition-all">
                <Type size={18} className="text-zinc-500 mr-3" />
                <input
                  type="text"
                  placeholder="z.B. Physio, Check-in..."
                  className="bg-transparent border-none text-white placeholder-zinc-500 text-sm font-bold w-full focus:outline-none"
                />
              </div>
            </div>

            <div>
              <Label>Uhrzeit & Dauer</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center bg-zinc-800 rounded-2xl px-4 py-3">
                  <Clock size={18} className="text-zinc-500 mr-2" />
                  <input
                    type="time"
                    defaultValue="09:00"
                    className="bg-transparent border-none text-white text-sm font-bold w-full focus:outline-none appearance-none"
                  />
                </div>
                <div className="flex items-center justify-center bg-zinc-800 rounded-2xl px-4 py-3 text-sm font-bold text-zinc-400">
                  60 Min
                </div>
              </div>
            </div>

            <div>
              <Label>Typ</Label>
              <div className="grid grid-cols-3 gap-2">
                <button className="py-3 bg-emerald-600 rounded-2xl text-sm font-bold text-white shadow-lg shadow-emerald-900/20">Call</button>
                <button className="py-3 bg-zinc-800 rounded-2xl text-sm font-medium text-zinc-400">Arzt</button>
                <button className="py-3 bg-zinc-800 rounded-2xl text-sm font-medium text-zinc-400">Sonst.</button>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowEventModal(false)}
            className="w-full mt-6 py-4 bg-white text-black font-bold rounded-2xl hover:bg-zinc-200 active:scale-[0.98] transition-all"
          >
            Speichern
          </button>
        </div>
      </div>
    );
  };

  // --- 4. SHIFT MODAL (HIGH FIDELITY) ---
  const ShiftModal = () => {
    if (!showShiftModal) return null;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={() => setShowShiftModal(false)} />
        <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200">

          <ModalHeader title="Plan verschieben" icon={RefreshCw} color="text-cyan-500" onClose={() => setShowShiftModal(false)} />

          <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
            Verschiebt alle zukünftigen Einheiten. Pausentage bleiben erhalten.
          </p>

          <div className="space-y-3">
            <button onClick={() => setShowShiftModal(false)} className="w-full p-4 bg-zinc-800 rounded-2xl flex items-center justify-between hover:bg-zinc-700 group transition-all">
              <span className="font-bold text-zinc-200">+ 1 Tag</span>
              <ArrowRight size={18} className="text-zinc-600 group-hover:text-white transition-colors" />
            </button>
            <button onClick={() => setShowShiftModal(false)} className="w-full p-4 bg-zinc-800 rounded-2xl flex items-center justify-between hover:bg-zinc-700 group transition-all">
              <span className="font-bold text-zinc-200">+ 2 Tage</span>
              <ArrowRight size={18} className="text-zinc-600 group-hover:text-white transition-colors" />
            </button>
            <button onClick={() => setShowShiftModal(false)} className="w-full p-4 bg-zinc-800 rounded-2xl flex items-center justify-between hover:bg-zinc-700 group transition-all">
              <span className="font-bold text-zinc-200">+ 1 Woche</span>
              <ArrowRight size={18} className="text-zinc-600 group-hover:text-white transition-colors" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // --- MAIN RENDER ---
  return (
    <div className="min-h-screen bg-zinc-900 text-white pb-32">
      <AdaptivModal />
      <WorkoutModal />
      <EventModal />
      <ShiftModal />

      {/* HEADER (STATIC) */}
      <div className="pt-safe px-6 pt-2 pb-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard</h1>
      </div>

      <div className="p-4 pt-0 space-y-6">

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

            <button onClick={() => setShowWorkoutModal(true)} className="bg-zinc-800 rounded-3xl p-4 flex flex-col items-center gap-3 active:scale-95 transition-transform border border-zinc-700/50 hover:bg-zinc-700/50">
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-900/20">
                <Plus size={20} strokeWidth={3} />
              </div>
              <span className="text-sm font-medium text-zinc-300">Training planen</span>
            </button>

            <button onClick={() => setShowEventModal(true)} className="bg-zinc-800 rounded-3xl p-4 flex flex-col items-center gap-3 active:scale-95 transition-transform border border-zinc-700/50 hover:bg-zinc-700/50">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                <Calendar size={20} />
              </div>
              <span className="text-sm font-medium text-zinc-300">Termin eintragen</span>
            </button>

            <button onClick={() => setShowAdaptivModal(true)} className="relative bg-zinc-800 rounded-3xl p-4 flex flex-col items-center gap-3 active:scale-95 transition-transform group border border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.15)]">
              <div className="absolute inset-0 bg-purple-500/5 rounded-3xl" />
              <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/40 animate-pulse-slow">
                <Sparkles size={20} fill="currentColor" />
              </div>
              <span className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors">Adaptiv</span>
            </button>

            <button onClick={() => setShowShiftModal(true)} className="bg-zinc-800 rounded-3xl p-4 flex flex-col items-center gap-3 active:scale-95 transition-transform border border-zinc-700/50 hover:bg-zinc-700/50">
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
