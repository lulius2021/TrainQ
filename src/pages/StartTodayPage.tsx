import React, { useEffect, useMemo, useState } from "react";
import type { CalendarEvent, TrainingType } from "../types/training";
import { useTodaysSessions } from "../hooks/useTodaysSessions";
import { useI18n } from "../i18n/useI18n";
import { startSession, startTrainingTemplate } from "../utils/startSession";
import { getTemplates, saveTemplate, type TrainingTemplateLite } from "../utils/trainingTemplatesStore";
import { PageHeader } from "../components/ui/PageHeader";
import { AppCard } from "../components/ui/AppCard";
import { AppButton } from "../components/ui/AppButton";

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

    /* 
     * Dynamic top padding: 
     * Header is fixed. Content starts below.
     * `PageHeader` is typically ~96px tall effectively (safe-area + title).
     * We will add `pt-[calc(env(safe-area-inset-top)+60px)]` to be safe/approximate, 
     * or rely on `PageHeader`'s layout if it pushes content. 
     * Since PageHeader is fixed, we need padding.
     */

    return (
        <div className="w-full h-full pb-[var(--nav-height)]">
            <PageHeader
                title={t("today.title")}
                className="pb-2"
                rightAction={
                    <AppButton
                        onClick={onPlanTraining}
                        variant="primary"
                        size="sm"
                        className="!bg-[#007AFF] !text-white !font-semibold !rounded-xl hover:!brightness-110 active:!scale-95 transition-all"
                    >
                        {t("today.planTraining")}
                    </AppButton>
                }
            />

            <div className="w-full max-w-3xl mx-auto px-4 space-y-8">
                <div className="pt-0">
                    <p className="text-xl font-medium text-[var(--muted)]">{dateLabel}</p>
                </div>

                <section className="space-y-4">
                    <h2 className="text-xl font-semibold text-[var(--text)]">{t("today.section.planned")}</h2>

                    {status === "none" && (
                        <AppCard variant="glass" className="p-8 text-center flex flex-col items-center justify-center min-h-[160px]">
                            <h3 className="text-lg font-semibold text-[var(--text)]">{t("today.empty.title")}</h3>
                            <p className="text-base text-[var(--muted)] mt-2">{t("today.empty.subtitle")}</p>
                        </AppCard>
                    )}

                    {status === "single" && primarySession && (
                        <AppCard variant="glass" className="p-0 overflow-hidden relative group">
                            <div className="p-6 space-y-1">
                                <h3 className="text-2xl font-bold text-[var(--text)]">{primarySession.title || t("today.untitled")}</h3>
                                <p className="text-base text-[var(--muted)]">
                                    {primarySession.startAt ? `${primarySession.startAt} · ` : ""}
                                    {formatSportLabel(primarySession.sportType, t)}
                                </p>
                            </div>
                            <div className="px-6 pb-6">
                                <AppButton
                                    onClick={() => startSession(primarySession)}
                                    variant="primary"
                                    fullWidth
                                    size="lg"
                                    className="!bg-[#007AFF] !text-white !font-semibold !rounded-xl hover:!brightness-110 active:!scale-95 transition-all shadow-lg shadow-blue-500/20"
                                >
                                    {t("today.startPrimary")}
                                </AppButton>
                            </div>
                        </AppCard>
                    )}

                    {status === "multiple" && (
                        <div className="space-y-3">
                            {sessions.map((session) => (
                                <AppCard key={session.id} variant="glass" className="p-4 flex items-center justify-between gap-4">
                                    <div className="min-w-0">
                                        <h3 className="text-lg font-semibold truncate text-[var(--text)]">{session.title || t("today.untitled")}</h3>
                                        <p className="text-sm text-[var(--muted)]">
                                            {session.startAt ? `${session.startAt} · ` : ""}
                                            {formatSportLabel(session.sportType, t)}
                                        </p>
                                    </div>
                                    <AppButton
                                        onClick={() => startSession(session)}
                                        variant="primary"
                                        size="sm"
                                        className="!bg-[#007AFF] !text-white !font-semibold !rounded-xl hover:!brightness-110 active:!scale-95 transition-all"
                                    >
                                        {t("today.start")}
                                    </AppButton>
                                </AppCard>
                            ))}
                        </div>
                    )}
                </section>

                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-[var(--text)]">{t("today.templates.title")}</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {templates.map((template) => (
                            <AppCard key={template.id} variant="glass" className="p-5 flex flex-col justify-between h-full">
                                <div>
                                    <h3 className="text-lg font-semibold text-[var(--text)] line-clamp-1">{template.title}</h3>
                                    <p className="text-sm text-[var(--muted)] mt-1">{formatSportLabel(template.sportType, t)}</p>
                                    <p className="text-xs text-[var(--muted)] mt-1 opacity-80">{buildTemplateSummary(template, t)}</p>
                                </div>
                                <AppButton
                                    onClick={() => startTrainingTemplate(template)}
                                    variant="secondary"
                                    fullWidth
                                    className="mt-4"
                                >
                                    {t("today.templates.start")}
                                </AppButton>
                            </AppCard>
                        ))}
                        <button
                            type="button"
                            onClick={() => setIsCreateOpen(true)}
                            className="rounded-2xl p-5 flex flex-col items-center justify-center min-h-[140px] bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/15 text-[var(--muted)] transition-all active:scale-95"
                        >
                            <span className="text-2xl mb-2">+</span>
                            <span className="font-medium">{t("today.templates.create")}</span>
                        </button>
                    </div>
                </section>

                {isCreateOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={closeCreate}>
                        <AppCard variant="glass" className="w-full max-w-md p-6 space-y-5" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                            <h3 className="text-xl font-bold text-[var(--text)]">{t("today.templates.createTitle")}</h3>
                            <div className="space-y-3">
                                <label className="block text-sm font-medium text-[var(--muted)]">{t("today.templates.fieldTitle")}</label>
                                <input
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    placeholder="Mein Training..."
                                    className={`w-full rounded-xl px-3 py-3 text-base bg-[var(--surface2)] border ${attemptedSave && !newTitle.trim() ? "border-red-500" : "border-[var(--border)]"} text-[var(--text)] outline-none focus:ring-1 focus:ring-[var(--primary)]`}
                                />
                                {attemptedSave && !newTitle.trim() && <p className="text-sm text-red-500">{t("today.templates.titleRequired")}</p>}
                            </div>
                            <div className="space-y-3">
                                <label className="block text-sm font-medium text-[var(--muted)]">{t("today.templates.fieldSport")}</label>
                                <select
                                    value={newSportType}
                                    onChange={(e) => setNewSportType(e.target.value as TrainingType)}
                                    className="w-full rounded-xl px-3 py-3 text-base bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] outline-none focus:ring-1 focus:ring-[var(--primary)] appearance-none"
                                >
                                    <option value="gym">{t("training.sport.gym")}</option>
                                    <option value="laufen">{t("training.sport.run")}</option>
                                    <option value="radfahren">{t("training.sport.bike")}</option>
                                    <option value="custom">{t("plan.sport.custom")}</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-3 pt-4">
                                <AppButton onClick={closeCreate} variant="ghost" fullWidth>
                                    {t("common.cancel")}
                                </AppButton>
                                <AppButton
                                    onClick={handleSaveTemplate}
                                    variant="primary"
                                    fullWidth
                                    className="!bg-[#007AFF] !text-white !font-semibold !rounded-xl hover:!brightness-110 active:!scale-95 transition-all"
                                >
                                    {t("common.save")}
                                </AppButton>
                            </div>
                        </AppCard>
                    </div>
                )}
            </div>
        </div>
    );
}