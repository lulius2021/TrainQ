// src/pages/onboarding/steps/Step2Goals.tsx
import React, { useEffect, useMemo, useState } from "react";
import { StepWrapper } from "../StepWrapper";
import { useOnboarding } from "../../../context/OnboardingContext";
import type { GoalsData } from "../../../types/onboarding";

interface Step2GoalsProps {
  onNext: () => void;
  onBack: () => void;
}

type SportTypeUI = "run" | "gym" | "bike" | "other";

const SPORT_LABELS: Record<SportTypeUI, string> = {
  run: "Laufen",
  gym: "Gym",
  bike: "Radfahren",
  other: "Sonstiges",
};

const GOAL_KEYS = ["muscle", "fitness", "fatloss", "performance"] as const;
type GoalKey = (typeof GOAL_KEYS)[number];

const GOAL_LABELS: Record<GoalKey, string> = {
  muscle: "Muskelaufbau",
  fitness: "Fitter werden",
  fatloss: "Abnehmen",
  performance: "Leistung",
};

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

function sanitizeGoals(input?: Partial<GoalsData> | null): GoalsData {
  const g = (input ?? {}) as Partial<GoalsData>;

  // sports
  const sportsRaw = Array.isArray(g.sports) ? g.sports : [];
  const sports = sportsRaw
    .map((s) => String(s))
    .filter((s): s is SportTypeUI => (["run", "gym", "bike", "other"] as const).includes(s as SportTypeUI));

  // primaryGoal (falls vorhanden)
  const primaryGoalRaw = typeof (g as any).primaryGoal === "string" ? String((g as any).primaryGoal) : "";
  const primaryGoal: GoalKey =
    (GOAL_KEYS as readonly string[]).includes(primaryGoalRaw) ? (primaryGoalRaw as GoalKey) : "muscle";

  // selectedGoals ist in deinem Type REQUIRED -> wir halten es minimal kompatibel
  const selectedGoalsRaw = Array.isArray((g as any).selectedGoals) ? ((g as any).selectedGoals as unknown[]) : [];
  const selectedGoalsFiltered = selectedGoalsRaw
    .map((x) => String(x))
    .filter((x): x is GoalKey => (GOAL_KEYS as readonly string[]).includes(x));

  const selectedGoals: GoalKey[] = selectedGoalsFiltered.length ? selectedGoalsFiltered : [primaryGoal];

  // Konsistenz: primaryGoal muss drin sein
  const selectedGoalsFinal = selectedGoals.includes(primaryGoal) ? selectedGoals : [primaryGoal];

  return {
    ...(g as any),
    sports: sports.length ? sports : (["gym"] as SportTypeUI[]),
    primaryGoal,
    selectedGoals: selectedGoalsFinal,
  } as GoalsData;
}

export const Step2Goals: React.FC<Step2GoalsProps> = ({ onNext, onBack }) => {
  const { data, updateData } = useOnboarding();

  const initial = useMemo(() => sanitizeGoals(data?.goals as any), [data?.goals]);

  const [local, setLocal] = useState<GoalsData>(() => initial);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) setLocal(initial);
  }, [initial, dirty]);

  const setLocalSafe = (next: React.SetStateAction<GoalsData>) => {
    setDirty(true);
    setLocal(next);
  };

  const toggleSport = (sport: SportTypeUI) => {
    setLocalSafe((prev) => {
      const current = (Array.isArray((prev as any).sports) ? (prev as any).sports : []) as SportTypeUI[];
      const has = current.includes(sport);
      const next = has ? current.filter((s) => s !== sport) : [...current, sport];

      // mindestens 1 Sport aktiv lassen
      const sports = next.length ? next : [sport];

      return { ...(prev as any), sports } as GoalsData;
    });
  };

  const setGoal = (goal: GoalKey) => {
    setLocalSafe((prev) => ({
      ...(prev as any),
      primaryGoal: goal,
      selectedGoals: [goal], // ✅ minimal, ohne Unterpunkte
    }));
  };

  const canContinue = useMemo(() => {
    const sports = (local as any).sports as SportTypeUI[] | undefined;
    return Array.isArray(sports) && sports.length > 0;
  }, [local]);

  const handleNext = () => {
    updateData({ goals: sanitizeGoals(local as any) } as any);
    onNext();
  };

  const card: React.CSSProperties = {
    background: "var(--surface2)",
    border: "1px solid var(--border)",
  };

  const muted: React.CSSProperties = { color: "var(--muted)" };
  const text: React.CSSProperties = { color: "var(--text)" };

  const tileBase =
    "px-3 py-3 rounded-2xl text-sm font-semibold transition hover:opacity-95 w-full text-left";

  const tileStyle = (active: boolean): React.CSSProperties =>
    active
      ? { background: "rgba(255,255,255,0.10)", border: "1px solid var(--border)", color: "var(--text)" }
      : { background: "transparent", border: "1px solid var(--border)", color: "var(--text)" };

  const checkBadgeStyle = (active: boolean): React.CSSProperties => ({
    height: 20,
    width: 20,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    border: "1px solid var(--border)",
    background: active ? "var(--primary)" : "rgba(255,255,255,0.08)",
    color: active ? "#061226" : "transparent",
  });

  const activeGoal = ((local as any).primaryGoal as GoalKey) || "muscle";

  return (
    <StepWrapper
      hideHeader
      hideProgress
      onBack={onBack}
      showBack
      onNext={handleNext}
      nextLabel="Weiter"
      nextDisabled={!canContinue}
    >
      {/* Sportarten */}
      <div className="rounded-2xl p-4 space-y-3" style={card}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold" style={text}>
            Sportarten
          </div>
          <div className="text-[11px]" style={muted}>
            Mehrfachauswahl
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(["run", "gym", "bike", "other"] as SportTypeUI[]).map((k) => {
            const sports = (local as any).sports as SportTypeUI[] | undefined;
            const active = Array.isArray(sports) && sports.includes(k);

            return (
              <button key={k} type="button" onClick={() => toggleSport(k)} className={tileBase} style={tileStyle(active)}>
                <div className="flex items-center justify-between">
                  <span>{SPORT_LABELS[k]}</span>
                  <span style={checkBadgeStyle(active)}>{active ? "✓" : ""}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Ziel */}
      <div className="rounded-2xl p-4 space-y-3" style={card}>
        <div className="text-sm font-semibold" style={text}>
          Ziel
        </div>

        <div className="space-y-2">
          {GOAL_KEYS.map((k) => {
            const active = activeGoal === k;

            return (
              <button
                key={k}
                type="button"
                onClick={() => setGoal(k)}
                className="w-full rounded-2xl px-3 py-3 text-sm font-semibold flex items-center justify-between hover:opacity-95"
                style={tileStyle(active)}
              >
                <span>{GOAL_LABELS[k]}</span>
                <span style={checkBadgeStyle(active)}>{active ? "✓" : ""}</span>
              </button>
            );
          })}
        </div>

        <div className="text-[11px]" style={muted}>
          Später jederzeit änderbar.
        </div>
      </div>
    </StepWrapper>
  );
};