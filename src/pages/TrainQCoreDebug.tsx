// src/pages/TrainQCoreDebug.tsx
// TrainQ Core Debug (DE) – sauber, übersichtlich, gut bedienbar
//
// Ziel:
// - Core testen ohne UI-Chaos
// - Klar getrennt: Setup (Plan/Kalender) vs. Heute (Actions) vs. LiveWorkout
// - Deutsch, kurze Texte, klare Buttons
//
// Hinweis: Debug page only. Vor Launch entfernen oder per Flag verstecken.

import React, { useMemo, useState } from "react";

import type {
  NewTrainingPlan,
  PlanDayRule,
  SplitType,
  WorkoutType,
  WeekdayIndex,
} from "../types";
import type { LiveWorkout } from "../types/liveWorkout";

import {
  loadCoreState,
  createPlan,
  activatePlan,
  ensureCalendarForActivePlan,
  skipWorkoutToday,
  overwriteWorkoutAdaptive,
  startWorkout,
  completeActiveWorkout,
  abortActiveWorkout,
} from "../services/trainqCore";

import {
  clearAllTrainQCore,
  generateId,
  saveCalendarWorkouts,
  loadActiveLiveWorkout,
} from "../utils/trainqStorage";

import { toISODateLocal } from "../utils/calendarGeneration";

// ----------------------------------
// UI Helpers (minimal, kein Tailwind)
// ----------------------------------

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 16,
    paddingTop: "max(16px, env(safe-area-inset-top))",
    maxWidth: 1180,
    margin: "0 auto",
    color: "#e5e7eb",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, Arial, sans-serif',
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
    marginBottom: 12,
  },
  title: { fontSize: 22, fontWeight: 800, margin: 0 },
  subtitle: { fontSize: 12, opacity: 0.75, margin: 0 },
  grid: {
    display: "grid",
    gridTemplateColumns: "1.05fr 0.95fr",
    gap: 14,
    alignItems: "start",
  },
  card: {
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    background: "rgba(2,6,23,0.6)",
    boxShadow: "0 6px 30px rgba(0,0,0,0.25)",
    padding: 14,
  },
  cardTitleRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { margin: 0, fontSize: 14, fontWeight: 800, letterSpacing: 0.2 },
  badge: {
    fontSize: 11,
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.7)",
    opacity: 0.9,
    whiteSpace: "nowrap",
  },
  hr: { border: "none", borderTop: "1px solid rgba(255,255,255,0.08)", margin: "12px 0" },
  row: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
  label: { fontSize: 12, opacity: 0.85, marginBottom: 6, display: "block" },
  input: {
    width: "100%",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.65)",
    color: "#e5e7eb",
    padding: "10px 10px",
    outline: "none",
  },
  select: {
    width: "100%",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.65)",
    color: "#e5e7eb",
    padding: "10px 10px",
    outline: "none",
  },
  btn: {
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(30,41,59,0.55)",
    color: "#e5e7eb",
    padding: "10px 12px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  btnPrimary: {
    background: "rgba(56,189,248,0.12)",
    border: "1px solid rgba(56,189,248,0.35)",
  },
  btnDanger: {
    background: "rgba(248,113,113,0.10)",
    border: "1px solid rgba(248,113,113,0.35)",
    color: "#fecaca",
  },
  btnDisabled: { opacity: 0.4, cursor: "not-allowed" },
  small: { fontSize: 12, opacity: 0.75 },
  tableWrap: {
    maxHeight: 520,
    overflow: "auto",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: {
    textAlign: "left",
    padding: "10px 10px",
    position: "sticky",
    top: 0,
    background: "rgba(2,6,23,0.95)",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    zIndex: 1,
  },
  td: { padding: "10px 10px", borderTop: "1px solid rgba(255,255,255,0.06)" },
  callout: {
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(15,23,42,0.55)",
  },
  mutedBox: {
    padding: 10,
    borderRadius: 12,
    border: "1px dashed rgba(255,255,255,0.18)",
    background: "rgba(15,23,42,0.35)",
  },
};

// ----------------------------------
// Domain constants
// ----------------------------------

const WOCHENTAGE: Array<{ label: string; value: WeekdayIndex }> = [
  { label: "Mo", value: 0 },
  { label: "Di", value: 1 },
  { label: "Mi", value: 2 },
  { label: "Do", value: 3 },
  { label: "Fr", value: 4 },
  { label: "Sa", value: 5 },
  { label: "So", value: 6 },
];

const SPLITS: Array<{ label: string; value: SplitType }> = [
  { label: "Push / Pull", value: "push_pull" },
  { label: "Oberkörper / Unterkörper", value: "upper_lower" },
];

function erlaubteWorkoutTypes(split: SplitType): WorkoutType[] {
  return split === "push_pull" ? ["Push", "Pull"] : ["Upper", "Lower"];
}

function translateWorkoutType(type: string): string {
  if (type === "Upper") return "Oberkörper";
  if (type === "Lower") return "Unterkörper";
  return type;
}

function formatDateDE(isoDate: string): string {
  if (!isoDate) return "-";
  return new Date(isoDate).toLocaleDateString("de-DE");
}

function chipTextForStatus(status: any): string {
  if (status === "completed") return "Erledigt";
  if (status === "skipped") return "Übersprungen";
  if (status === "adaptive") return "Adaptiv";
  return "Geplant";
}

function safeRun<T>(fn: () => T): { ok: true; data: T } | { ok: false; error: string } {
  try {
    const data = fn();
    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export default function TrainQCoreDebug() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastAction, setLastAction] = useState<{ title: string; ok: boolean; msg: string } | null>(null);

  const state = useMemo(() => loadCoreState(), [refreshKey]);
  const activePlan = useMemo(() => state.plans.find((p) => p.isActive), [state.plans]);

  const todayISO = useMemo(() => toISODateLocal(new Date()), []);
  const todaysWorkout = useMemo(
    () => state.calendarWorkouts.find((w) => w.date === todayISO),
    [state.calendarWorkouts, todayISO]
  );

  const activeLiveWorkout = useMemo<LiveWorkout | null>(() => {
    try {
      return loadActiveLiveWorkout();
    } catch {
      return null;
    }
  }, [refreshKey]);

  // Plan-Form
  const [planName, setPlanName] = useState("TrainQ Plan");
  const [split, setSplit] = useState<SplitType>("upper_lower");
  const [startDate, setStartDate] = useState(todayISO);
  const [rules, setRules] = useState<PlanDayRule[]>([
    { weekday: 0, workoutType: "Upper" as WorkoutType },
    { weekday: 2, workoutType: "Lower" as WorkoutType },
    { weekday: 4, workoutType: "Upper" as WorkoutType },
  ]);

  function bump() {
    setRefreshKey((x) => x + 1);
  }

  function report(title: string, res: ReturnType<typeof safeRun>) {
    if (res.ok) setLastAction({ title, ok: true, msg: "OK" });
    else setLastAction({ title, ok: false, msg: res.error });
  }

  // --------------------------
  // Setup / Calendar Generierung
  // --------------------------

  function onEnsureCalendar() {
    const res = safeRun(() => ensureCalendarForActivePlan({ days: 28, fromDate: todayISO }));
    report("Kalender auffüllen (28 Tage)", res);
    bump();
  }

  function onCreatePlan() {
    const input: NewTrainingPlan = {
      name: planName.trim() || "TrainQ Plan",
      sport: "Gym",
      splitType: split,
      startDate,
      weeklyRules: rules,
      isActive: true,
    };

    const res = safeRun(() => {
      const created = createPlan(input, { activate: true });
      ensureCalendarForActivePlan({ days: 28, fromDate: todayISO });
      return created;
    });

    report("Plan erstellen + aktivieren + Kalender erzeugen", res);
    bump();
  }

  function onActivatePlan(planId: string) {
    const res = safeRun(() => activatePlan(planId));
    report("Plan aktivieren", res);
    bump();
  }

  // Debug helper: Today seed
  function seedTodayIfMissing() {
    const res = safeRun(() => {
      if (todaysWorkout) return "Heute existiert bereits.";

      const current = loadCoreState();
      const now = new Date().toISOString();
      const defaultType = erlaubteWorkoutTypes(activePlan?.splitType ?? split)[0];

      const next = [
        ...current.calendarWorkouts,
        {
          id: generateId("cw"),
          date: todayISO,
          workoutType: defaultType,
          sourcePlanId: activePlan?.id,
          status: "planned" as const,
          notes: "Debug Seed (heute)",
          historyEntryId: undefined,
          skippedAt: undefined,
          completedAt: undefined,
          adaptedAt: undefined,
          adaptedFromWorkoutType: undefined,
          createdAt: now,
          updatedAt: now,
        },
      ];

      saveCalendarWorkouts(next);
      return "Heute angelegt.";
    });

    report("Heute anlegen (nur wenn fehlt)", res);
    bump();
  }

  // --------------------------
  // Heute Actions
  // --------------------------

  function onSkipToday() {
    const res = safeRun(() => {
      if (!todaysWorkout) throw new Error("Kein Training für heute vorhanden (Seed Today nutzen).");
      return skipWorkoutToday(todaysWorkout.id, "Debug: Übersprungen");
    });
    report("Heute überspringen", res);
    bump();
  }

  function onAdaptiveOverwriteToday(newType: WorkoutType) {
    const res = safeRun(() => {
      if (!todaysWorkout) throw new Error("Kein Training für heute vorhanden (Seed Today nutzen).");
      return overwriteWorkoutAdaptive(todaysWorkout.id, newType, "Debug: Adaptiv überschrieben");
    });
    report(`Heute adaptiv überschreiben → ${translateWorkoutType(newType)}`, res);
    bump();
  }

  // --------------------------
  // LiveWorkout minimal
  // --------------------------

  function onStartToday() {
    const res = safeRun(() => {
      if (!todaysWorkout) throw new Error("Kein Training für heute vorhanden (Seed Today nutzen).");
      if (activeLiveWorkout) throw new Error("Es läuft bereits ein aktives Workout.");
      return startWorkout(todaysWorkout.id, { notes: "Debug Start" });
    });
    report("Training starten (heute)", res);
    bump();
  }

  function onCompleteActive() {
    const res = safeRun(() => {
      if (!activeLiveWorkout) throw new Error("Kein aktives Workout vorhanden.");
      return completeActiveWorkout({ notes: "Debug Complete" });
    });
    report("Aktives Training abschließen", res);
    bump();
  }

  function onAbortActive() {
    const res = safeRun(() => {
      if (!activeLiveWorkout) throw new Error("Kein aktives Workout vorhanden.");
      return abortActiveWorkout({ notes: "Debug Abort" });
    });
    report("Aktives Training abbrechen", res);
    bump();
  }

  // --------------------------
  // Reset
  // --------------------------

  function onResetAll() {
    const res = safeRun(() => clearAllTrainQCore());
    report("Core Reset (alles löschen)", res);
    bump();
  }

  // --------------------------
  // Rule Editing
  // --------------------------

  function addRule() {
    const nextAllowed = erlaubteWorkoutTypes(split);
    setRules((prev) => [...prev, { weekday: 1, workoutType: nextAllowed[0] }]);
  }

  function updateRuleWeekday(idx: number, weekday: WeekdayIndex) {
    setRules((prev) => prev.map((r, i) => (i === idx ? { ...r, weekday } : r)));
  }

  function updateRuleWorkoutType(idx: number, workoutType: WorkoutType) {
    setRules((prev) => prev.map((r, i) => (i === idx ? { ...r, workoutType } : r)));
  }

  function removeRule(idx: number) {
    setRules((prev) => prev.filter((_, i) => i !== idx));
  }

  const todayLabel = useMemo(() => {
    if (!todaysWorkout) return "Heute: kein Eintrag (Sonntag/Restday ist normal)";
    return `Heute: ${translateWorkoutType(todaysWorkout.workoutType)} • ${chipTextForStatus(todaysWorkout.status)}`;
  }, [todaysWorkout]);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>TrainQ Core Debug</h1>
          <p style={styles.subtitle}>
            Einrichtung (Plan/Kalender) → Heute (Adaptiv/Skip) → Live-Training (Start/Abschluss)
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={styles.badge}>Heute: {todayISO}</div>
          <div style={{ ...styles.subtitle, marginTop: 6 }}>
            Nur für Debugging. Vor Launch entfernen.
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div style={{ ...styles.card, marginBottom: 14 }}>
        <div style={styles.row}>
          <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={onEnsureCalendar}>
            Kalender auffüllen (28d)
          </button>
          <button style={styles.btn} onClick={seedTodayIfMissing}>
            Heute anlegen (wenn fehlt)
          </button>

          <span style={{ width: 10 }} />

          <button
            style={{
              ...styles.btn,
              ...(todaysWorkout && !activeLiveWorkout ? styles.btnPrimary : {}),
              ...(!todaysWorkout || !!activeLiveWorkout ? styles.btnDisabled : {}),
            }}
            onClick={onStartToday}
            disabled={!todaysWorkout || !!activeLiveWorkout}
          >
            Training starten (heute)
          </button>

          <button
            style={{
              ...styles.btn,
              ...(activeLiveWorkout ? styles.btnPrimary : {}),
              ...(!activeLiveWorkout ? styles.btnDisabled : {}),
            }}
            onClick={onCompleteActive}
            disabled={!activeLiveWorkout}
          >
            Aktives Training abschließen
          </button>

          <button
            style={{
              ...styles.btn,
              ...(activeLiveWorkout ? styles.btnDanger : {}),
              ...(!activeLiveWorkout ? styles.btnDisabled : {}),
            }}
            onClick={onAbortActive}
            disabled={!activeLiveWorkout}
          >
            Abbrechen
          </button>

          <span style={{ flex: 1 }} />

          <button style={{ ...styles.btn, ...styles.btnDanger }} onClick={onResetAll}>
            Zurücksetzen (Core)
          </button>
        </div>

        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={styles.callout}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>Status</div>
            <div style={styles.small}>{todayLabel}</div>
            {todaysWorkout?.adaptedAt && (
              <div style={{ ...styles.small, marginTop: 6 }}>
                Adaptiv: von <strong>{translateWorkoutType(todaysWorkout.adaptedFromWorkoutType ?? "-")}</strong> →{" "}
                <strong>{translateWorkoutType(todaysWorkout.workoutType)}</strong>
              </div>
            )}
            {(todaysWorkout as any)?.historyEntryId && (
              <div style={{ ...styles.small, marginTop: 6 }}>
                History: <span style={{ opacity: 0.9 }}>{(todaysWorkout as any).historyEntryId}</span>
              </div>
            )}
          </div>

          <div style={styles.callout}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>Letzte Aktion</div>
            {lastAction ? (
              <div style={styles.small}>
                <strong>{lastAction.title}</strong> –{" "}
                <span style={{ color: lastAction.ok ? "#86efac" : "#fca5a5" }}>
                  {lastAction.ok ? "OK" : "Fehler"}
                </span>
                {!lastAction.ok && (
                  <div style={{ marginTop: 6, opacity: 0.9 }}>{lastAction.msg}</div>
                )}
              </div>
            ) : (
              <div style={styles.small}>Noch keine Aktion.</div>
            )}
          </div>
        </div>
      </div>

      <div style={styles.grid}>
        {/* Left: Setup */}
        <section style={styles.card}>
          <div style={styles.cardTitleRow}>
            <h2 style={styles.cardTitle}>Einrichtung: Plan</h2>
            <span style={styles.badge}>
              {activePlan ? `Aktiv: ${activePlan.splitType}` : "Kein aktiver Plan"}
            </span>
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <div>
              <label style={styles.label}>Name</label>
              <input
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                style={styles.input}
              />
            </div>

            <div>
              <label style={styles.label}>Split</label>
              <select
                value={split}
                onChange={(e) => {
                  const next = e.target.value as SplitType;
                  setSplit(next);
                  const types = erlaubteWorkoutTypes(next);
                  setRules((prev) =>
                    prev.map((r, i) => ({
                      ...r,
                      workoutType: types[i % types.length],
                    }))
                  );
                }}
                style={styles.select}
              >
                {SPLITS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={styles.label}>Startdatum (YYYY-MM-DD)</label>
              <input
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={styles.input}
              />
            </div>
          </div>

          <div style={styles.hr} />

          <div style={styles.cardTitleRow}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800 }}>Wöchentliche Regeln</h3>
            <button style={styles.btn} onClick={addRule}>
              + Regel
            </button>
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {rules.map((r, idx) => (
              <div
                key={`${r.weekday}-${idx}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "90px 1fr 90px",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <select
                  value={r.weekday}
                  onChange={(e) => updateRuleWeekday(idx, Number(e.target.value) as WeekdayIndex)}
                  style={styles.select}
                >
                  {WOCHENTAGE.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>

                <select
                  value={r.workoutType}
                  onChange={(e) => updateRuleWorkoutType(idx, e.target.value as WorkoutType)}
                  style={styles.select}
                >
                  {erlaubteWorkoutTypes(split).map((t) => (
                    <option key={t} value={t}>
                      {translateWorkoutType(t)}
                    </option>
                  ))}
                </select>

                <button style={{ ...styles.btn, ...styles.btnDanger }} onClick={() => removeRule(idx)}>
                  Entfernen
                </button>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 12 }}>
            <button style={{ ...styles.btn, ...styles.btnPrimary, width: "100%" }} onClick={onCreatePlan}>
              Plan erstellen + aktivieren + Kalender erzeugen
            </button>
            <div style={{ ...styles.small, marginTop: 8 }}>
              Hinweis: Plan ist nur die Vorlage. Adaptiv ändert später nur den Kalendereintrag.
            </div>
          </div>

          <div style={styles.hr} />

          <h3 style={{ margin: "0 0 8px 0", fontSize: 13, fontWeight: 800 }}>Vorhandene Pläne</h3>
          {state.plans.length === 0 ? (
            <div style={styles.mutedBox}>Noch keine Pläne vorhanden.</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {state.plans.map((p) => (
                <div
                  key={p.id}
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(15,23,42,0.40)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>
                        {p.name}{" "}
                        <span style={{ opacity: 0.75, fontWeight: 600 }}>
                          ({p.splitType})
                        </span>
                      </div>
                      <div style={styles.small}>
                        id: {p.id} • start: {formatDateDE(p.startDate)}
                      </div>
                    </div>
                    <div>
                      {p.isActive ? (
                        <span style={{ ...styles.badge, borderColor: "rgba(56,189,248,0.35)" }}>
                          AKTIV
                        </span>
                      ) : (
                        <button style={styles.btn} onClick={() => onActivatePlan(p.id)}>
                          Aktivieren
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right: Calendar */}
        <section style={styles.card}>
          <div style={styles.cardTitleRow}>
            <h2 style={styles.cardTitle}>Kalender: nächste 28 Tage</h2>
            <span style={styles.badge}>
              {state.calendarWorkouts.length} Einträge
            </span>
          </div>

          <div style={{ marginTop: 10 }}>
            {!todaysWorkout ? (
              <div style={styles.mutedBox}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Heute hat kein Training</div>
                <div style={styles.small}>
                  Das ist normal (z.B. Sonntag/Restday). Für Tests: „Heute anlegen“ klicken.
                </div>
              </div>
            ) : (
              <div style={styles.callout}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 900 }}>
                      {translateWorkoutType(todaysWorkout.workoutType)}{" "}
                      <span style={{ opacity: 0.75, fontWeight: 700 }}>
                        ({chipTextForStatus(todaysWorkout.status)})
                      </span>
                    </div>
                    <div style={styles.small}>
                      {todaysWorkout.sourcePlanId ? `Plan: ${todaysWorkout.sourcePlanId.slice(0, 10)}…` : "Kein Plan-Link"}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      style={{
                        ...styles.btn,
                        ...(!activeLiveWorkout ? styles.btnPrimary : {}),
                        ...(activeLiveWorkout ? styles.btnDisabled : {}),
                      }}
                      onClick={() => {
                        if (!todaysWorkout) return;
                        onStartToday();
                      }}
                      disabled={!!activeLiveWorkout}
                    >
                      Start
                    </button>

                    <button
                      style={{
                        ...styles.btn,
                        ...(todaysWorkout ? {} : styles.btnDisabled),
                      }}
                      onClick={onSkipToday}
                      disabled={!todaysWorkout}
                    >
                      Überspringen
                    </button>
                  </div>
                </div>

                <div style={{ ...styles.hr, margin: "10px 0" }} />

                <div style={{ fontWeight: 800, marginBottom: 8 }}>Adaptiv überschreiben (nur heute)</div>
                <div style={styles.row}>
                  {erlaubteWorkoutTypes(activePlan?.splitType ?? split).map((t) => (
                    <button
                      key={t}
                      style={{
                        ...styles.btn,
                        ...(todaysWorkout.workoutType !== t ? {} : styles.btnPrimary),
                        ...(activeLiveWorkout ? styles.btnDisabled : {}),
                      }}
                      onClick={() => onAdaptiveOverwriteToday(t)}
                      disabled={!!activeLiveWorkout}
                      title={activeLiveWorkout ? "Nicht während eines aktiven Workouts" : ""}
                    >
                      → {translateWorkoutType(t)}
                    </button>
                  ))}
                </div>

                {todaysWorkout.adaptedAt && (
                  <div style={{ ...styles.small, marginTop: 10 }}>
                    Adaptiv gesetzt um {todaysWorkout.adaptedAt} (von{" "}
                    <strong>{translateWorkoutType(todaysWorkout.adaptedFromWorkoutType ?? "-")}</strong>)
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ marginTop: 12, ...styles.tableWrap }}>
            {state.calendarWorkouts.length === 0 ? (
              <div style={{ padding: 12 }}>Keine Kalendereinträge.</div>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Datum</th>
                    <th style={styles.th}>Typ</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Plan</th>
                  </tr>
                </thead>
                <tbody>
                  {state.calendarWorkouts
                    .slice()
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((w) => (
                      <tr key={w.id}>
                        <td style={styles.td}>{formatDateDE(w.date)}</td>
                        <td style={styles.td}>{translateWorkoutType(w.workoutType)}</td>
                        <td style={styles.td}>{chipTextForStatus(w.status)}</td>
                        <td style={{ ...styles.td, opacity: 0.75, fontSize: 12 }}>
                          {w.sourcePlanId ? w.sourcePlanId.slice(0, 10) + "…" : "-"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>

          <div style={{ marginTop: 10, ...styles.small }}>
            Tipp: Für Adaptiv-Tests zuerst „Heute anlegen“, dann „→ Oberkörper/Unterkörper“ klicken.
          </div>
        </section>
      </div>
    </div>
  );
}