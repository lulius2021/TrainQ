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
    <div className="w-full max-w-3xl mx-auto px-4 py-8 space-y-10 pb-24">
      <header className="space-y-1">
        <h1 className="text-3xl font-black">{t("today.title")}</h1>
        <div className="text-blue-400/60 uppercase tracking-widest text-sm font-medium">{dateLabel}</div>
      </header>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{t("today.section.planned")}</h2>
        </div>

        {status === "none" && (
          <div className="text-center bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8 space-y-2">
            <h3 className="font-semibold">{t("today.empty.title")}</h3>
            <p className="text-sm text-white/60">{t("today.empty.subtitle")}</p>
          </div>
        )}

        {status === "single" && primarySession && (
          <div className="rounded-3xl p-5 space-y-4 bg-white/5 border border-white/10">
            <div className="space-y-1">
              <div className="text-base font-semibold">{primarySession.title || t("today.untitled")}</div>
              <div className="text-sm text-white/60">
                {primarySession.startAt ? `${primarySession.startAt} · ` : ""}
                {formatSportLabel(primarySession.sportType, t)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => startSession(primarySession)}
              className="w-full rounded-xl px-5 py-3 text-sm font-bold bg-blue-600 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-all"
            >
              {t("today.startPrimary")}
            </button>
          </div>
        )}

        {status === "multiple" && (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="rounded-3xl p-4 flex items-center justify-between gap-4 bg-white/5 border border-white/10"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{session.title || t("today.untitled")}</div>
                  <div className="text-xs text-white/60">
                    {session.startAt ? `${session.startAt} · ` : ""}
                    {formatSportLabel(session.sportType, t)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => startSession(session)}
                  className="rounded-full px-5 py-2 text-xs font-bold bg-blue-600 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-all"
                >
                  {t("today.start")}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {status === "none" && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold">{t("today.templates.title")}</h2>
          <div className="space-y-4">
            {templates.map((template) => (
              <div key={template.id} className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold">{template.title}</h3>
                    <div className="flex items-center gap-2 text-white/60">
                      <span className="text-[10px] uppercase font-medium">
                        {formatSportLabel(template.sportType, t)}
                      </span>
                      <span className="text-white/20">·</span>
                      <span className="text-[10px] uppercase font-medium">{buildTemplateSummary(template, t)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => startTrainingTemplate(template)}
                    className="bg-blue-600 text-white font-bold py-2 px-5 rounded-lg shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-all shrink-0"
                  >
                    {t("today.templates.start")}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="w-full rounded-3xl p-4 text-sm font-semibold bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
          >
            {t("today.templates.create")}
          </button>
        </section>
      )}

      {isCreateOpen && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
          data-overlay-open="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeCreate();
          }}
          role="dialog"
          aria-modal="true"
          aria-label={t("today.templates.createTitle")}
        >
          <div className="w-full max-w-md rounded-3xl p-5 space-y-4 bg-white/5 border border-white/10">
            <h3 className="text-base font-semibold">{t("today.templates.createTitle")}</h3>

            <div className="space-y-2">
              <label className="text-xs font-medium text-white/60">{t("today.templates.fieldTitle")}</label>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-sm bg-white/5 border border-white/10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              {attemptedSave && !newTitle.trim() && (
                <div className="text-xs text-red-500">{t("today.templates.titleRequired")}</div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-white/60">{t("today.templates.fieldSport")}</label>
              <select
                value={newSportType}
                onChange={(e) => setNewSportType(e.target.value as TrainingType)}
                className="w-full rounded-xl px-3 py-2 text-sm bg-black/20 border border-white/10 appearance-none"
              >
                <option value="gym">{t("training.sport.gym")}</option>
                <option value="laufen">{t("training.sport.run")}</option>
                <option value="radfahren">{t("training.sport.bike")}</option>
                <option value="custom">{t("plan.sport.custom")}</option>
              </select>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={closeCreate}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={handleSaveTemplate}
                className="flex-1 rounded-xl py-2.5 text-sm font-bold bg-blue-600 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-all"
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
