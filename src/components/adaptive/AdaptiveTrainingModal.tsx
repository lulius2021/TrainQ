// src/components/adaptive/AdaptiveTrainingModal.tsx
// TrainQ Launch: Adaptives Training (Modal, DE)
//
// Zweck:
// - 4 Fragen (Zeit, Tagesform, Stress, Anstrengung gestern) als Buckets
// - Danach 3 Vorschläge (stabil/kompakt/fokus) inkl. Dauer + Gründe
// - UI-only: kein Storage, keine Navigation
// - Parent entscheidet, was bei "Auswählen" passiert

import React, { useMemo, useState, useEffect } from "react";
import type { SplitType, WorkoutType } from "../../types";
import type { AdaptiveAnswers, AdaptiveSuggestion, AdaptiveReason } from "../../types/adaptive";
import { buildAdaptiveSuggestions } from "../../utils/adaptiveScoring";

// ------------------------------
// Helpers
// ------------------------------

function allowedWorkoutTypes(splitType: SplitType): WorkoutType[] {
  return splitType === "push_pull" ? ["Push", "Pull"] : ["Upper", "Lower"];
}

function reasonLabel(r: AdaptiveReason): string {
  switch (r) {
    case "time_low":
      return "Wenig Zeit";
    case "time_high":
      return "Viel Zeit";
    case "form_low":
      return "Schlechte Tagesform";
    case "form_high":
      return "Gute Tagesform";
    case "stress_low":
      return "Niedriger Stress";
    case "stress_high":
      return "Hoher Stress";
    case "effort_low":
      return "Gestern leicht";
    case "effort_high":
      return "Gestern anstrengend";
    case "recovery_low":
      return "Erholung niedrig";
    case "recovery_good":
      return "Erholung gut";
    default:
      return String(r);
  }
}

function profileAccent(profile: AdaptiveSuggestion["profile"]): { border: string; bg: string } {
  if (profile === "kompakt") return { border: "rgba(56,189,248,0.32)", bg: "rgba(56,189,248,0.10)" };
  if (profile === "stabil") return { border: "rgba(34,197,94,0.28)", bg: "rgba(34,197,94,0.08)" };
  return { border: "rgba(245,158,11,0.28)", bg: "rgba(245,158,11,0.08)" };
}

// ------------------------------
// Props
// ------------------------------

export interface AdaptiveTrainingModalProps {
  open: boolean;
  onClose: () => void;

  plannedWorkoutType: WorkoutType;
  splitType: SplitType;

  onSelect: (suggestion: AdaptiveSuggestion, answers: AdaptiveAnswers) => void;
}

// ------------------------------
// Component
// ------------------------------

export default function AdaptiveTrainingModal(props: AdaptiveTrainingModalProps) {
  const { open, onClose, plannedWorkoutType, splitType, onSelect } = props;

  const [step, setStep] = useState<"questions" | "suggestions">("questions");

  const [answers, setAnswers] = useState<AdaptiveAnswers>({
    timeToday: "20to40",
    dayForm: "mid",
    stress: "mid",
    yesterdayEffort: "mid",
  });

  const allowed = useMemo(() => allowedWorkoutTypes(splitType), [splitType]);
  const plannedOk = allowed.includes(plannedWorkoutType);

  const suggestions = useMemo(() => buildAdaptiveSuggestions(answers), [answers]);

  useEffect(() => {
    if (!open) return;
    setStep("questions");
  }, [open]);

  if (!open) return null;

  // ------------------------------
  // Styles (inline)
  // ------------------------------

  const overlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.60)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 9999,
  };

  const modal: React.CSSProperties = {
    width: "100%",
    maxWidth: 720,
    maxHeight: "88vh",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(2,6,23,0.98)",
    color: "#e5e7eb",
    boxShadow: "0 20px 70px rgba(0,0,0,0.60)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  };

  const header: React.CSSProperties = {
    padding: "16px 16px 12px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  };

  const body: React.CSSProperties = {
    padding: 16,
    overflowY: "auto",
  };

  const footer: React.CSSProperties = {
    padding: 14,
    borderTop: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(2,6,23,0.99)",
    display: "flex",
    gap: 10,
  };

  const hTitle: React.CSSProperties = { margin: 0, fontSize: 18, fontWeight: 900 };
  const hSub: React.CSSProperties = { margin: "6px 0 0", fontSize: 12, opacity: 0.75, lineHeight: 1.35 };

  const pill: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: "nowrap",
  };

  const card: React.CSSProperties = {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(15,23,42,0.55)",
    padding: 14,
  };

  const sectionTitle: React.CSSProperties = { fontSize: 13, fontWeight: 900, marginBottom: 10 };
  const tiny: React.CSSProperties = { fontSize: 12, opacity: 0.75 };

  const grid2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
  const grid3: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 };

  const btn: React.CSSProperties = {
    flex: 1,
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(30,41,59,0.55)",
    color: "#e5e7eb",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  };

  const btnPrimary: React.CSSProperties = {
    background: "rgba(56,189,248,0.18)",
    border: "1px solid rgba(56,189,248,0.35)",
  };

  const btnGhost: React.CSSProperties = {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.14)",
  };

  const optionBtn = (active: boolean): React.CSSProperties => ({
    width: "100%",
    padding: "10px 10px",
    borderRadius: 12,
    border: active ? "1px solid rgba(56,189,248,0.55)" : "1px solid rgba(255,255,255,0.10)",
    background: active ? "rgba(56,189,248,0.18)" : "rgba(0,0,0,0.22)",
    color: active ? "#e5e7eb" : "rgba(229,231,235,0.85)",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  });

  // ------------------------------
  // Render
  // ------------------------------

  return (
    <div style={overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={header}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.6, fontWeight: 800 }}>Adaptives Training</div>
            <h2 style={hTitle}>Heute: {plannedWorkoutType}</h2>
            <p style={hSub}>Dein Plan bleibt gleich. Wir passen nur Umfang und Intensität an.</p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={pill}>{step === "questions" ? "Fragen" : "3 Vorschläge"}</div>
            <button
              type="button"
              onClick={onClose}
              style={{
                height: 34,
                width: 34,
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
                color: "rgba(229,231,235,0.9)",
                cursor: "pointer",
                fontWeight: 900,
              }}
              aria-label="Schließen"
              title="Schließen"
            >
              ✕
            </button>
          </div>
        </div>

        <div style={body}>
          {!plannedOk && (
            <div style={{ ...card, borderColor: "rgba(248,113,113,0.35)", marginBottom: 12 }}>
              <div style={{ fontWeight: 900, color: "#fecaca" }}>Hinweis</div>
              <div style={tiny}>
                Der geplante Typ <strong>{plannedWorkoutType}</strong> passt nicht zu deinem Split. Bitte Split/Plan prüfen.
              </div>
            </div>
          )}

          {step === "questions" && (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={card}>
                <div style={sectionTitle}>1) Zeit heute</div>
                <div style={grid2}>
                  <button type="button" style={optionBtn(answers.timeToday === "lt20")} onClick={() => setAnswers((p) => ({ ...p, timeToday: "lt20" }))}>
                    &lt; 20 Min
                  </button>
                  <button type="button" style={optionBtn(answers.timeToday === "20to40")} onClick={() => setAnswers((p) => ({ ...p, timeToday: "20to40" }))}>
                    20–40 Min
                  </button>
                  <button type="button" style={optionBtn(answers.timeToday === "40to60")} onClick={() => setAnswers((p) => ({ ...p, timeToday: "40to60" }))}>
                    40–60 Min
                  </button>
                  <button type="button" style={optionBtn(answers.timeToday === "gt60")} onClick={() => setAnswers((p) => ({ ...p, timeToday: "gt60" }))}>
                    60+ Min
                  </button>
                </div>
              </div>

              <div style={card}>
                <div style={sectionTitle}>2) Tagesform</div>
                <div style={grid3}>
                  <button type="button" style={optionBtn(answers.dayForm === "low")} onClick={() => setAnswers((p) => ({ ...p, dayForm: "low" }))}>
                    schlecht
                  </button>
                  <button type="button" style={optionBtn(answers.dayForm === "mid")} onClick={() => setAnswers((p) => ({ ...p, dayForm: "mid" }))}>
                    okay
                  </button>
                  <button type="button" style={optionBtn(answers.dayForm === "high")} onClick={() => setAnswers((p) => ({ ...p, dayForm: "high" }))}>
                    top
                  </button>
                </div>
              </div>

              <div style={card}>
                <div style={sectionTitle}>3) Stress</div>
                <div style={grid3}>
                  <button type="button" style={optionBtn(answers.stress === "low")} onClick={() => setAnswers((p) => ({ ...p, stress: "low" }))}>
                    niedrig
                  </button>
                  <button type="button" style={optionBtn(answers.stress === "mid")} onClick={() => setAnswers((p) => ({ ...p, stress: "mid" }))}>
                    mittel
                  </button>
                  <button type="button" style={optionBtn(answers.stress === "high")} onClick={() => setAnswers((p) => ({ ...p, stress: "high" }))}>
                    hoch
                  </button>
                </div>
              </div>

              <div style={card}>
                <div style={sectionTitle}>4) Anstrengung gestern</div>
                <div style={grid3}>
                  <button type="button" style={optionBtn(answers.yesterdayEffort === "low")} onClick={() => setAnswers((p) => ({ ...p, yesterdayEffort: "low" }))}>
                    leicht
                  </button>
                  <button type="button" style={optionBtn(answers.yesterdayEffort === "mid")} onClick={() => setAnswers((p) => ({ ...p, yesterdayEffort: "mid" }))}>
                    hart
                  </button>
                  <button type="button" style={optionBtn(answers.yesterdayEffort === "high")} onClick={() => setAnswers((p) => ({ ...p, yesterdayEffort: "high" }))}>
                    sehr hart
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === "suggestions" && (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={card}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>3 Vorschläge</div>
                <div style={tiny}>Fokus bleibt {plannedWorkoutType}. Du wählst nur Dosis und Intensität.</div>
              </div>

              {suggestions.map((s) => {
                const blocked = s.profile === "fokus" && s.estimatedMinutes === 0;
                const accent = profileAccent(s.profile);

                return (
                  <div
                    key={s.profile}
                    style={{
                      ...card,
                      borderColor: blocked ? "rgba(255,255,255,0.10)" : accent.border,
                      background: blocked ? "rgba(15,23,42,0.45)" : accent.bg,
                      opacity: blocked ? 0.7 : 1,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 950, fontSize: 14 }}>{s.title}</div>
                        <div style={{ ...tiny, marginTop: 4 }}>{s.subtitle}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 950, fontSize: 16 }}>{s.estimatedMinutes ? `${s.estimatedMinutes} min` : "—"}</div>
                        <div style={tiny}>geschätzt</div>
                      </div>
                    </div>

                    <div style={{ ...tiny, marginTop: 10 }}>
                      <strong>Umfang:</strong> {s.exercisesCount} Übungen · {s.setsPerExercise} Sätze/Übung
                    </div>
                    <div style={{ ...tiny, marginTop: 6 }}>
                      <strong>Intensität:</strong> {s.intensityHint}
                    </div>

                    {s.reasons?.length ? (
                      <div style={{ ...tiny, marginTop: 10 }}>
                        <strong>Warum:</strong> {s.reasons.slice(0, 3).map(reasonLabel).join(" · ")}
                      </div>
                    ) : null}

                    <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
                      <button
                        style={{ ...btn, ...btnPrimary, ...(blocked ? { opacity: 0.6, cursor: "not-allowed" } : {}) }}
                        disabled={blocked || !plannedOk}
                        onClick={() => onSelect(s, answers)}
                        title={blocked ? "Heute nicht empfohlen" : "Auswählen"}
                      >
                        Auswählen
                      </button>
                    </div>

                    {blocked && (
                      <div style={{ ...tiny, marginTop: 8 }}>
                        Dieser Vorschlag ist heute deaktiviert (Zeit/Erholung nicht optimal).
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={footer}>
          {step === "questions" ? (
            <>
              <button style={{ ...btn, ...btnGhost }} onClick={onClose}>
                Abbrechen
              </button>
              <button
                style={{ ...btn, ...btnPrimary }}
                onClick={() => setStep("suggestions")}
                disabled={!plannedOk}
                title={!plannedOk ? "Plan/Split inkonsistent" : "Vorschläge anzeigen"}
              >
                Vorschläge anzeigen
              </button>
            </>
          ) : (
            <>
              <button style={{ ...btn, ...btnGhost }} onClick={() => setStep("questions")}>
                Zurück
              </button>
              <button style={{ ...btn, ...btnGhost }} onClick={onClose}>
                Schließen
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}