import React, { useEffect, useMemo, useState } from "react";
import type { CalendarEvent, TrainingType } from "../types/training";
import { useTodaysSessions } from "../hooks/useTodaysSessions";
import { useI18n } from "../i18n/useI18n";
import { startSession, startTrainingTemplate } from "../utils/startSession";
import {
  getTemplates,
  saveTemplate,
  type TrainingTemplateLite,
} from "../utils/trainingTemplatesStore";

interface StartTodayPageProps {
  events: CalendarEvent[];
  onPlanTraining: () => void;
}

function formatSportLabel(type: TrainingType, t: (key: any) => string): string {
  if (type === "laufen") return t("training.sport.run");
  if (type === "radfahren") return t("training.sport.bike");
  if (type === "custom") return t("plan.sport.custom");
  return t("training.sport.gym");
}

function buildTemplateSummary(template: TrainingTemplateLite, t: (key: any, vars?: any) => string): string {
  const exercises = template.exercises?.length ?? 0;
  const sets = template.exercises?.reduce((acc, ex) => acc + (ex.sets?.length ?? 0), 0) ?? 0;
  if (exercises === 0) return t("today.templates.summaryEmpty");
  return t("today.templates.summary", { exercises, sets });
}

export default function StartTodayPage({ events, onPlanTraining }: StartTodayPageProps) {
  const { t, formatDate } = useI18n();
  const { sessions, status, primarySession } = useTodaysSessions(events);

  const [templates, setTemplates] = useState<TrainingTemplateLite[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSportType, setNewSportType] = useState<TrainingType>("gym");
  const [attemptedSave, setAttemptedSave] = useState(false);

  useEffect(() => {
    setTemplates(getTemplates());
  }, []);

  useEffect(() => {
    if (!isCreateOpen) return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const scrollY = window.scrollY || window.pageYOffset;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, [isCreateOpen]);

  const dateLabel = useMemo(() => {
    return formatDate(new Date(), { weekday: "long", day: "2-digit", month: "long" });
  }, [formatDate]);

  const surfaceCard: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)" };
  const surfaceSoft: React.CSSProperties = { background: "var(--surface2)", border: "1px solid var(--border)" };

  const closeCreate = () => {
    setIsCreateOpen(false);
    setNewTitle("");
    setNewSportType("gym");
    setAttemptedSave(false);
  };

  const handleSaveTemplate = () => {
    setAttemptedSave(true);
    if (!newTitle.trim()) return;
    saveTemplate({
      title: newTitle.trim(),
      sportType: newSportType,
    });
    setTemplates(getTemplates());
    closeCreate();
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-6">
      <header className="space-y-2">
        <div className="text-[12px]" style={{ color: "var(--muted)" }}>
          {t("today.subtitle")}
        </div>
        <h1 className="text-[26px] font-semibold" style={{ color: "var(--text)" }}>
          {t("today.title")}
        </h1>
        <div className="text-[14px]" style={{ color: "var(--muted)" }}>
          {dateLabel}
        </div>
      </header>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
            {t("today.section.planned")}
          </div>
          <button
            type="button"
            onClick={onPlanTraining}
            className="rounded-full px-3 py-1.5 text-[11px] font-semibold hover:opacity-95"
            style={surfaceSoft}
          >
            {t("today.planTraining")}
          </button>
        </div>

        {status === "none" && (
          <div className="rounded-2xl p-4 space-y-3" style={surfaceCard}>
            <div className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>
              {t("today.empty.title")}
            </div>
            <div className="text-[12px]" style={{ color: "var(--muted)" }}>
              {t("today.empty.subtitle")}
            </div>
          </div>
        )}

        {status === "single" && primarySession && (
          <div className="rounded-2xl p-4 space-y-4" style={surfaceCard}>
            <div className="space-y-1">
              <div className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>
                {primarySession.title || t("today.untitled")}
              </div>
              <div className="text-[12px]" style={{ color: "var(--muted)" }}>
                {primarySession.startAt ? `${primarySession.startAt} · ` : ""}
                {formatSportLabel(primarySession.sportType, t)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => startSession(primarySession)}
              className="w-full rounded-2xl px-5 py-3 text-[14px] font-semibold hover:opacity-95"
              style={{ background: "var(--primary)", color: "#061226" }}
            >
              {t("today.startPrimary")}
            </button>
          </div>
        )}

        {status === "multiple" && (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div key={session.id} className="rounded-2xl p-4 flex items-center justify-between gap-4" style={surfaceCard}>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold truncate" style={{ color: "var(--text)" }}>
                    {session.title || t("today.untitled")}
                  </div>
                  <div className="text-[12px]" style={{ color: "var(--muted)" }}>
                    {session.startAt ? `${session.startAt} · ` : ""}
                    {formatSportLabel(session.sportType, t)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => startSession(session)}
                  className="rounded-full px-4 py-2 text-[12px] font-semibold hover:opacity-95"
                  style={{ background: "var(--primary)", color: "#061226" }}
                >
                  {t("today.start")}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {status === "none" && (
        <section className="space-y-3">
          <div className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
            {t("today.templates.title")}
          </div>
          <div className="space-y-3">
            {templates.map((template) => (
              <div key={template.id} className="rounded-2xl p-4" style={surfaceSoft}>
                <div className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>
                  {template.title}
                </div>
                <button
                  type="button"
                  onClick={() => startTrainingTemplate(template)}
                  className="mt-3 w-full rounded-md px-4 py-3 text-[13px] font-semibold hover:opacity-95"
                  style={{ background: "var(--primary)", color: "#061226" }}
                >
                  {t("today.templates.start")}
                </button>
                <div className="mt-3 text-[12px]" style={{ color: "var(--muted)" }}>
                  {formatSportLabel(template.sportType, t)}
                </div>
                <div className="mt-1 text-[11px]" style={{ color: "var(--muted)" }}>
                  {buildTemplateSummary(template, t)}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="w-full rounded-2xl px-4 py-3 text-[13px] font-semibold hover:opacity-95"
            style={surfaceCard}
          >
            {t("today.templates.create")}
          </button>
        </section>
      )}

      {isCreateOpen && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 px-4"
          data-overlay-open="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeCreate();
          }}
          role="dialog"
          aria-modal="true"
          aria-label={t("today.templates.createTitle")}
        >
          <div className="w-full max-w-md rounded-2xl p-4 space-y-4" style={surfaceCard}>
            <div className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>
              {t("today.templates.createTitle")}
            </div>

            <div className="space-y-2">
              <label className="text-[11px]" style={{ color: "var(--muted)" }}>
                {t("today.templates.fieldTitle")}
              </label>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-[13px]"
                style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}
              />
              {attemptedSave && !newTitle.trim() && (
                <div className="text-[11px]" style={{ color: "#ef4444" }}>
                  {t("today.templates.titleRequired")}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-[11px]" style={{ color: "var(--muted)" }}>
                {t("today.templates.fieldSport")}
              </label>
              <select
                value={newSportType}
                onChange={(e) => setNewSportType(e.target.value as TrainingType)}
                className="w-full rounded-xl px-3 py-2 text-[13px]"
                style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}
              >
                <option value="gym">{t("training.sport.gym")}</option>
                <option value="laufen">{t("training.sport.run")}</option>
                <option value="radfahren">{t("training.sport.bike")}</option>
                <option value="custom">{t("plan.sport.custom")}</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={closeCreate}
                className="flex-1 rounded-xl px-3 py-2 text-[12px] font-semibold hover:opacity-95"
                style={surfaceSoft}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={handleSaveTemplate}
                className="flex-1 rounded-xl px-3 py-2 text-[12px] font-semibold hover:opacity-95"
                style={{ background: "var(--primary)", color: "#061226" }}
              >
                {t("common.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
