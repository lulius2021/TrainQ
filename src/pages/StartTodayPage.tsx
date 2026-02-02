import React, { useEffect, useMemo, useState } from "react";
import type { CalendarEvent, TrainingType } from "../types/training";
import { useTodaysSessions } from "../hooks/useTodaysSessions";
import { useI18n } from "../i18n/useI18n";
import { startSession, startTrainingTemplate } from "../utils/startSession";
import { getTemplates, saveTemplate, deleteTemplate, type TrainingTemplateLite } from "../utils/trainingTemplatesStore";
import { PageHeader } from "../components/ui/PageHeader";
import { AppCard } from "../components/ui/AppCard";
import { AppButton } from "../components/ui/AppButton";

interface StartTodayPageProps {
    events: CalendarEvent[];
    onPlanTraining: () => void;
}

function formatSportLabel(type: TrainingType): string {
    if (type === "laufen") return "Laufen";
    if (type === "radfahren") return "Radfahren";
    if (type === "custom") return "Custom";
    return "Gym";
}

function buildTemplateSummary(template: TrainingTemplateLite): string {
    const exercises = template.exercises?.length ?? 0;
    const sets = template.exercises?.reduce((acc, ex) => acc + (ex.sets?.length ?? 0), 0) ?? 0;
    if (exercises === 0) return "Keine Übungen";
    return `${exercises} Übungen, ${sets} Sätze`;
}

function TrashIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        </svg>
    );
}

export default function StartTodayPage({ events, onPlanTraining }: StartTodayPageProps) {
    const { formatDate } = useI18n();
    const { sessions, status, primarySession } = useTodaysSessions(events);

    const [templates, setTemplates] = useState<TrainingTemplateLite[]>([]);
    const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
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

    const confirmDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setTemplateToDelete(id);
    };

    const handleDeleteTemplate = () => {
        if (templateToDelete) {
            deleteTemplate(templateToDelete);
            setTemplates(getTemplates());
            setTemplateToDelete(null);
        }
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
        <div className="w-full h-full pb-40">
            <PageHeader
                title="Heute"
                className="pb-2"
            />

            <div className="w-full max-w-3xl mx-auto px-4 space-y-8">
                <div className="pt-0">
                    <p className="text-xl font-medium text-[var(--muted)]">{dateLabel}</p>
                </div>

                <section className="space-y-4">
                    <h2 className="text-xl font-semibold text-[var(--text)]">Geplantes Training</h2>

                    {status === "none" && (
                        <AppCard variant="glass" className="p-8 text-center flex flex-col items-center justify-center min-h-[160px]">
                            <h3 className="text-lg font-semibold text-[var(--text)]">Kein Training geplant</h3>
                            <p className="text-base text-[var(--muted)] mt-2">Genieße deinen Ruhetag oder starte ein spontanes Training.</p>
                        </AppCard>
                    )}

                    {status === "single" && primarySession && (
                        <AppCard variant="glass" className="p-0 overflow-hidden relative group">
                            <div className="p-6 space-y-1">
                                <h3 className="text-2xl font-bold text-[var(--text)]">{primarySession.title || "Unbenanntes Training"}</h3>
                                <p className="text-base text-[var(--muted)]">
                                    {primarySession.startAt ? `${primarySession.startAt} · ` : ""}
                                    {formatSportLabel(primarySession.sportType)}
                                </p>
                            </div>
                            <div className="px-6 pb-6">
                                <AppButton
                                    onClick={() => startSession(primarySession)}
                                    variant="primary"
                                    fullWidth
                                    size="lg"
                                    className="!bg-[#007AFF] !text-white !font-semibold !rounded-3xl hover:!brightness-110 active:!scale-95 transition-all shadow-lg shadow-blue-500/20"
                                >
                                    Training starten
                                </AppButton>
                            </div>
                        </AppCard>
                    )}

                    {status === "multiple" && (
                        <div className="space-y-3">
                            {sessions.map((session) => (
                                <AppCard key={session.id} variant="glass" className="p-4 flex items-center justify-between gap-4">
                                    <div className="min-w-0">
                                        <h3 className="text-lg font-semibold truncate text-[var(--text)]">{session.title || "Unbenanntes Training"}</h3>
                                        <p className="text-sm text-[var(--muted)]">
                                            {session.startAt ? `${session.startAt} · ` : ""}
                                            {formatSportLabel(session.sportType)}
                                        </p>
                                    </div>
                                    <AppButton
                                        onClick={() => startSession(session)}
                                        variant="primary"
                                        size="sm"
                                        className="!bg-[#007AFF] !text-white !font-semibold !rounded-3xl hover:!brightness-110 active:!scale-95 transition-all"
                                    >
                                        Starten
                                    </AppButton>
                                </AppCard>
                            ))}
                        </div>
                    )}
                </section>

                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-[var(--text)]">Meine Vorlagen</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {templates.map((template) => (
                            <AppCard key={template.id} variant="glass" className="p-5 flex flex-col justify-between h-full relative group">
                                <button
                                    onClick={(e) => confirmDelete(e, template.id)}
                                    className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-500 transition-all backdrop-blur-md opacity-0 group-hover:opacity-100 focus:opacity-100"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                                <div>
                                    <h3 className="text-lg font-semibold text-[var(--text)] line-clamp-1 pr-8">{template.title}</h3>
                                    <p className="text-sm text-[var(--muted)] mt-1">{formatSportLabel(template.sportType)}</p>
                                    <p className="text-xs text-[var(--muted)] mt-1 opacity-80">{buildTemplateSummary(template)}</p>
                                </div>
                                <AppButton
                                    onClick={() => startTrainingTemplate(template)}
                                    variant="secondary"
                                    fullWidth
                                    className="mt-4"
                                >
                                    Starten
                                </AppButton>
                            </AppCard>
                        ))}
                        <button
                            type="button"
                            onClick={() => setIsCreateOpen(true)}
                            className="rounded-2xl p-5 flex flex-col items-center justify-center min-h-[140px] bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/15 text-[var(--muted)] transition-all active:scale-95"
                        >
                            <span className="text-2xl mb-2">+</span>
                            <span className="font-medium">Neue Vorlage</span>
                        </button>
                    </div>
                </section>

                {isCreateOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={closeCreate}>
                        <AppCard variant="glass" className="w-full max-w-md p-6 space-y-5" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                            <h3 className="text-xl font-bold text-[var(--text)]">Neue Vorlage erstellen</h3>
                            <div className="space-y-3">
                                <label className="block text-sm font-medium text-[var(--muted)]">Titel der Vorlage</label>
                                <input
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    placeholder="Mein Training..."
                                    className={`w-full rounded-3xl px-3 py-3 text-base bg-[var(--surface2)] border ${attemptedSave && !newTitle.trim() ? "border-red-500" : "border-[var(--border)]"} text-[var(--text)] outline-none focus:ring-1 focus:ring-[var(--primary)]`}
                                />
                                {attemptedSave && !newTitle.trim() && <p className="text-sm text-red-500">Bitte gib einen Titel ein.</p>}
                            </div>
                            <div className="space-y-3">
                                <label className="block text-sm font-medium text-[var(--muted)]">Sportart</label>
                                <select
                                    value={newSportType}
                                    onChange={(e) => setNewSportType(e.target.value as TrainingType)}
                                    className="w-full rounded-3xl px-3 py-3 text-base bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] outline-none focus:ring-1 focus:ring-[var(--primary)] appearance-none"
                                >
                                    <option value="gym">Gym</option>
                                    <option value="laufen">Laufen</option>
                                    <option value="radfahren">Radfahren</option>
                                    <option value="custom">Custom</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-3 pt-4">
                                <AppButton onClick={closeCreate} variant="ghost" fullWidth>
                                    Abbrechen
                                </AppButton>
                                <AppButton
                                    onClick={handleSaveTemplate}
                                    variant="primary"
                                    fullWidth
                                    className="!bg-[#007AFF] !text-white !font-semibold !rounded-3xl hover:!brightness-110 active:!scale-95 transition-all"
                                >
                                    Speichern
                                </AppButton>
                            </div>
                        </AppCard>
                    </div>
                )}

                {templateToDelete && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={() => setTemplateToDelete(null)}>
                        <div className="bg-[#1c1c1e]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                            <h3 className="text-xl font-semibold text-white">Vorlage löschen?</h3>
                            <p className="text-[var(--muted)]">Möchtest du diese Vorlage wirklich löschen? Dieser Vorgang kann nicht rückgängig gemacht werden.</p>
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setTemplateToDelete(null)}
                                    className="flex-1 px-4 py-3 rounded-3xl bg-white/5 hover:bg-white/10 text-white font-medium transition-colors"
                                >
                                    Abbrechen
                                </button>
                                <button
                                    onClick={handleDeleteTemplate}
                                    className="flex-1 px-4 py-3 rounded-3xl bg-red-500/20 hover:bg-red-500/30 text-red-500 font-medium transition-colors"
                                >
                                    Löschen
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}