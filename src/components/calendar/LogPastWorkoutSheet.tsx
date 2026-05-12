import React, { useState, useMemo } from "react";
import { BottomSheet } from "../common/BottomSheet";
import { useI18n } from "../../i18n/useI18n";
import { Clock, Minus, Plus, MapPin, Dumbbell, Trash2, X } from "lucide-react";
import { IconFigureRun } from "../../assets/icons/IconFigureRun";
import { IconDumbbellFill } from "../../assets/icons/IconDumbbellFill";
import { IconFigureStrengthtrainingFunctional } from "../../assets/icons/IconFigureStrengthtrainingFunctional";
import { Bike } from "lucide-react";
import { getTemplates, type TrainingTemplateLite, type TemplateExercise } from "../../utils/trainingTemplatesStore";
import { hapticSelect, hapticButton, hapticDestructive } from "../../native/haptics";
import ExerciseLibraryModal from "../training/ExerciseLibraryModal";
import type { Exercise } from "../../data/exerciseLibrary";

type Sport = "gym" | "laufen" | "radfahren" | "custom";
type Tab = "log" | "plan";

export interface LogPastData {
  date: string; sport: Sport; title: string; durationMin: number;
  exerciseCount: number; setCount: number; volumeKg: number; distanceKm: number;
  templateId?: string;
}

export interface PlanData {
  date: string; sport: Sport; title: string; templateId?: string; exercises?: TemplateExercise[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  initialDate?: string;
  initialTab?: Tab;
  onSave: (data: LogPastData) => void;
  onPlan: (data: PlanData) => void;
}

const makeDefaultSets = () => [
  { reps: undefined as number | undefined, weight: undefined as number | undefined },
  { reps: undefined, weight: undefined },
  { reps: undefined, weight: undefined },
];

export function LogPastWorkoutSheet({ open, onClose, initialDate, initialTab, onSave, onPlan }: Props) {
  const { t } = useI18n();
  const todayISO = new Date().toISOString().split("T")[0];

  const [tab, setTab] = useState<Tab>(initialTab || "log");
  const [date, setDate] = useState(initialDate || todayISO);
  const [sport, setSport] = useState<Sport>("gym");
  const [title, setTitle] = useState("");
  const [durationMin, setDurationMin] = useState(45);
  const [exerciseCount, setExerciseCount] = useState(5);
  const [setCount, setSetCount] = useState(15);
  const [volumeKg, setVolumeKg] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [exercises, setExercises] = useState<TemplateExercise[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);

  const templates = useMemo(() => getTemplates(), [open]);
  const isCardio = sport === "laufen" || sport === "radfahren";

  React.useEffect(() => {
    if (open) {
      setTab(initialTab || "log");
      setDate(initialDate || todayISO);
      setSport("gym");
      setTitle("");
      setDurationMin(45);
      setExerciseCount(5);
      setSetCount(15);
      setVolumeKg(0);
      setDistanceKm(0);
      setSelectedTemplateId(null);
      setShowTemplates(false);
      setExercises([]);
      setShowLibrary(false);
    }
  }, [open, initialDate, initialTab]);

  const loadTemplate = (tpl: TrainingTemplateLite) => {
    hapticSelect();
    setTitle(tpl.title);
    setSelectedTemplateId(tpl.id);
    setExercises(tpl.exercises || []);
    setExerciseCount(tpl.exercises?.length ?? 0);
    const totalSets = (tpl.exercises ?? []).reduce((sum, ex) => sum + (ex.sets?.length ?? 0), 0);
    setSetCount(totalSets || (tpl.exercises?.length ?? 0) * 3);
    const sportMap: Record<string, Sport> = { gym: "gym", laufen: "laufen", radfahren: "radfahren", custom: "custom" };
    setSport(sportMap[tpl.sportType] || "gym");
    setShowTemplates(false);
  };

  const handlePickExercise = (exercise: Exercise) => {
    hapticButton();
    setExercises((prev) => [...prev, { exerciseId: exercise.id, name: exercise.name, sets: makeDefaultSets() }]);
  };

  const handleRemoveExercise = (idx: number) => {
    hapticDestructive();
    setExercises((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddSet = (exIdx: number) => {
    hapticButton();
    setExercises((prev) =>
      prev.map((ex, i) => i === exIdx ? { ...ex, sets: [...(ex.sets ?? []), { reps: undefined, weight: undefined }] } : ex)
    );
  };

  const handleRemoveSet = (exIdx: number, setIdx: number) => {
    hapticDestructive();
    setExercises((prev) =>
      prev.map((ex, i) => i === exIdx ? { ...ex, sets: (ex.sets ?? []).filter((_, si) => si !== setIdx) } : ex)
    );
  };

  const handleSetChange = (exIdx: number, setIdx: number, field: "reps" | "weight", value: string) => {
    const num = value === "" ? undefined : parseFloat(value);
    setExercises((prev) =>
      prev.map((ex, i) =>
        i === exIdx ? { ...ex, sets: (ex.sets ?? []).map((s, si) => si === setIdx ? { ...s, [field]: num } : s) } : ex
      )
    );
  };

  const handleSave = () => {
    const finalTitle = title || (sport === "laufen" ? "Laufen" : sport === "radfahren" ? "Radfahren" : sport === "custom" ? "Training" : "Gym Training");
    if (tab === "plan") {
      onPlan({ date, sport, title: finalTitle, templateId: selectedTemplateId || undefined, exercises: exercises.length > 0 ? exercises : undefined });
    } else {
      onSave({ date, sport, title: finalTitle, durationMin, exerciseCount, setCount, volumeKg, distanceKm, templateId: selectedTemplateId || undefined });
    }
    onClose();
  };

  const sports = [
    { key: "gym" as Sport, icon: <IconDumbbellFill width={20} height={12} />, label: t("logPast.gym") },
    { key: "laufen" as Sport, icon: <IconFigureRun style={{ width: 20, height: 20 }} />, label: t("logPast.running") },
    { key: "radfahren" as Sport, icon: <Bike size={20} />, label: t("logPast.cycling") },
    { key: "custom" as Sport, icon: <IconFigureStrengthtrainingFunctional width={20} height={22} />, label: t("logPast.custom") },
  ];

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
  const existingIds = exercises.map((e) => e.exerciseId).filter(Boolean) as string[];

  const StepperRow = ({ label, value, onChange, icon, unit }: { label: string; value: number; onChange: (v: number) => void; icon?: React.ReactNode; unit?: string }) => (
    <div className="flex items-center justify-between px-4 py-3.5">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[15px] font-medium" style={{ color: "var(--text-color)" }}>{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <button onPointerUp={() => onChange(Math.max(0, value - (unit === "min" ? 5 : 1)))}
          className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-90"
          style={{ backgroundColor: "var(--button-bg)", touchAction: "manipulation" }}>
          <Minus size={14} style={{ color: "var(--text-color)" }} />
        </button>
        <input type="number" inputMode="numeric" value={value || ""} placeholder="–"
          onChange={(e) => onChange(Math.max(0, parseInt(e.target.value) || 0))}
          className="w-14 text-center rounded-lg py-1.5 text-[15px] font-bold outline-none"
          style={{ backgroundColor: "var(--button-bg)", color: "var(--text-color)" }} />
        {unit && <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>{unit}</span>}
        <button onPointerUp={() => onChange(value + (unit === "min" ? 5 : 1))}
          className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-90"
          style={{ backgroundColor: "var(--button-bg)", touchAction: "manipulation" }}>
          <Plus size={14} style={{ color: "var(--text-color)" }} />
        </button>
      </div>
    </div>
  );

  return (
    <>
    <BottomSheet open={open} onClose={onClose} height="88dvh" maxHeight="92dvh">
      <div className="px-5 pb-8">
        {/* Tab switcher */}
        <div className="flex p-1 rounded-2xl mb-5" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border-color)" }}>
          {([
            { key: "log" as Tab, label: t("logPast.title") },
            { key: "plan" as Tab, label: t("logPast.planTitle") },
          ]).map(({ key, label }) => (
            <button key={key}
              onPointerUp={() => { hapticSelect(); setTab(key); }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
              style={{
                backgroundColor: tab === key ? "var(--bg-color)" : "transparent",
                color: tab === key ? "var(--text-color)" : "var(--text-secondary)",
                boxShadow: tab === key ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
                touchAction: "manipulation",
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* Title */}
        <h3 className="text-[28px] font-black tracking-tight mb-1" style={{ color: "var(--text-color)", letterSpacing: "-0.5px" }}>
          {tab === "plan" ? t("logPast.planTitle") : t("logPast.title")}
        </h3>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder={sport === "laufen" ? "Laufen" : sport === "radfahren" ? "Radfahren" : "Training"}
          className="w-full px-4 py-3.5 rounded-2xl text-[17px] font-semibold outline-none mt-3 mb-4"
          style={{ backgroundColor: "var(--card-bg)", color: "var(--text-color)", border: "1px solid var(--border-color)" }} />

        {/* Sport */}
        <p className="text-[11px] font-bold uppercase tracking-wider mb-2 pl-1" style={{ color: "var(--text-secondary)" }}>{t("logPast.sport")}</p>
        <div className="flex gap-2 mb-4">
          {sports.map(({ key, icon, label }) => (
            <button key={key}
              onPointerUp={() => { hapticSelect(); setSport(key); }}
              className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all active:scale-[0.95]"
              style={{
                backgroundColor: sport === key ? "rgba(0,122,255,0.12)" : "var(--card-bg)",
                color: sport === key ? "#007AFF" : "var(--text-secondary)",
                border: sport === key ? "1.5px solid rgba(0,122,255,0.3)" : "1.5px solid var(--border-color)",
                touchAction: "manipulation",
              }}>
              {icon}
              <span className="text-[10px] font-semibold">{label}</span>
            </button>
          ))}
        </div>

        {/* Date */}
        <div className="rounded-2xl overflow-hidden mb-4" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border-color)" }}>
          <div className="flex items-center justify-between px-4 py-3.5">
            <span className="text-[15px] font-medium" style={{ color: "var(--text-color)" }}>{t("logPast.date")}</span>
            <input type="date" value={date} max={tab === "log" ? todayISO : undefined}
              onChange={(e) => setDate(e.target.value)}
              className="text-[15px] font-bold rounded-lg px-3 py-1.5"
              style={{ backgroundColor: "var(--button-bg)", color: "var(--text-color)" }} />
          </div>
        </div>

        {/* Template loader */}
        {templates.length > 0 && !showTemplates && (
          <button onPointerUp={() => setShowTemplates(true)}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl mb-4 active:scale-[0.98] transition-transform"
            style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border-color)", touchAction: "manipulation" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(0,122,255,0.1)" }}>
              <Dumbbell size={16} className="text-blue-500" />
            </div>
            <div className="flex-1 text-left">
              <span className="text-[14px] font-semibold" style={{ color: "var(--text-color)" }}>
                {selectedTemplate ? selectedTemplate.title : t("logPast.loadTemplate")}
              </span>
              {selectedTemplate && (
                <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  {selectedTemplate.exercises?.length ?? 0} {t("logPast.exercises")}
                </p>
              )}
            </div>
          </button>
        )}
        {showTemplates && (
          <div className="mb-4 space-y-1.5">
            <button onPointerUp={() => { setShowTemplates(false); setSelectedTemplateId(null); setExercises([]); setTitle(""); }}
              className="w-full px-4 py-2.5 rounded-xl text-[13px] font-medium text-left active:opacity-70"
              style={{ color: "var(--text-secondary)", touchAction: "manipulation" }}>
              {t("logPast.noTemplate")}
            </button>
            {templates.map((tpl) => (
              <button key={tpl.id} onPointerUp={() => loadTemplate(tpl)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl active:scale-[0.98] transition-transform"
                style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border-color)", touchAction: "manipulation" }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(0,122,255,0.1)" }}>
                  <IconDumbbellFill width={14} height={9} style={{ color: "#007AFF" }} />
                </div>
                <div className="min-w-0 text-left">
                  <div className="text-[14px] font-semibold truncate" style={{ color: "var(--text-color)" }}>{tpl.title}</div>
                  <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    {tpl.exercises?.length ?? 0} {t("logPast.exercises")}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── PLAN TAB: Exercise editor ── */}
        {tab === "plan" && !isCardio && (
          <div className="mb-4 space-y-2">
            {exercises.length > 0 && (
              <p className="text-[11px] font-bold uppercase tracking-wider pl-1 mb-1" style={{ color: "var(--text-secondary)" }}>
                {t("logPast.exercises")} ({exercises.length})
              </p>
            )}
            {exercises.map((ex, exIdx) => (
              <div key={exIdx} className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border-color)" }}>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-[14px] font-semibold truncate flex-1" style={{ color: "var(--text-color)" }}>{ex.name}</span>
                  <button onPointerUp={() => handleRemoveExercise(exIdx)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-90 shrink-0"
                    style={{ touchAction: "manipulation" }}>
                    <X size={14} style={{ color: "#ef4444" }} />
                  </button>
                </div>
                {/* Sets */}
                <div className="px-4 pb-3">
                  <div className="flex gap-2 mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider w-8 text-center" style={{ color: "var(--text-secondary)" }}>#</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider flex-1 text-center" style={{ color: "var(--text-secondary)" }}>KG</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider flex-1 text-center" style={{ color: "var(--text-secondary)" }}>Wdh.</span>
                    <span className="w-7" />
                  </div>
                  {(ex.sets ?? []).map((set, setIdx) => (
                    <div key={setIdx} className="flex gap-2 items-center mb-1.5">
                      <span className="text-[13px] font-bold w-8 text-center" style={{ color: "var(--text-secondary)" }}>{setIdx + 1}</span>
                      <input type="number" inputMode="decimal" value={set.weight ?? ""} placeholder="–"
                        onChange={(e) => handleSetChange(exIdx, setIdx, "weight", e.target.value)}
                        className="flex-1 h-9 rounded-xl text-center text-[14px] font-bold outline-none"
                        style={{ backgroundColor: "var(--button-bg)", color: "var(--text-color)" }} />
                      <input type="number" inputMode="numeric" value={set.reps ?? ""} placeholder="–"
                        onChange={(e) => handleSetChange(exIdx, setIdx, "reps", e.target.value)}
                        className="flex-1 h-9 rounded-xl text-center text-[14px] font-bold outline-none"
                        style={{ backgroundColor: "var(--button-bg)", color: "var(--text-color)" }} />
                      <button onPointerUp={() => handleRemoveSet(exIdx, setIdx)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-90"
                        style={{ touchAction: "manipulation" }}>
                        <Trash2 size={12} style={{ color: "var(--text-secondary)" }} />
                      </button>
                    </div>
                  ))}
                  <button onPointerUp={() => handleAddSet(exIdx)}
                    className="w-full py-2 rounded-xl text-[12px] font-semibold active:scale-[0.98]"
                    style={{ color: "#007AFF", touchAction: "manipulation" }}>
                    + {t("logPast.addSet")}
                  </button>
                </div>
              </div>
            ))}

            {/* Add exercise button */}
            <button onPointerUp={() => { hapticButton(); setShowLibrary(true); }}
              className="w-full py-3.5 rounded-2xl border-2 border-dashed flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              style={{ borderColor: "var(--border-color)", touchAction: "manipulation" }}>
              <Plus size={16} style={{ color: "var(--text-secondary)" }} />
              <span className="text-[13px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                {t("logPast.addExercise")}
              </span>
            </button>
          </div>
        )}

        {/* ── LOG TAB: Metrics ── */}
        {tab === "log" && (
          <div className="rounded-2xl overflow-hidden mb-5" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border-color)" }}>
            <StepperRow label={t("logPast.duration")} value={durationMin} onChange={setDurationMin}
              icon={<Clock size={16} style={{ color: "var(--text-secondary)" }} />} unit="min" />
            {!isCardio && (
              <>
                <div style={{ height: 1, backgroundColor: "var(--border-color)" }} />
                <StepperRow label={t("logPast.exercises")} value={exerciseCount} onChange={(v) => setExerciseCount(Math.max(1, v))} />
                <div style={{ height: 1, backgroundColor: "var(--border-color)" }} />
                <StepperRow label={t("logPast.sets")} value={setCount} onChange={(v) => setSetCount(Math.max(1, v))} />
                <div style={{ height: 1, backgroundColor: "var(--border-color)" }} />
                <div className="flex items-center justify-between px-4 py-3.5">
                  <span className="text-[15px] font-medium" style={{ color: "var(--text-color)" }}>{t("logPast.volume")}</span>
                  <div className="flex items-center gap-2">
                    <input type="number" inputMode="numeric" value={volumeKg || ""} placeholder="–"
                      onChange={(e) => setVolumeKg(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-20 text-center rounded-lg py-1.5 text-[15px] font-bold outline-none"
                      style={{ backgroundColor: "var(--button-bg)", color: "var(--text-color)" }} />
                    <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>kg</span>
                  </div>
                </div>
              </>
            )}
            {isCardio && (
              <>
                <div style={{ height: 1, backgroundColor: "var(--border-color)" }} />
                <div className="flex items-center justify-between px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} style={{ color: "var(--text-secondary)" }} />
                    <span className="text-[15px] font-medium" style={{ color: "var(--text-color)" }}>{t("logPast.distance")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="number" inputMode="decimal" step="0.1" value={distanceKm || ""} placeholder="–"
                      onChange={(e) => setDistanceKm(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-20 text-center rounded-lg py-1.5 text-[15px] font-bold outline-none"
                      style={{ backgroundColor: "var(--button-bg)", color: "var(--text-color)" }} />
                    <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>km</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Hint for plan */}
        {tab === "plan" && exercises.length === 0 && !selectedTemplateId && (
          <p className="text-[13px] text-center mb-4" style={{ color: "var(--text-secondary)" }}>
            {t("logPast.planHint")}
          </p>
        )}

        {/* Save button */}
        <button onPointerUp={handleSave}
          className="w-full py-4 rounded-2xl text-[17px] font-bold text-white active:scale-[0.97] transition-transform"
          style={{ backgroundColor: tab === "plan" ? "#34C759" : "#007AFF", touchAction: "manipulation" }}>
          {tab === "plan" ? t("logPast.planSave") : t("logPast.save")}
        </button>
      </div>
    </BottomSheet>

    {/* Exercise Library Modal */}
    <ExerciseLibraryModal
      open={showLibrary}
      onClose={() => setShowLibrary(false)}
      onPick={handlePickExercise}
      existingExerciseIds={existingIds}
      category={sport === "laufen" ? "running" : sport === "radfahren" ? "cycling" : "gym"}
    />
    </>
  );
}
