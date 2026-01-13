// src/components/adaptive/AdaptiveTrainingModal.tsx
// TrainQ Launch: Adaptives Training (Modal, DE)
//
// Fixes:
// - Safe-Area Top: nichts wird oben abgeschnitten
// - Scrollbar: Modal-Body ist sauber scrollbar
// - iOS Overscroll (weißes Band unten) minimiert: overscrollBehavior + Background-Scroll-Lock
// - CTA/Actions bleiben erreichbar trotz fixed Bottom-Navbar: extra Bottom-Padding im Body

import React, { useMemo, useState, useEffect } from "react";
import { useI18n } from "../../i18n/useI18n";
import type { TranslationKey } from "../../i18n";
import type { SplitType, WorkoutType } from "../../types";
import type { AdaptiveAnswers, AdaptiveSuggestion, AdaptiveReason } from "../../types/adaptive";
import { buildAdaptiveSuggestions } from "../../utils/adaptiveScoring";

// ------------------------------
// Helpers
// ------------------------------

const DEFAULT_ANSWERS: AdaptiveAnswers = {
  timeToday: "20to40",
  dayForm: "mid",
  stress: "mid",
  yesterdayEffort: "mid",
};

function allowedWorkoutTypes(splitType: SplitType): WorkoutType[] {
  return splitType === "push_pull" ? ["Push", "Pull"] : ["Upper", "Lower"];
}

type Translator = (key: TranslationKey, vars?: Record<string, string | number>) => string;

function reasonLabel(r: AdaptiveReason, t: Translator): string {
  switch (r) {
    case "time_low":
      return t("adaptive.reason.timeLow");
    case "time_high":
      return t("adaptive.reason.timeHigh");
    case "form_low":
      return t("adaptive.reason.formLow");
    case "form_high":
      return t("adaptive.reason.formHigh");
    case "stress_low":
      return t("adaptive.reason.stressLow");
    case "stress_high":
      return t("adaptive.reason.stressHigh");
    case "effort_low":
      return t("adaptive.reason.effortLow");
    case "effort_high":
      return t("adaptive.reason.effortHigh");
    case "recovery_low":
      return t("adaptive.reason.recoveryLow");
    case "recovery_good":
      return t("adaptive.reason.recoveryGood");
    default:
      return t("adaptive.reason.default");
  }
}

function profileAccent(
  profile: AdaptiveSuggestion["profile"]
): { border: string; bg: string; badgeBg: string; badgeText: string } {
  if (profile === "kompakt")
    return {
      border: "rgba(56,189,248,0.32)",
      bg: "rgba(56,189,248,0.10)",
      badgeBg: "rgba(56,189,248,0.18)",
      badgeText: "rgba(186,230,253,0.95)",
    };
  if (profile === "stabil")
    return {
      border: "rgba(34,197,94,0.28)",
      bg: "rgba(34,197,94,0.08)",
      badgeBg: "rgba(34,197,94,0.16)",
      badgeText: "rgba(167,243,208,0.95)",
    };
  return {
    border: "rgba(245,158,11,0.28)",
    bg: "rgba(245,158,11,0.08)",
    badgeBg: "rgba(245,158,11,0.16)",
    badgeText: "rgba(253,230,138,0.95)",
  };
}

function profileABC(profile: AdaptiveSuggestion["profile"]): "A" | "B" | "C" {
  if (profile === "stabil") return "A";
  if (profile === "kompakt") return "B";
  return "C";
}

function profileLabel(profile: AdaptiveSuggestion["profile"], t: Translator): string {
  if (profile === "stabil") return t("adaptive.profile.stable");
  if (profile === "kompakt") return t("adaptive.profile.compact");
  return t("adaptive.profile.focus");
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

  /**
   * Optional (UI-only):
   * - isPro: zeigt "Pro: unbegrenzt"
   * - adaptiveLeftBC: zeigt Rest-Credits für B/C (A immer free)
   * - bcFreeLimit: für Text "B/C X×/Monat"
   */
  isPro?: boolean;
  adaptiveLeftBC?: number;
  bcFreeLimit?: number;
}

// ------------------------------
// Component
// ------------------------------

export default function AdaptiveTrainingModal(props: AdaptiveTrainingModalProps) {
  const { t } = useI18n();
  const { open, onClose, plannedWorkoutType, splitType, onSelect, isPro, adaptiveLeftBC, bcFreeLimit = 5 } = props;

  const [step, setStep] = useState<"questions" | "suggestions">("questions");
  const [answers, setAnswers] = useState<AdaptiveAnswers>(DEFAULT_ANSWERS);

  const allowed = useMemo(() => allowedWorkoutTypes(splitType), [splitType]);
  const plannedOk = allowed.includes(plannedWorkoutType);

  const suggestions = useMemo(() => buildAdaptiveSuggestions(answers), [answers]);

  // Reset beim Öffnen
  useEffect(() => {
    if (!open) return;
    setStep("questions");
    setAnswers(DEFAULT_ANSWERS);
  }, [open]);


  // Background-Scroll-Lock (verhindert Untergrundscroll + reduziert iOS Rubber-Banding)
  useEffect(() => {
    if (!open) return;

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [open]);

  if (!open) return null;

  // ------------------------------
  // Styles (inline)
  // ------------------------------

  // Platz unten, damit die letzten Aktionen auch mit fixed Bottom-Nav erreichbar sind.
  const NAV_SAFE_SPACE_PX = 110;

  const overlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.60)",
    display: "flex",
    alignItems: "flex-start", // KEY: nicht zentrieren (sonst kann oben clippen)
    justifyContent: "center",
    paddingTop: "calc(16px + env(safe-area-inset-top))",
    paddingLeft: 16,
    paddingRight: 16,
    paddingBottom: "calc(16px + env(safe-area-inset-bottom))",
    overflowY: "auto", // Fallback: falls Modal extrem hoch wird, kann overlay scrollen
    WebkitOverflowScrolling: "touch",
    // KEY: reduziert das „weiße Band“ bei iOS Overscroll deutlich
    overscrollBehaviorY: "contain",
    zIndex: 20000,
  };

  const modal: React.CSSProperties = {
    width: "100%",
    maxWidth: 720,
    maxHeight: "calc(100dvh - (32px + env(safe-area-inset-top) + env(safe-area-inset-bottom)))",
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
    flex: 1, // KEY: Body füllt Rest, Footer/Header bleiben sichtbar
    minHeight: 0, // KEY: erlaubt korrektes Shrinking für Scroll
    WebkitOverflowScrolling: "touch",
    overscrollBehaviorY: "contain",
    // KEY: Scroll-Raum unten (damit Buttons nicht unter der Nav landen)
    paddingBottom: `calc(${NAV_SAFE_SPACE_PX}px + env(safe-area-inset-bottom))`,
  };

  const actionsRow: React.CSSProperties = {
    marginTop: 14,
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

  const badge: React.CSSProperties = {
    padding: "5px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    fontSize: 11,
    fontWeight: 900,
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

  const entitlementLine = (() => {
    if (isPro) return t("adaptive.entitlement.pro");
    if (typeof adaptiveLeftBC === "number") {
      return t("adaptive.entitlement.freeRemaining", {
        remaining: Math.max(0, adaptiveLeftBC),
        limit: bcFreeLimit,
      });
    }
    return t("adaptive.entitlement.freeLimited", { limit: bcFreeLimit });
  })();

  // ------------------------------
  // Render
  // ------------------------------

  return (
    <div style={overlay} onClick={onClose} role="dialog" aria-modal="true" data-overlay-open="true">
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={header}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.6, fontWeight: 800 }}>{t("adaptive.title")}</div>
            <h2 style={hTitle}>{t("adaptive.today", { value: plannedWorkoutType })}</h2>
            <p style={hSub}>{t("adaptive.subtitle")}</p>
            <p style={{ ...hSub, marginTop: 6 }}>{entitlementLine}</p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={pill}>{step === "questions" ? t("adaptive.step.questions") : t("adaptive.step.suggestions")}</div>
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
              aria-label={t("common.close")}
              title={t("common.close")}
            >
              ✕
            </button>
          </div>
        </div>

        <div style={body}>
          {!plannedOk && (
            <div style={{ ...card, borderColor: "rgba(248,113,113,0.35)", marginBottom: 12 }}>
              <div style={{ fontWeight: 900, color: "#fecaca" }}>{t("adaptive.notice")}</div>
              <div style={tiny}>
                {t("adaptive.planMismatch", { value: plannedWorkoutType })}
              </div>
            </div>
          )}

          {step === "questions" && (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={card}>
                <div style={sectionTitle}>{t("adaptive.q1")}</div>
                <div style={grid2}>
                  <button type="button" style={optionBtn(answers.timeToday === "lt20")} onClick={() => setAnswers((p) => ({ ...p, timeToday: "lt20" }))}>
                    {t("adaptive.q1.lt20")}
                  </button>
                  <button type="button" style={optionBtn(answers.timeToday === "20to40")} onClick={() => setAnswers((p) => ({ ...p, timeToday: "20to40" }))}>
                    {t("adaptive.q1.min20to40")}
                  </button>
                  <button type="button" style={optionBtn(answers.timeToday === "40to60")} onClick={() => setAnswers((p) => ({ ...p, timeToday: "40to60" }))}>
                    {t("adaptive.q1.min40to60")}
                  </button>
                  <button type="button" style={optionBtn(answers.timeToday === "gt60")} onClick={() => setAnswers((p) => ({ ...p, timeToday: "gt60" }))}>
                    {t("adaptive.q1.gt60")}
                  </button>
                </div>
              </div>

              <div style={card}>
                <div style={sectionTitle}>{t("adaptive.q2")}</div>
                <div style={grid3}>
                  <button type="button" style={optionBtn(answers.dayForm === "low")} onClick={() => setAnswers((p) => ({ ...p, dayForm: "low" }))}>
                    {t("adaptive.q2.low")}
                  </button>
                  <button type="button" style={optionBtn(answers.dayForm === "mid")} onClick={() => setAnswers((p) => ({ ...p, dayForm: "mid" }))}>
                    {t("adaptive.q2.mid")}
                  </button>
                  <button type="button" style={optionBtn(answers.dayForm === "high")} onClick={() => setAnswers((p) => ({ ...p, dayForm: "high" }))}>
                    {t("adaptive.q2.high")}
                  </button>
                </div>
              </div>

              <div style={card}>
                <div style={sectionTitle}>{t("adaptive.q3")}</div>
                <div style={grid3}>
                  <button type="button" style={optionBtn(answers.stress === "low")} onClick={() => setAnswers((p) => ({ ...p, stress: "low" }))}>
                    {t("adaptive.q3.low")}
                  </button>
                  <button type="button" style={optionBtn(answers.stress === "mid")} onClick={() => setAnswers((p) => ({ ...p, stress: "mid" }))}>
                    {t("adaptive.q3.mid")}
                  </button>
                  <button type="button" style={optionBtn(answers.stress === "high")} onClick={() => setAnswers((p) => ({ ...p, stress: "high" }))}>
                    {t("adaptive.q3.high")}
                  </button>
                </div>
              </div>

              <div style={card}>
                <div style={sectionTitle}>{t("adaptive.q4")}</div>
                <div style={grid3}>
                  <button type="button" style={optionBtn(answers.yesterdayEffort === "low")} onClick={() => setAnswers((p) => ({ ...p, yesterdayEffort: "low" }))}>
                    {t("adaptive.q4.low")}
                  </button>
                  <button type="button" style={optionBtn(answers.yesterdayEffort === "mid")} onClick={() => setAnswers((p) => ({ ...p, yesterdayEffort: "mid" }))}>
                    {t("adaptive.q4.mid")}
                  </button>
                  <button type="button" style={optionBtn(answers.yesterdayEffort === "high")} onClick={() => setAnswers((p) => ({ ...p, yesterdayEffort: "high" }))}>
                    {t("adaptive.q4.high")}
                  </button>
                </div>
              </div>

              <div style={actionsRow}>
                <button style={{ ...btn, ...btnGhost }} onClick={onClose}>
                  {t("common.cancel")}
                </button>
                <button
                  style={{ ...btn, ...btnPrimary }}
                  onClick={() => setStep("suggestions")}
                  disabled={!plannedOk}
                  title={!plannedOk ? t("adaptive.planMismatchShort") : t("adaptive.showSuggestions")}
                >
                  {t("adaptive.showSuggestions")}
                </button>
              </div>
            </div>
          )}

          {step === "suggestions" && (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={card}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>{t("adaptive.suggestionsTitle")}</div>
                <div style={tiny}>{t("adaptive.suggestionsSubtitle", { value: plannedWorkoutType })}</div>
              </div>

              {suggestions.map((s) => {
                const blocked = s.estimatedMinutes <= 0;
                const accent = profileAccent(s.profile);
                const abc = profileABC(s.profile);

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
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ ...badge, background: accent.badgeBg, color: accent.badgeText }}>
                            {profileLabel(s.profile, t)}
                          </span>

                          {abc === "A" && (
                            <span style={{ ...badge, background: "rgba(255,255,255,0.06)", color: "rgba(229,231,235,0.80)" }}>
                              {t("adaptive.alwaysFree")}
                            </span>
                          )}

                          <span style={{ fontWeight: 950, fontSize: 14 }}>{s.title}</span>
                        </div>

                        <div style={{ ...tiny, marginTop: 6 }}>{s.subtitle}</div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 950, fontSize: 16 }}>
                          {s.estimatedMinutes ? `${s.estimatedMinutes} ${t("common.min")}` : t("common.emptyDash")}
                        </div>
                        <div style={tiny}>{t("adaptive.estimated")}</div>
                      </div>
                    </div>

                    <div style={{ ...tiny, marginTop: 10 }}>
                      <strong>{t("adaptive.scope")}:</strong>{" "}
                      {t("adaptive.scopeValue", { exercises: s.exercisesCount, sets: s.setsPerExercise })}
                    </div>
                    <div style={{ ...tiny, marginTop: 6 }}>
                      <strong>{t("adaptive.intensity")}:</strong> {s.intensityHint}
                    </div>

                    {s.reasons?.length ? (
                      <div style={{ ...tiny, marginTop: 10 }}>
                        <strong>{t("adaptive.why")}:</strong> {s.reasons.slice(0, 3).map((r) => reasonLabel(r, t)).join(" · ")}
                      </div>
                    ) : null}

                    <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
                      <button
                        style={{ ...btn, ...btnPrimary, ...(blocked ? { opacity: 0.6, cursor: "not-allowed" } : {}) }}
                        disabled={blocked || !plannedOk}
                        onClick={() => onSelect(s, answers)}
                        title={blocked ? t("adaptive.disabledToday") : t("adaptive.select")}
                      >
                        {t("adaptive.select")}
                      </button>
                    </div>

                    {blocked && <div style={{ ...tiny, marginTop: 8 }}>{t("adaptive.disabledMessage")}</div>}
                  </div>
                );
              })}

              <div style={actionsRow}>
                <button style={{ ...btn, ...btnGhost }} onClick={() => setStep("questions")}>
                  {t("common.back")}
                </button>
                <button style={{ ...btn, ...btnGhost }} onClick={onClose}>
                  {t("common.close")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
