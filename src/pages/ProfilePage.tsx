// src/pages/ProfilePage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { FeedbackBar } from "../components/feedback/FeedbackBar";
import type { CalendarEvent } from "../types/training";

import {
  loadWorkoutHistory,
  onWorkoutHistoryUpdated,
  type WorkoutHistoryEntry,
} from "../utils/workoutHistory";

type SettingsTab = "account" | "notifications" | "legal";
type LegalTab = "privacy" | "imprint" | "terms";

interface ProfilePageProps {
  events?: CalendarEvent[];
  onClearCalendar?: () => void;
}

const WEEKLY_GOAL_MINUTES = 5 * 60;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeekMonday(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay(); // 0 So – 6 Sa
  const diff = (day + 6) % 7; // 0 = Mo
  d.setDate(d.getDate() - diff);
  return d;
}

function formatDateRangeWeek(start: Date): string {
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const from = start.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  const to = end.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${from} – ${to}`;
}

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}

function toLocalDateLabel(iso?: string): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function clampMin(v: number, min = 0) {
  return Number.isFinite(v) ? Math.max(min, v) : min;
}

function volumeOfEntry(w: WorkoutHistoryEntry): number {
  return Math.round(clampMin(w.totalVolume, 0));
}

function durationMinutes(w: WorkoutHistoryEntry): number {
  return Math.max(0, Math.round((w.durationSec ?? 0) / 60));
}

function isInWeek(entry: WorkoutHistoryEntry, weekStart: Date): boolean {
  const t = new Date(entry.endedAt || entry.startedAt).getTime();
  const start = weekStart.getTime();
  const end = new Date(weekStart).setDate(weekStart.getDate() + 7);
  return t >= start && t < end;
}

function isInMonth(entry: WorkoutHistoryEntry, ref: Date): boolean {
  const d = new Date(entry.endedAt || entry.startedAt);
  if (Number.isNaN(d.getTime())) return false;
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

function weekIndexInMonth(d: Date): number {
  const dayOfMonth = d.getDate();
  return Math.min(Math.floor((dayOfMonth - 1) / 7), 4);
}

const ProfilePage: React.FC<ProfilePageProps> = ({ onClearCalendar }) => {
  const [profileName, setProfileName] = useState("Dein Name");
  const [profileBio, setProfileBio] = useState("Kurzbeschreibung deines Trainings.");
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [settingsTab, setSettingsTab] = useState<SettingsTab>("account");
  const [legalTab, setLegalTab] = useState<LegalTab>("privacy");

  const [accountEmail, setAccountEmail] = useState("dein.mail@example.com");
  const [notificationsTraining, setNotificationsTraining] = useState<boolean>(true);
  const [notificationsSummary, setNotificationsSummary] = useState<boolean>(true);
  const [notificationsNews, setNotificationsNews] = useState<boolean>(false);

  // ✅ Source of Truth: WorkoutHistory
  const [workouts, setWorkouts] = useState<WorkoutHistoryEntry[]>(() => loadWorkoutHistory());

  useEffect(() => {
    const refresh = () => setWorkouts(loadWorkoutHistory());
    const off = onWorkoutHistoryUpdated(refresh);

    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);

    return () => {
      off();
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  // ------------------ Diagramme: Monat (Bars) + Woche (Donut) ------------------

  // ✅ wichtig: monthRef auf Monatsanfang, damit es stabil ist
  const [monthRef, setMonthRef] = useState<Date>(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [weekRef, setWeekRef] = useState<Date>(new Date());

  const monthLabel = useMemo(() => formatMonthLabel(monthRef), [monthRef]);
  const weekStart = useMemo(() => startOfWeekMonday(weekRef), [weekRef]);
  const weekLabel = useMemo(() => formatDateRangeWeek(weekStart), [weekStart]);

  // ✅ zählt: wie oft Training beendet wurde (Workouts) pro W1..W5 im Monat
  const monthCountsByWeek = useMemo(() => {
    const arr = [0, 0, 0, 0, 0]; // W1..W5
    for (const w of workouts) {
      if (!isInMonth(w, monthRef)) continue;
      const d = new Date(w.endedAt || w.startedAt);
      if (Number.isNaN(d.getTime())) continue;
      const idx = weekIndexInMonth(d);
      arr[idx] += 1;
    }
    return arr;
  }, [workouts, monthRef]);

  const monthTotalSessions = useMemo(
    () => monthCountsByWeek.reduce((a, b) => a + b, 0),
    [monthCountsByWeek]
  );

  const weekTotalMinutes = useMemo(() => {
    let total = 0;
    for (const w of workouts) {
      if (!isInWeek(w, weekStart)) continue;
      total += durationMinutes(w);
    }
    return total;
  }, [workouts, weekStart]);

  const weekTotalSessions = useMemo(() => {
    let total = 0;
    for (const w of workouts) {
      if (!isInWeek(w, weekStart)) continue;
      total += 1;
    }
    return total;
  }, [workouts, weekStart]);

  const barMax = Math.max(1, ...monthCountsByWeek);

  const donutRatio = Math.min(weekTotalMinutes / Math.max(WEEKLY_GOAL_MINUTES, 1), 1);
  const donutCircumference = 2 * Math.PI * 40;
  const donutStroke = donutRatio * donutCircumference;

  const goPrevMonth = () => setMonthRef((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1));
  const goNextMonth = () => setMonthRef((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1));

  const goPrevWeek = () => setWeekRef((p) => new Date(p.getTime() - 7 * 24 * 60 * 60 * 1000));
  const goNextWeek = () => setWeekRef((p) => new Date(p.getTime() + 7 * 24 * 60 * 60 * 1000));

  // ------------------ UI ------------------

  return (
    <>
      <div className="h-full w-full overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <section className="mt-2 space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold">Profil</h1>
              <button
                type="button"
                onClick={() => {
                  setSettingsTab("account");
                  setIsSettingsOpen(true);
                }}
                className="h-8 w-8 flex items-center justify-center rounded-full bg-black/40 border border-white/15 text-xs text-white/70 hover:bg-white/10"
                title="Einstellungen"
              >
                ⚙
              </button>
            </div>

            <div className="rounded-2xl bg-brand-card border border-white/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-brand-primary to-purple-500 flex items-center justify-center text-lg font-semibold">
                  {profileName
                    .trim()
                    .split(" ")
                    .filter(Boolean)
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold">{profileName}</span>
                  </div>
                  <p className="text-xs text-white/70 max-w-xs">{profileBio}</p>

                  <div className="flex flex-wrap gap-3 text-[11px] text-white/60">
                    <span>
                      Trainings diese Woche: <span className="text-white/90">{weekTotalSessions}</span>
                    </span>
                    <span>
                      Zeit diese Woche:{" "}
                      <span className="text-white/90">
                        {Math.floor(weekTotalMinutes / 60)}h {weekTotalMinutes % 60}m
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <button
                  type="button"
                  onClick={() => setIsEditProfileOpen(true)}
                  className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs"
                >
                  Profil bearbeiten
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-brand-card border border-white/5 p-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {/* Bars (Monat) */}
                <div className="rounded-xl bg-black/30 border border-white/10 p-3 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Wie oft trainiert (Monat)</span>
                    <span className="text-[10px] text-white/60">
                      {monthTotalSessions} Training{monthTotalSessions === 1 ? "" : "e"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={goPrevMonth}
                      className="h-7 w-7 flex items-center justify-center rounded-full bg-black/40 border border-white/15"
                    >
                      {"<"}
                    </button>
                    <span className="text-white/80 font-medium text-center min-w-[160px]">{monthLabel}</span>
                    <button
                      type="button"
                      onClick={goNextMonth}
                      className="h-7 w-7 flex items-center justify-center rounded-full bg-black/40 border border-white/15"
                    >
                      {">"}
                    </button>
                  </div>

                  {/* ✅ Säulen: sicher sichtbar (keine Brand-Farben) */}
                  <div className="h-32 flex items-end gap-2">
                    {monthCountsByWeek.map((value, index) => {
                      const heightPct = barMax > 0 ? (value / barMax) * 100 : 0;
                      const fillHeight = value === 0 ? 0 : Math.max(6, heightPct);
                      const label = `W${index + 1}`;

                      return (
                        <div key={index} className="flex flex-col items-center flex-1 gap-1 h-full">
                          {/* Track */}
                          <div className="w-full flex-1 rounded-full bg-white/10 overflow-hidden flex items-end">
                            {/* Fill */}
                            <div
                              className="w-full rounded-full bg-blue-500"
                              style={{ height: `${fillHeight}%` }}
                            />
                          </div>

                          <span className="text-[9px] text-white/70">{label}</span>
                          <span className="text-[9px] text-white/60">{value}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* ✅ Debug: zeigt dir sofort, ob gezählt wird */}
                  <div className="text-[10px] text-white/50">
                    Debug: {monthCountsByWeek.map((v, i) => `W${i + 1}:${v}`).join("  ")} (barMax:{barMax})
                  </div>

                  <div className="text-[10px] text-white/45">
                    Jede Einheit zählt als 1. W1–W5 basiert auf Tag im Monat (1–7, 8–14, ...).
                  </div>
                </div>

                {/* Donut (Woche) */}
                <div className="rounded-xl bg-black/30 border border-white/10 p-3 space-y-3 text-xs flex flex-col">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Zeit im Training (Woche)</span>
                    <span className="text-[10px] text-white/60">Ziel: {Math.floor(WEEKLY_GOAL_MINUTES / 60)}h</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={goPrevWeek}
                      className="h-7 w-7 flex items-center justify-center rounded-full bg-black/40 border border-white/15"
                    >
                      {"<"}
                    </button>
                    <span className="text-white/80 font-medium text-center min-w-[160px]">{weekLabel}</span>
                    <button
                      type="button"
                      onClick={goNextWeek}
                      className="h-7 w-7 flex items-center justify-center rounded-full bg-black/40 border border-white/15"
                    >
                      {">"}
                    </button>
                  </div>

                  <div className="mt-1 flex items-center justify-center w-full flex-1">
                    <div className="relative h-32 w-32">
                      <svg viewBox="0 0 100 100" className="h-full w-full rotate-[-90deg]">
                        <circle cx="50" cy="50" r="40" stroke="rgba(255,255,255,0.15)" strokeWidth="10" fill="none" />
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          stroke="#3b82f6"
                          strokeWidth="10"
                          fill="none"
                          strokeDasharray={donutCircumference}
                          strokeDashoffset={donutCircumference - donutStroke}
                          strokeLinecap="round"
                        />
                      </svg>

                      <div className="absolute inset-0 flex flex-col items-center justify-center text-[11px]">
                        <span className="text-white/70">
                          {Math.floor(weekTotalMinutes / 60)}h {weekTotalMinutes % 60}m
                        </span>
                        <span className="text-[9px] text-white/50">{weekTotalSessions} Trainings</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] text-white/45 text-center">
                    Kreis füllt sich mit der Summe deiner Trainingsdauer dieser Woche.
                  </div>
                </div>
              </div>
            </div>

            {/* Gemachte Trainings / Beiträge */}
            <div className="rounded-2xl bg-brand-card border border-white/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-100">Gemachte Trainings</h2>
                <span className="text-[10px] text-white/50">
                  {workouts.length} Beitrag{workouts.length === 1 ? "" : "e"}
                </span>
              </div>

              {workouts.length === 0 && (
                <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] text-white/70">
                  Noch keine Beiträge. Beende ein Training im Live-Modus, dann erscheint hier genau 1 Eintrag pro Training.
                </div>
              )}

              {workouts.length > 0 && (
                <div className="space-y-2">
                  {workouts.slice(0, 30).map((w, idx) => {
                    const vol = volumeOfEntry(w);
                    const exCount = (w.exercises ?? []).length;
                    const date = toLocalDateLabel(w.endedAt ?? w.startedAt);
                    const mins = durationMinutes(w);

                    return (
                      <div key={(w.id ?? "w") + idx} className="rounded-xl border border-white/10 bg-black/30 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[11px] text-white/60">
                              {date} • {mins} min
                            </div>
                            <div className="text-sm font-semibold text-white truncate">
                              {w.title ?? "Training"}{" "}
                              <span className="ml-2 inline-flex rounded-full bg-emerald-500/15 border border-emerald-400/30 px-2 py-0.5 text-[10px] text-emerald-200">
                                Gemacht
                              </span>
                            </div>
                            <div className="mt-1 text-[11px] text-white/70">
                              {exCount} Übung{exCount === 1 ? "" : "en"} • Volumen:{" "}
                              {vol.toLocaleString("de-DE")} kg
                            </div>
                          </div>
                        </div>

                        {exCount > 0 && (
                          <div className="mt-2 space-y-2">
                            {(w.exercises ?? []).map((ex, exIdx) => (
                              <div key={exIdx} className="rounded-lg bg-black/25 border border-white/10 p-2">
                                <div className="text-[11px] font-semibold text-white">{ex.name}</div>

                                <div className="mt-1 space-y-1">
                                  {(ex.sets ?? []).map((s, sIdx) => (
                                    <div
                                      key={sIdx}
                                      className="flex items-center justify-between text-[11px] text-white/75"
                                    >
                                      <span className="text-white/55">Satz {sIdx + 1}</span>
                                      <span className="tabular-nums">
                                        {typeof s.weight === "number" ? `${s.weight} kg` : "—"}{" "}
                                        <span className="text-white/40">x</span>{" "}
                                        {typeof s.reps === "number" ? `${s.reps}` : "—"}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <FeedbackBar page="Profil" />
          </section>
        </div>
      </div>

      {/* MODAL: Profil bearbeiten */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl bg-brand-card border border-white/10 p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Profil bearbeiten</h2>
              <button
                type="button"
                onClick={() => setIsEditProfileOpen(false)}
                className="text-xs text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <div className="space-y-1">
                <label className="block text-white/70">Name</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full rounded-lg bg-black/40 border border-white/20 px-2 py-1.5 text-xs"
                  placeholder="Dein Name"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-white/70">Beschreibung</label>
                <textarea
                  value={profileBio}
                  onChange={(e) => setProfileBio(e.target.value)}
                  className="w-full rounded-lg bg-black/40 border border-white/20 px-2 py-1.5 text-xs min-h-[60px]"
                  placeholder="Kurzbeschreibung deines Trainings, Ziele, Sportarten..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditProfileOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-black/40 border border-white/15 text-[11px] text-white/80"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => setIsEditProfileOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-brand-primary hover:bg-brand-primary/90 text-[11px] font-medium"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Einstellungen */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-3xl max-h-[80vh] rounded-2xl bg-brand-card border border-white/10 p-4 sm:p-6 text-xs flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold">Einstellungen</span>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="text-xs text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mb-4 text-[11px]">
              <button
                type="button"
                onClick={() => setSettingsTab("account")}
                className={
                  "px-3 py-1.5 rounded-full border " +
                  (settingsTab === "account"
                    ? "border-brand-primary bg-brand-primary text-black"
                    : "border-white/15 bg-black/40 text-white/70 hover:bg-white/10")
                }
              >
                Konto &amp; Daten
              </button>
              <button
                type="button"
                onClick={() => setSettingsTab("notifications")}
                className={
                  "px-3 py-1.5 rounded-full border " +
                  (settingsTab === "notifications"
                    ? "border-brand-primary bg-brand-primary text-black"
                    : "border-white/15 bg-black/40 text-white/70 hover:bg-white/10")
                }
              >
                Benachrichtigungen
              </button>
              <button
                type="button"
                onClick={() => setSettingsTab("legal")}
                className={
                  "px-3 py-1.5 rounded-full border " +
                  (settingsTab === "legal"
                    ? "border-brand-primary bg-brand-primary text-black"
                    : "border-white/15 bg-black/40 text-white/70 hover:bg-white/10")
                }
              >
                Rechtliches / Impressum
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 text-[11px] sm:text-xs space-y-4">
              {settingsTab === "account" && (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">Konto &amp; Basisdaten</h3>
                  <p className="text-[11px] text-white/60">
                    Hier verwaltest du deine grundlegenden Kontodaten. Die Funktionen sind aktuell noch im Aufbau.
                  </p>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <span className="block text-white/70 text-[11px]">E-Mail-Adresse</span>
                      <input
                        type="email"
                        value={accountEmail}
                        onChange={(e) => setAccountEmail(e.target.value)}
                        className="w-full rounded-lg bg-black/40 border border-white/20 px-2 py-1.5 text-[11px]"
                        placeholder="dein.mail@example.com"
                      />
                      <span className="text-[10px] text-white/40">
                        Login-Optionen (Google, Apple, Facebook) folgen später.
                      </span>
                    </div>

                    <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
                      <h4 className="text-[11px] font-semibold text-red-300/90">Kritische Aktionen</h4>
                      <p className="text-[10px] text-white/50">
                        Bitte vorsichtig verwenden – manche Aktionen lassen sich nicht rückgängig machen.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => alert("Profil löschen wird später eingebaut.")}
                          className="px-3 py-1.5 rounded-xl border border-red-500/60 bg-red-500/10 text-[11px] text-red-50 hover:bg-red-500/20"
                        >
                          Profil löschen
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (!onClearCalendar) {
                              alert("Kalender leeren ist noch nicht mit der App verbunden.");
                              return;
                            }
                            const ok = window.confirm(
                              "Willst du wirklich alle Kalendereinträge löschen? Diese Aktion kann nicht rückgängig gemacht werden."
                            );
                            if (ok) {
                              onClearCalendar();
                              alert("Kalender wurde geleert.");
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl border border-amber-500/60 bg-amber-500/10 text-[11px] text-amber-50 hover:bg-amber-500/20"
                        >
                          Kalender leeren
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {settingsTab === "notifications" && (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">Benachrichtigungen</h3>
                  <p className="text-[11px] text-white/60">
                    Stelle ein, welche Infos du von TrainQ als Erinnerungen bekommen möchtest. Backend-Logik folgt später.
                  </p>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setNotificationsTraining((prev) => !prev)}
                      className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/40 px-3 py-2 hover:bg-white/5"
                    >
                      <div className="text-left">
                        <div className="text-[11px] font-medium">Training-Reminder</div>
                        <div className="text-[10px] text-white/55">Erinnerungen für geplante Trainings.</div>
                      </div>
                      <span
                        className={
                          "inline-flex items-center justify-center rounded-full px-3 py-1 text-[10px] " +
                          (notificationsTraining
                            ? "bg-brand-primary text-black"
                            : "bg-black/70 text-white/60 border border-white/20")
                        }
                      >
                        {notificationsTraining ? "An" : "Aus"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNotificationsSummary((prev) => !prev)}
                      className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/40 px-3 py-2 hover:bg-white/5"
                    >
                      <div className="text-left">
                        <div className="text-[11px] font-medium">Wöchentliche Zusammenfassung</div>
                        <div className="text-[10px] text-white/55">Überblick über Woche: Trainings, Minuten, Fortschritt.</div>
                      </div>
                      <span
                        className={
                          "inline-flex items-center justify-center rounded-full px-3 py-1 text-[10px] " +
                          (notificationsSummary
                            ? "bg-brand-primary text-black"
                            : "bg-black/70 text-white/60 border border-white/20")
                        }
                      >
                        {notificationsSummary ? "An" : "Aus"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNotificationsNews((prev) => !prev)}
                      className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/40 px-3 py-2 hover:bg-white/5"
                    >
                      <div className="text-left">
                        <div className="text-[11px] font-medium">App-News &amp; Updates</div>
                        <div className="text-[10px] text-white/55">Infos zu neuen Funktionen und Releases.</div>
                      </div>
                      <span
                        className={
                          "inline-flex items-center justify-center rounded-full px-3 py-1 text-[10px] " +
                          (notificationsNews
                            ? "bg-brand-primary text-black"
                            : "bg-black/70 text-white/60 border border-white/20")
                        }
                      >
                        {notificationsNews ? "An" : "Aus"}
                      </span>
                    </button>
                  </div>

                  <p className="pt-2 text-[10px] text-white/45">
                    Hinweis: In der MVP-Version werden noch keine echten Push-Nachrichten verschickt.
                  </p>
                </section>
              )}

              {settingsTab === "legal" && (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">Rechtliches / Impressum</h3>
                  <p className="text-[11px] text-white/60">
                    Hier findest du die rechtlich relevenden Informationen für die Nutzung von TrainQ (App und Website).
                  </p>

                  <div className="inline-flex rounded-full bg-black/40 border border-white/15 p-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setLegalTab("privacy")}
                      className={
                        "px-3 py-1 rounded-full " +
                        (legalTab === "privacy" ? "bg-brand-primary text-black" : "text-white/70 hover:bg-white/5")
                      }
                    >
                      Datenschutz
                    </button>
                    <button
                      type="button"
                      onClick={() => setLegalTab("imprint")}
                      className={
                        "px-3 py-1 rounded-full " +
                        (legalTab === "imprint" ? "bg-brand-primary text-black" : "text-white/70 hover:bg-white/5")
                      }
                    >
                      Impressum
                    </button>
                    <button
                      type="button"
                      onClick={() => setLegalTab("terms")}
                      className={
                        "px-3 py-1 rounded-full " +
                        (legalTab === "terms" ? "bg-brand-primary text-black" : "text-white/70 hover:bg-white/5")
                      }
                    >
                      AGB
                    </button>
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProfilePage;