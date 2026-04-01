import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { getSupabaseClient } from '../lib/supabaseClient';
import { useCsvImport } from '../hooks/useCsvImport';
import { AppButton } from './ui/AppButton';
import CsvPreviewTable from './import/CsvPreviewTable';
import CsvImportSummary from './import/CsvImportSummary';
import PermissionsStep from './onboarding/PermissionsStep';
import { CheckCircle, Upload, FileSpreadsheet, ArrowLeft, Watch, Loader2, Link, AlertCircle, Activity, Heart, Moon } from 'lucide-react';
const logo = '/logo.png';

/* ─── Animation variants ─── */

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 100 : -100, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -100 : 100, opacity: 0 }),
};

const slideTransition = { duration: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] };

/* ─── Progress Dots ─── */

const ProgressDots: React.FC<{ current: number; total: number }> = ({ current, total }) => (
  <div className="flex items-center justify-center gap-2 py-4">
    {Array.from({ length: total }, (_, i) => (
      <div
        key={i}
        className="rounded-full transition-all duration-300"
        style={{
          width: i === current ? 24 : 8,
          height: 8,
          backgroundColor: i === current ? 'var(--accent-color)' : 'var(--border-color)',
        }}
      />
    ))}
  </div>
);

/* ─── Step 1: Welcome ─── */

const WelcomeStep: React.FC<{ onNext: () => void }> = ({ onNext }) => (
  <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
    <motion.img
      src={logo}
      alt="TrainQ"
      className="w-24 h-24 rounded-3xl shadow-lg mb-8"
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    />
    <motion.h1
      className="text-3xl font-black tracking-tight mb-3"
      style={{ color: 'var(--text-color)' }}
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.2, duration: 0.4 }}
    >
      Willkommen bei TrainQ
    </motion.h1>
    <motion.p
      className="text-base mb-12"
      style={{ color: 'var(--text-secondary)' }}
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.35, duration: 0.4 }}
    >
      Dein intelligenter Trainingspartner
    </motion.p>
    <motion.div
      className="w-full max-w-xs"
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.5, duration: 0.4 }}
    >
      <AppButton onClick={onNext} fullWidth size="lg" className="!rounded-2xl !text-lg !font-black shadow-lg">
        Loslegen
      </AppButton>
    </motion.div>
  </div>
);

/* ─── Step 2: Fokus ─── */

const personas = [
  { id: 'pro', label: 'Athlet', emoji: '🏆', desc: 'Maximale Leistung' },
  { id: 'manager', label: 'Effizient', emoji: '💼', desc: 'Zeitsparend & fokussiert' },
  { id: 'beginner', label: 'Gesundheit', emoji: '🌱', desc: 'Nachhaltiger Aufbau' },
];

const FokusStep: React.FC<{ value: string; onChange: (v: string) => void; onNext: () => void }> = ({
  value, onChange, onNext,
}) => (
  <div className="flex-1 flex flex-col px-6">
    <h2 className="text-2xl font-bold tracking-tight mb-2" style={{ color: 'var(--text-color)' }}>
      Was ist dein Fokus?
    </h2>
    <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
      Wir passen dein Training an dein Ziel an.
    </p>
    <div className="flex flex-col gap-3 mb-auto">
      {personas.map((p) => {
        const selected = value === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onChange(p.id)}
            className={`flex items-center gap-4 rounded-2xl p-5 text-left transition-all border active:scale-[0.98] ${
              selected
                ? 'border-[var(--accent-color)] shadow-lg'
                : 'border-[var(--border-color)]'
            }`}
            style={{
              backgroundColor: selected ? 'var(--accent-color-bg, rgba(0,122,255,0.1))' : 'var(--card-bg)',
            }}
          >
            <span className="text-3xl">{p.emoji}</span>
            <div>
              <div className="text-base font-bold" style={{ color: selected ? 'var(--accent-color)' : 'var(--text-color)' }}>
                {p.label}
              </div>
              <div className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {p.desc}
              </div>
            </div>
          </button>
        );
      })}
    </div>
    <div className="mt-8">
      <AppButton onClick={onNext} fullWidth size="lg" className="!rounded-2xl !text-lg !font-black shadow-lg">
        Weiter
      </AppButton>
    </div>
  </div>
);

/* ─── Step 3: Zeit ─── */

const times = [
  { min: 20, label: '20 min', desc: 'Kurz & knackig' },
  { min: 30, label: '30 min', desc: 'Kompakt' },
  { min: 45, label: '45 min', desc: 'Standard' },
  { min: 60, label: '60+ min', desc: 'Ausgiebig' },
];

const TimeStep: React.FC<{ value: number; onChange: (v: number) => void; onNext: () => void }> = ({
  value, onChange, onNext,
}) => (
  <div className="flex-1 flex flex-col px-6">
    <h2 className="text-2xl font-bold tracking-tight mb-2" style={{ color: 'var(--text-color)' }}>
      Wie viel Zeit hast du?
    </h2>
    <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
      Pro Trainingseinheit — du kannst es spaeter aendern.
    </p>
    <div className="grid grid-cols-2 gap-3 mb-auto">
      {times.map((t) => {
        const selected = value === t.min;
        return (
          <button
            key={t.min}
            onClick={() => onChange(t.min)}
            className={`rounded-2xl p-5 text-center transition-all border active:scale-[0.97] ${
              selected
                ? 'border-[var(--accent-color)] shadow-lg'
                : 'border-[var(--border-color)]'
            }`}
            style={{
              backgroundColor: selected ? 'var(--accent-color-bg, rgba(0,122,255,0.1))' : 'var(--card-bg)',
            }}
          >
            <div
              className="text-2xl font-black"
              style={{ color: selected ? 'var(--accent-color)' : 'var(--text-color)' }}
            >
              {t.label}
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              {t.desc}
            </div>
          </button>
        );
      })}
    </div>
    <div className="mt-8">
      <AppButton onClick={onNext} fullWidth size="lg" className="!rounded-2xl !text-lg !font-black shadow-lg">
        Weiter
      </AppButton>
    </div>
  </div>
);

/* ─── Step 4: Fitness Level ─── */

const levels = [
  { lvl: 1, label: 'Einsteiger', desc: 'Noch keine Erfahrung' },
  { lvl: 2, label: 'Anfaenger', desc: 'Ein paar Monate dabei' },
  { lvl: 3, label: 'Fortgeschritten', desc: '1–2 Jahre Training' },
  { lvl: 4, label: 'Erfahren', desc: '3+ Jahre konsequent' },
  { lvl: 5, label: 'Profi', desc: 'Wettkampf-Level' },
];

const StarIcon: React.FC<{ filled: boolean; size?: number }> = ({ filled, size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
      fill={filled ? 'var(--accent-color)' : 'none'}
      stroke={filled ? 'var(--accent-color)' : 'var(--border-color)'}
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </svg>
);

const FitnessStep: React.FC<{ value: number; onChange: (v: number) => void; onNext: () => void }> = ({
  value, onChange, onNext,
}) => {
  const current = levels.find((l) => l.lvl === value);
  return (
    <div className="flex-1 flex flex-col px-6">
      <h2 className="text-2xl font-bold tracking-tight mb-2" style={{ color: 'var(--text-color)' }}>
        Dein Fitness-Level
      </h2>
      <p className="text-sm mb-10" style={{ color: 'var(--text-secondary)' }}>
        Sei ehrlich — wir passen alles an dich an.
      </p>

      <div className="flex justify-center gap-3 mb-6">
        {levels.map((l) => (
          <button
            key={l.lvl}
            onClick={() => onChange(l.lvl)}
            className="transition-transform active:scale-90"
          >
            <StarIcon filled={l.lvl <= value} />
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={value}
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -8, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="text-center mb-auto"
        >
          <div className="text-lg font-bold" style={{ color: 'var(--accent-color)' }}>
            {current?.label}
          </div>
          <div className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {current?.desc}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="mt-8">
        <AppButton onClick={onNext} fullWidth size="lg" className="!rounded-2xl !text-lg !font-black shadow-lg">
          Weiter
        </AppButton>
      </div>
    </div>
  );
};

/* ─── Step 5: Garmin Import ─── */

interface GarminImportResult {
  activities: number;
  dailyMetrics: number;
  sleepSummaries: number;
}

const GarminStep: React.FC<{ onNext: () => void }> = ({ onNext }) => {
  const [step, setGarminStep] = useState<'idle' | 'connecting' | 'connected' | 'fetching' | 'preview' | 'done' | 'error'>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<GarminImportResult | null>(null);

  const handleConnect = async () => {
    try {
      setGarminStep('connecting');
      setLoading(true);
      setError(null);
      const { getSupabaseClient: getSB } = await import('../lib/supabaseClient');
      const supabase = getSB();
      if (!supabase) throw new Error('Nicht eingeloggt');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Keine aktive Sitzung – bitte erneut einloggen');

      const { data, error: err } = await supabase.functions.invoke('garmin-auth-init', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (err) throw err;
      if (data?.error) throw new Error(data.error);

      const { authorizeUrl } = data as { authorizeUrl: string };
      if (!authorizeUrl) throw new Error('Keine Authorize-URL erhalten');

      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url: authorizeUrl });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verbindung fehlgeschlagen');
      setGarminStep('error');
    } finally {
      setLoading(false);
    }
  };

  const handleFetchData = async () => {
    try {
      setGarminStep('fetching');
      setError(null);
      const { getSupabaseClient: getSB } = await import('../lib/supabaseClient');
      const supabase = getSB();
      if (!supabase) throw new Error('Nicht eingeloggt');

      const { data: { session: fetchSession } } = await supabase.auth.getSession();
      if (!fetchSession) throw new Error('Keine aktive Sitzung – bitte erneut einloggen');

      const { data, error: err } = await supabase.functions.invoke('garmin-fetch-data', {
        headers: { Authorization: `Bearer ${fetchSession.access_token}` },
      });
      if (err) throw err;

      const result: GarminImportResult = {
        activities: data?.activities ?? 0,
        dailyMetrics: data?.dailyMetrics ?? data?.daily_metrics ?? 0,
        sleepSummaries: data?.sleepSummaries ?? data?.sleep_summaries ?? 0,
      };
      setImportResult(result);
      setGarminStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Daten konnten nicht geladen werden');
      setGarminStep('error');
    }
  };

  // Listen for deep link callback (native) and custom event (web/fallback)
  React.useEffect(() => {
    const onConnected = () => {
      setGarminStep('connected');
    };
    window.addEventListener('trainq:garmin_connected', onConnected);

    let removeAppListener: (() => void) | null = null;
    import('@capacitor/core').then(({ Capacitor }) => {
      if (!Capacitor.isNativePlatform()) return;
      import('@capacitor/app').then(({ App }) => {
        App.addListener('appUrlOpen', async (event: { url: string }) => {
          if (!event.url.includes('garmin')) return;
          try {
            const { Browser } = await import('@capacitor/browser');
            await Browser.close();
          } catch {
            // already closed
          }
          setGarminStep('connected');
        }).then((handle) => {
          removeAppListener = () => handle.remove();
        });
      });
    });

    return () => {
      window.removeEventListener('trainq:garmin_connected', onConnected);
      removeAppListener?.();
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col px-6">
      <h2 className="text-2xl font-bold tracking-tight mb-2" style={{ color: 'var(--text-color)' }}>
        Garmin importieren
      </h2>
      <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
        Verbinde deine Garmin-Uhr und importiere Aktivitäten, Schlaf und Recovery-Daten.
      </p>

      {/* Idle: Show instructions + connect button */}
      {(step === 'idle' || step === 'connecting') && (
        <div className="space-y-4 mb-auto">
          {[
            { n: '1', text: 'Verbinde dein Garmin-Konto über den Button unten' },
            { n: '2', text: 'Deine Aktivitäten, Schlafdaten und Metriken werden geladen' },
            { n: '3', text: 'Die Daten werden automatisch synchronisiert' },
          ].map((s) => (
            <div key={s.n} className="flex items-start gap-3">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                style={{ backgroundColor: '#10b981', color: '#fff' }}
              >
                {s.n}
              </div>
              <p className="text-sm pt-0.5" style={{ color: 'var(--text-color)' }}>
                {s.text}
              </p>
            </div>
          ))}

          <div className="pt-4">
            <AppButton
              onClick={handleConnect}
              isLoading={loading}
              fullWidth
              size="lg"
              className="!rounded-2xl !font-bold"
              style={{ backgroundColor: '#10b981' }}
            >
              <Watch size={18} className="mr-2" />
              Mit Garmin verbinden
            </AppButton>
          </div>
        </div>
      )}

      {/* Connected: Show fetch button */}
      {step === 'connected' && (
        <div className="mb-auto space-y-4">
          <div className="flex flex-col items-center py-6">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: 'rgba(16,185,129,0.15)', border: '2px solid #10b981' }}
            >
              <CheckCircle size={32} className="text-emerald-500" />
            </div>
            <p className="text-base font-semibold text-emerald-500 mb-6">Erfolgreich verbunden!</p>
          </div>

          <AppButton
            onClick={handleFetchData}
            fullWidth
            size="lg"
            className="!rounded-2xl !text-lg !font-black shadow-lg"
          >
            <Activity size={18} className="mr-2" />
            Daten importieren
          </AppButton>
        </div>
      )}

      {/* Fetching */}
      {step === 'fetching' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Watch size={40} className="mx-auto mb-3 animate-pulse" style={{ color: '#10b981' }} />
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Garmin-Daten werden geladen...</p>
          </div>
        </div>
      )}

      {/* Done: Show summary */}
      {step === 'done' && importResult && (
        <div className="mb-auto">
          <div className="flex justify-center mb-4">
            <CheckCircle size={48} className="text-green-400" />
          </div>
          <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--card-bg)' }}>
            <h3 className="text-base font-bold" style={{ color: 'var(--text-color)' }}>Import abgeschlossen</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Activity size={16} style={{ color: 'var(--accent-color)' }} />
                <span className="text-sm" style={{ color: 'var(--text-color)' }}>
                  {importResult.activities} Aktivitäten
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Heart size={16} style={{ color: 'var(--accent-color)' }} />
                <span className="text-sm" style={{ color: 'var(--text-color)' }}>
                  {importResult.dailyMetrics} Tages-Metriken
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Moon size={16} style={{ color: 'var(--accent-color)' }} />
                <span className="text-sm" style={{ color: 'var(--text-color)' }}>
                  {importResult.sleepSummaries} Schlaf-Einträge
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {step === 'error' && (
        <div className="mb-auto">
          <div className="p-4 rounded-2xl border border-red-500/20 bg-red-500/10 mb-4">
            <p className="text-sm text-red-400">{error}</p>
          </div>
          <AppButton
            onClick={() => { setError(null); setGarminStep('idle'); }}
            fullWidth
            variant="secondary"
            size="md"
            className="!rounded-2xl"
          >
            Nochmal versuchen
          </AppButton>
        </div>
      )}

      {/* Bottom: Next / Skip */}
      <div className="mt-6">
        {step === 'done' ? (
          <AppButton
            onClick={onNext}
            fullWidth
            size="lg"
            className="!rounded-2xl !text-lg !font-black shadow-lg"
          >
            Weiter
          </AppButton>
        ) : step !== 'fetching' && step !== 'connecting' ? (
          <button
            onClick={onNext}
            className="w-full py-3 text-center text-sm font-semibold transition-opacity active:opacity-60"
            style={{ color: 'var(--text-secondary)' }}
          >
            Überspringen
          </button>
        ) : null}
      </div>
    </div>
  );
};

/* ─── Step 6: CSV Import ─── */

const CsvStep: React.FC<{ onFinish: () => void; loading: boolean }> = ({ onFinish, loading }) => {
  const csv = useCsvImport();

  return (
    <div className="flex-1 flex flex-col px-6">
      <h2 className="text-2xl font-bold tracking-tight mb-2" style={{ color: 'var(--text-color)' }}>
        Daten aus einer anderen App?
      </h2>
      <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
        Importiere deine bisherigen Trainings per CSV — oder ueberspringe diesen Schritt.
      </p>

      {/* Instructions (idle state) */}
      {(csv.step === 'idle' || csv.step === 'picking') && (
        <div className="space-y-4 mb-auto">
          {[
            { n: '1', text: 'Exportiere deine Daten als CSV aus deiner bisherigen App' },
            { n: '2', text: 'Die Datei braucht Spalten: Datum, Uebung, Gewicht, Wiederholungen' },
            { n: '3', text: 'Waehle die Datei aus und wir importieren alles automatisch' },
          ].map((s) => (
            <div key={s.n} className="flex items-start gap-3">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                style={{ backgroundColor: 'var(--accent-color)', color: '#fff' }}
              >
                {s.n}
              </div>
              <p className="text-sm pt-0.5" style={{ color: 'var(--text-color)' }}>
                {s.text}
              </p>
            </div>
          ))}

          <div className="pt-4">
            <AppButton
              onClick={csv.pickFile}
              fullWidth
              variant="secondary"
              size="lg"
              className="!rounded-2xl !font-bold"
            >
              <Upload size={18} className="mr-2" />
              CSV importieren
            </AppButton>
          </div>
        </div>
      )}

      {/* Parsing */}
      {csv.step === 'parsing' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <FileSpreadsheet size={40} className="mx-auto mb-3 animate-pulse" style={{ color: 'var(--accent-color)' }} />
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Datei wird gelesen...</p>
          </div>
        </div>
      )}

      {/* Preview */}
      {csv.step === 'preview' && csv.preview && (
        <div className="flex-1 flex flex-col min-h-0 mb-4">
          <div className="text-sm font-semibold mb-3" style={{ color: 'var(--text-color)' }}>
            {csv.preview.rows.length} Eintraege gefunden
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 mb-4 rounded-2xl">
            <CsvPreviewTable rows={csv.preview.rows} matchedExercises={csv.preview.matchedExercises} />
          </div>
          <AppButton
            onClick={csv.startImport}
            fullWidth
            size="lg"
            className="!rounded-2xl !text-lg !font-black shadow-lg"
          >
            {csv.preview.rows.length} Eintraege importieren
          </AppButton>
        </div>
      )}

      {/* Importing */}
      {csv.step === 'importing' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <FileSpreadsheet size={40} className="mx-auto mb-3 animate-spin" style={{ color: 'var(--accent-color)' }} />
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Wird importiert...</p>
          </div>
        </div>
      )}

      {/* Done */}
      {csv.step === 'done' && csv.result && (
        <div className="mb-auto">
          <div className="flex justify-center mb-4">
            <CheckCircle size={48} className="text-green-400" />
          </div>
          <CsvImportSummary result={csv.result} />
        </div>
      )}

      {/* Error */}
      {csv.step === 'error' && (
        <div className="mb-auto">
          <div
            className="p-4 rounded-2xl border border-red-500/20 bg-red-500/10 mb-4"
          >
            <p className="text-sm text-red-400">{csv.error}</p>
          </div>
          <AppButton onClick={csv.reset} fullWidth variant="secondary" size="md" className="!rounded-2xl">
            Nochmal versuchen
          </AppButton>
        </div>
      )}

      {/* Bottom: Finish / Skip */}
      <div className="mt-6">
        {csv.step === 'done' ? (
          <AppButton
            onClick={onFinish}
            isLoading={loading}
            fullWidth
            size="lg"
            className="!rounded-2xl !text-lg !font-black shadow-lg"
          >
            Los geht's
          </AppButton>
        ) : csv.step !== 'preview' && csv.step !== 'importing' && csv.step !== 'parsing' ? (
          <button
            onClick={onFinish}
            disabled={loading}
            className="w-full py-3 text-center text-sm font-semibold transition-opacity active:opacity-60"
            style={{ color: 'var(--text-secondary)' }}
          >
            {loading ? 'Wird gespeichert...' : 'Weiter ohne Import'}
          </button>
        ) : null}
      </div>
    </div>
  );
};

/* ─── Main Onboarding Component ─── */

export const Onboarding: React.FC = () => {
  const { user, completeOnboarding } = useAuth();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1); // 1 = forward, -1 = backward
  const [saving, setSaving] = useState(false);

  const [goal, setGoal] = useState('beginner');
  const [timePerWorkout, setTimePerWorkout] = useState(45);
  const [fitnessLevel, setFitnessLevel] = useState(3);

  const goForward = useCallback(() => {
    setDir(1);
    setStep((s) => Math.min(s + 1, 6));
  }, []);

  const goBack = useCallback(() => {
    setDir(-1);
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  const handleFinish = useCallback(async () => {
    setSaving(true);
    try {
      const preferences = {
        persona: goal,
        fitness_level: fitnessLevel,
        time_budget: String(timePerWorkout * 3),
      };

      if (user?.provider === 'local') {
        localStorage.setItem('user_preferences', JSON.stringify(preferences));
      } else {
        const client = getSupabaseClient();
        if (client && user?.id) {
          try { await client.from('profiles').update(preferences).eq('id', user.id); } catch { /* ignore */ }
        }
      }

      await completeOnboarding();
      window.history.replaceState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (e) {
      if (import.meta.env.DEV) console.error('Onboarding error:', e);
      setSaving(false);
    }
  }, [goal, fitnessLevel, timePerWorkout, user, completeOnboarding]);

  if (!user || user.onboardingCompleted) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col overflow-hidden"
      style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-color)' }}
    >
      {/* Safe area top fill */}
      <div
        className="absolute top-0 left-0 right-0 h-[env(safe-area-inset-top)] z-50"
        style={{ backgroundColor: 'var(--bg-color)' }}
      />

      <div className="flex-1 flex flex-col w-full max-w-md mx-auto pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+12px)] overflow-hidden">
        {/* Top bar: back + progress */}
        <div className="flex items-center px-4 mb-2">
          {step > 0 ? (
            <button
              onClick={goBack}
              className="p-2 -ml-2 rounded-xl transition-colors active:bg-[var(--button-bg)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              <ArrowLeft size={22} />
            </button>
          ) : (
            <div className="w-[38px]" />
          )}
          <div className="flex-1">
            <ProgressDots current={step} total={7} />
          </div>
          <div className="w-[38px]" />
        </div>

        {/* Animated step content */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto no-scrollbar">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={slideTransition}
              className="flex-1 flex flex-col"
            >
              {step === 0 && <WelcomeStep onNext={goForward} />}
              {step === 1 && <PermissionsStep onNext={goForward} />}
              {step === 2 && <FokusStep value={goal} onChange={setGoal} onNext={goForward} />}
              {step === 3 && <TimeStep value={timePerWorkout} onChange={setTimePerWorkout} onNext={goForward} />}
              {step === 4 && <FitnessStep value={fitnessLevel} onChange={setFitnessLevel} onNext={goForward} />}
              {step === 5 && <GarminStep onNext={goForward} />}
              {step === 6 && <CsvStep onFinish={handleFinish} loading={saving} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
