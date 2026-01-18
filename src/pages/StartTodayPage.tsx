import React, { useEffect, useMemo, useState } from "react";
import type { CalendarEvent, TrainingType } from "../types/training";
import { useTodaysSessions } from "../hooks/useTodaysSessions";
import { useI18n } from "../i18n/useI18n";
import { startSession, startTrainingTemplate } from "../utils/startSession";
import { getTemplates, saveTemplate, type TrainingTemplateLite } from "../utils/trainingTemplatesStore";

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
    <div className="w-full min-h-screen bg-[#061226] text-white">
        <div className="w-full max-w-3xl mx-auto px-4 py-8 space-y-8">
            <header className="space-y-2">
                <p className="text-base text-gray-400">{t("today.subtitle")}</p>
                <h1 className="text-3xl font-bold text-white">{t("today.title")}</h1>
                <p className="text-lg text-gray-300">{dateLabel}</p>
            </header>

            <section className="space-y-4">
                <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">{t("today.section.planned")}</h2>
                <button type="button" onClick={onPlanTraining} className="rounded-full px-4 py-2 text-sm font-semibold bg-white/10 border border-white/10 hover:bg-white/20">
                    {t("today.planTraining")}
                </button>
                </div>

                {status === "none" && (
                    <div className="rounded-[24px] p-6 bg-white/5 border border-white/10 backdrop-blur-md text-center">
                        <h3 className="text-lg font-semibold text-white">{t("today.empty.title")}</h3>
                        <p className="text-base text-gray-300 mt-2">{t("today.empty.subtitle")}</p>
                    </div>
                )}

                {status === "single" && primarySession && (
                    <div className="rounded-[24px] p-5 space-y-4 bg-white/5 border border-white/10 backdrop-blur-md">
                        <div>
                            <h3 className="text-xl font-semibold text-white">{primarySession.title || t("today.untitled")}</h3>
                            <p className="text-base text-gray-300 mt-1">
                                {primarySession.startAt ? `${primarySession.startAt} · ` : ""}
                                {formatSportLabel(primarySession.sportType, t)}
                            </p>
                        </div>
                        <button type="button" onClick={() => startSession(primarySession)} className="w-full rounded-xl px-5 py-3 text-base font-semibold bg-[#2563EB] hover:bg-sky-500 shadow-[0_0_20px_theme(colors.sky.500/50%)]">
                            {t("today.startPrimary")}
                        </button>
                    </div>
                )}

                {status === "multiple" && (
                    <div className="space-y-3">
                        {sessions.map((session) => (
                        <div key={session.id} className="rounded-[24px] p-4 flex items-center justify-between gap-4 bg-white/5 border border-white/10 backdrop-blur-md">
                            <div className="min-w-0">
                                <h3 className="text-lg font-semibold truncate text-white">{session.title || t("today.untitled")}</h3>
                                <p className="text-base text-gray-300">
                                    {session.startAt ? `${session.startAt} · ` : ""}
                                    {formatSportLabel(session.sportType, t)}
                                </p>
                            </div>
                            <button type="button" onClick={() => startSession(session)} className="rounded-full px-5 py-2 text-sm font-semibold bg-[#2563EB] hover:bg-sky-500">
                                {t("today.start")}
                            </button>
                        </div>
                        ))}
                    </div>
                )}
            </section>
            
            <section className="space-y-4">
                <h2 className="text-xl font-semibold text-white">{t("today.templates.title")}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {templates.map((template) => (
                    <div key={template.id} className="rounded-[24px] p-5 flex flex-col justify-between bg-white/5 border border-white/10 backdrop-blur-md">
                        <div>
                            <h3 className="text-xl font-semibold text-white">{template.title}</h3>
                            <p className="text-base text-gray-300 mt-2">{formatSportLabel(template.sportType, t)}</p>
                            <p className="text-sm text-gray-400 mt-1">{buildTemplateSummary(template, t)}</p>
                        </div>
                        <button type="button" onClick={() => startTrainingTemplate(template)} className="mt-4 w-full rounded-xl px-4 py-3 text-base font-semibold bg-[#2563EB] hover:bg-sky-500">
                            {t("today.templates.start")}
                        </button>
                    </div>
                    ))}
                </div>
                <button type="button" onClick={() => setIsCreateOpen(true)} className="w-full rounded-[24px] px-4 py-4 text-base font-semibold bg-white/5 border border-white/10 hover:bg-white/10 backdrop-blur-md">
                    + {t("today.templates.create")}
                </button>
            </section>

            {isCreateOpen && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 px-4" onClick={closeCreate}>
                    <div className="w-full max-w-md rounded-[24px] p-5 space-y-4 bg-white/5 border border-white/10 backdrop-blur-md" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-xl font-semibold text-white">{t("today.templates.createTitle")}</h3>
                        <div className="space-y-3">
                            <label className="block text-sm text-gray-300">{t("today.templates.fieldTitle")}</label>
                            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className={`w-full rounded-xl px-3 py-2.5 text-base bg-white/5 border ${attemptedSave && !newTitle.trim() ? "border-red-500" : "border-white/10"} text-white`} />
                            {attemptedSave && !newTitle.trim() && <p className="text-sm text-red-400">{t("today.templates.titleRequired")}</p>}
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm text-gray-300">{t("today.templates.fieldSport")}</label>
                            <select value={newSportType} onChange={(e) => setNewSportType(e.target.value as TrainingType)} className="w-full rounded-xl px-3 py-2.5 text-base bg-white/5 border border-white/10 text-white">
                                <option value="gym">{t("training.sport.gym")}</option>
                                <option value="laufen">{t("training.sport.run")}</option>
                                <option value="radfahren">{t("training.sport.bike")}</option>
                                <option value="custom">{t("plan.sport.custom")}</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-3 pt-2">
                            <button type="button" onClick={closeCreate} className="flex-1 rounded-xl px-4 py-2 text-base font-semibold bg-white/10 border border-white/10 hover:bg-white/20">
                                {t("common.cancel")}
                            </button>
                            <button type="button" onClick={handleSaveTemplate} className="flex-1 rounded-xl px-4 py-2 text-base font-semibold bg-[#2563EB] hover:bg-sky-500">
                                {t("common.save")}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
}