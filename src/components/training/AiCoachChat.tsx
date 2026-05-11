// src/components/training/AiCoachChat.tsx
// Extracted from TrainingsplanPage — KI Coach Chat with Supabase persistence

import React, { useState, useEffect, useCallback } from "react";
import { useI18n } from "../../i18n/useI18n";
import { getSupabaseClient } from "../../lib/supabaseClient";
import { getActiveIsPro, getActiveUserId } from "../../utils/session";
import { getScopedItem, setScopedItem } from "../../utils/scopedStorage";
import { loadTrainingTemplates, saveTrainingTemplates, buildTrainingTemplateSignature } from "../../services/trainingTemplatesService";
import { upsertTrainingPlanTemplate } from "../../services/trainingPlanTemplatesService";
import { writeLiveSeedForEventOrKey } from "../../utils/liveTrainingSeed";
import { loadWorkoutHistory, type WorkoutHistoryEntry } from "../../utils/workoutHistory";
import { BottomSheet } from "../common/BottomSheet";
import { X, Lock } from "lucide-react";
import { IconDumbbellFill } from "../../assets/icons/IconDumbbellFill";
import type { CalendarEvent } from "../../types/training";
import type { SportType } from "../../types/training";
import type { TrainingPlanTemplate, TrainingTemplate as StoredTrainingTemplate, TrainingTemplateExercise } from "../../types/trainingTemplates";

// ── Constants ──

const PROFILE_STORAGE_KEY = "trainq_ai_coach_profile";

type CoachProfile = {
  goal?: string;
  level?: string;
  daysPerWeek?: number;
  equipment?: string;
  durationWeeks?: number;
};

function loadCoachProfile(): CoachProfile | null {
  try {
    const raw = getScopedItem(PROFILE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveCoachProfile(profile: CoachProfile): void {
  try { setScopedItem(PROFILE_STORAGE_KEY, JSON.stringify(profile)); } catch {}
}

function extractProfileFromChat(messages: ChatMessage[]): CoachProfile | null {
  // Parse the conversation to extract user answers
  const userMsgs = messages.filter((m) => m.role === "user").map((m) => (m.content ?? "").toLowerCase());
  if (userMsgs.length < 2) return null;

  const profile: CoachProfile = {};
  const fullText = userMsgs.join(" ");

  // Goal (first user message is usually the goal)
  if (userMsgs[0]) profile.goal = messages.find((m) => m.role === "user")?.content;

  // Level
  if (fullText.includes("anfänger") || fullText.includes("beginner")) profile.level = "Anfänger";
  else if (fullText.includes("fortgeschritten") || fullText.includes("intermediate")) profile.level = "Fortgeschritten";
  else if (fullText.includes("profi") || fullText.includes("advanced") || fullText.includes("erfahren")) profile.level = "Profi";

  // Equipment
  if (fullText.includes("gym") || fullText.includes("studio") || fullText.includes("fitnessstudio")) profile.equipment = "Gym";
  else if (fullText.includes("home") || fullText.includes("zuhause")) profile.equipment = "Home";
  else if (fullText.includes("minimal") || fullText.includes("wenig")) profile.equipment = "Minimal";

  // Days per week
  const daysMatch = fullText.match(/(\d)\s*(?:tage|mal|x|days)/);
  if (daysMatch) profile.daysPerWeek = parseInt(daysMatch[1]);

  return (profile.goal || profile.level || profile.equipment) ? profile : null;
}

function buildWorkoutHistoryContext(): string {
  try {
    const history = loadWorkoutHistory();
    if (!history.length) return "";

    // Last 10 workouts, summarized
    const recent = history.slice(0, 10);

    // Extract best weights per exercise (across all recent workouts)
    const exerciseMap = new Map<string, { maxWeight: number; maxReps: number; count: number }>();
    for (const w of recent) {
      for (const ex of w.exercises || []) {
        const key = ex.name.toLowerCase();
        const existing = exerciseMap.get(key) || { maxWeight: 0, maxReps: 0, count: 0 };
        for (const s of ex.sets || []) {
          if (s.weight > existing.maxWeight) existing.maxWeight = s.weight;
          if (s.reps > existing.maxReps) existing.maxReps = s.reps;
        }
        existing.count++;
        exerciseMap.set(key, existing);
      }
    }

    // Top exercises by frequency
    const topExercises = [...exerciseMap.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 15)
      .map(([name, data]) => `${name}: ${data.maxWeight}kg x ${data.maxReps} (${data.count}x trainiert)`)
      .join("\n");

    // Workout frequency & sport breakdown
    const sports = recent.reduce<Record<string, number>>((acc, w) => {
      const s = w.sport || "gym";
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});
    const sportSummary = Object.entries(sports).map(([s, c]) => `${s}: ${c}x`).join(", ");

    // Average duration
    const avgDuration = Math.round(recent.reduce((sum, w) => sum + (w.durationSec || 0), 0) / recent.length / 60);

    // Last workout date
    const lastDate = recent[0]?.startedAt ? new Date(recent[0].startedAt).toLocaleDateString("de-DE") : "unbekannt";

    return `\n\nLetzte Trainings des Users (${recent.length} Workouts):
- Letztes Training: ${lastDate}
- Sportarten: ${sportSummary}
- Ø Dauer: ${avgDuration} min
- Top-Übungen mit Gewichten:\n${topExercises}

Nutze diese Daten um realistische Gewichte und passende Übungen vorzuschlagen. Wenn der User eine Übung schon macht, verwende sein aktuelles Gewichtsniveau.`;
  } catch {
    return "";
  }
}

function buildSystemPrompt(profile: CoachProfile | null): string {
  const profileContext = profile
    ? `\n\nBekanntes Profil des Users:${profile.goal ? `\n- Ziel: ${profile.goal}` : ""}${profile.level ? `\n- Level: ${profile.level}` : ""}${profile.daysPerWeek ? `\n- Tage/Woche: ${profile.daysPerWeek}` : ""}${profile.equipment ? `\n- Equipment: ${profile.equipment}` : ""}
Du kennst diesen User bereits. Frage NUR nach Infos die du noch nicht hast oder die sich geändert haben könnten. Frage immer nach der gewünschten Plandauer.`
    : "";

  const historyContext = buildWorkoutHistoryContext();

  return `Du bist ein Trainingscoach. Antworte auf Deutsch, kurz (1-2 Sätze). Duze.
WICHTIG: Erwähne NIEMALS "User", "Profil", "Daten" oder "System". Sprich direkt mit der Person.

${profile ? `Du weißt bereits: ${profile.goal ? `Ziel=${profile.goal}` : ""}${profile.level ? `, Level=${profile.level}` : ""}${profile.equipment ? `, Equipment=${profile.equipment}` : ""}${profile.daysPerWeek ? `, ${profile.daysPerWeek}x/Woche` : ""}.
Frag: "Wie viele Wochen soll der neue Plan gehen?"` : `Frag nacheinander (eine Frage pro Nachricht):
1) Was ist dein Ziel?
2) Wie erfahren bist du?
3) Wie oft pro Woche?
4) Wo trainierst du?
5) Wie viele Wochen?`}

Wenn du alles weißt, antworte NUR mit JSON (kein Text davor oder danach):
{"planName":"Name","durationWeeks":4,"days":[{"dayIndex":0,"dayName":"Montag","workoutName":"Push","trainingType":"gym","exercises":[{"name":"Bankdrücken","sets":[{"reps":10,"weight":60},{"reps":8,"weight":65}]}]}]}

JSON-Regeln:
- dayIndex: 0=Mo,1=Di,2=Mi,3=Do,4=Fr,5=Sa,6=So
- Gewichte basierend auf den ECHTEN Daten des Users (falls vorhanden)
- Mind. 4 Übungen pro Tag, mind. 3 Sätze pro Übung
- Ruhetage NICHT in days
- trainingType: "gym", "laufen" oder "radfahren"
- Valides JSON${profileContext}${historyContext}`;
}

type ChatMessage = { role: "user" | "assistant"; content: string };
type SupaChat = { id: string; title: string; messages: ChatMessage[]; plan_imported: boolean; updated_at: string };
type TrainingSportType = Exclude<"Gym" | "Laufen" | "Radfahren" | "Custom", "Ruhetag">;

// ── Helpers ──

function getNextMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 1 : 8 - day;
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}

function extractJSON(text: string): any | null {
  try { return JSON.parse(text.trim()); } catch {}
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") depth--;
    if (depth === 0) {
      try {
        const parsed = JSON.parse(text.slice(start, i + 1));
        if (parsed?.days) return parsed;
      } catch {}
      break;
    }
  }
  return null;
}

// ── Sub-Components ──

const ProGateOverlay: React.FC<{ t: (key: string, fallback?: string) => string }> = ({ t }) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: "rgba(41,82,227,0.12)" }}>
      <Lock size={24} style={{ color: "#2952E3" }} />
    </div>
    <p className="text-[17px] font-bold mb-2" style={{ color: "var(--text-color)" }}>
      {t("training.plan.aiCoachTitle")}
    </p>
    <p className="text-[13px] max-w-[260px]" style={{ color: "var(--text-secondary)" }}>
      {t("training.plan.aiProOnly", "KI Coach ist ein Pro-Feature. Upgrade um personalisierte Trainingspläne zu erhalten.")}
    </p>
  </div>
);

const TrainQLogo: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <img src="/logo.png" alt="TrainQ" width={size} height={size} className="rounded-lg" style={{ objectFit: "cover" }} />
);

const ChatBubble: React.FC<{ msg: ChatMessage }> = ({ msg }) => (
  <div className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
    {msg.role === "assistant" && (
      <div className="w-7 h-7 rounded-lg shrink-0 mt-1 overflow-hidden">
        <TrainQLogo size={28} />
      </div>
    )}
    <div
      className="max-w-[78%] rounded-2xl px-4 py-3 text-[14px] leading-relaxed whitespace-pre-wrap"
      style={{
        backgroundColor: msg.role === "user" ? "#2952E3" : "var(--card-bg)",
        color: msg.role === "user" ? "#fff" : "var(--text-color)",
        border: msg.role === "assistant" ? "1px solid var(--border-color)" : "none",
      }}
    >
      {msg.content}
    </div>
  </div>
);

const LoadingDots: React.FC = () => (
  <div className="flex gap-2 justify-start">
    <div className="w-7 h-7 rounded-lg shrink-0 mt-1 overflow-hidden">
      <TrainQLogo size={28} />
    </div>
    <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
      <span className="inline-flex gap-1 text-lg">
        <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
        <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
        <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
      </span>
    </div>
  </div>
);

const PlanPreviewCard: React.FC<{
  plan: any;
  onImport: () => void;
  onDiscard: () => void;
  t: (key: string, opts?: any) => string;
}> = ({ plan, onImport, onDiscard, t }) => {
  const dayLabels = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-color)", backgroundColor: "var(--card-bg)" }}>
      <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(41,82,227,0.12)" }}>
            <IconDumbbellFill width={14} height={8} style={{ color: "#2952E3" }} />
          </div>
          <div>
            <p className="text-[14px] font-bold" style={{ color: "var(--text-color)" }}>{plan.planName}</p>
            <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{t("training.plan.aiWeeksAndDays", { weeks: plan.durationWeeks, days: plan.days?.length })}</p>
          </div>
        </div>
      </div>
      <div className="px-4 py-2 space-y-1.5">
        {(plan.days || []).map((day: any, i: number) => {
          const exNames = (day.exercises || []).map((e: any) => e.name).slice(0, 3);
          return (
            <div key={i} className="flex items-start gap-2 py-1" style={{ borderBottom: i < plan.days.length - 1 ? "1px solid var(--border-color)" : "none" }}>
              <span className="text-[12px] font-bold w-6 shrink-0 tabular-nums pt-0.5" style={{ color: "var(--text-secondary)" }}>{dayLabels[day.dayIndex] || "?"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold" style={{ color: "var(--text-color)" }}>{day.workoutName}</p>
                <p className="text-[11px] truncate" style={{ color: "var(--text-secondary)" }}>
                  {exNames.join(", ")}{(day.exercises || []).length > 3 ? ` +${(day.exercises || []).length - 3}` : ""}
                </p>
              </div>
              <span className="text-[11px] font-medium shrink-0 pt-0.5" style={{ color: "var(--text-secondary)" }}>{t("training.plan.aiExercisesShort", { count: (day.exercises || []).length })}</span>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 px-4 py-3" style={{ borderTop: "1px solid var(--border-color)" }}>
        <button onClick={onDiscard} className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold active:scale-[0.97] transition-transform" style={{ backgroundColor: "var(--bg-color)", color: "var(--text-secondary)" }}>
          {t("training.plan.aiDiscard")}
        </button>
        <button onClick={onImport} className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white active:scale-[0.97] transition-transform" style={{ backgroundColor: "#2952E3" }}>
          {t("training.plan.aiImportCalendar")}
        </button>
      </div>
    </div>
  );
};

const ChatHistorySheet: React.FC<{
  open: boolean;
  onClose: () => void;
  loading: boolean;
  chats: SupaChat[];
  activeChatId: string | null;
  onOpen: (chat: SupaChat) => void;
  onDelete: (id: string) => void;
  t: (key: string, opts?: any) => string;
  lang: string;
}> = ({ open, onClose, loading, chats, activeChatId, onOpen, onDelete, t, lang }) => (
  <BottomSheet open={open} onClose={onClose} height="70dvh" zIndex={300}
    header={
      <div className="flex items-center justify-between px-5 pb-2">
        <h3 className="text-[15px] font-bold" style={{ color: "var(--text-color)" }}>{t("training.plan.aiHistory")}</h3>
        <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--input-bg)" }}>
          <X size={16} style={{ color: "var(--text-secondary)" }} />
        </button>
      </div>
    }
  >
    <div className="px-5 pb-6 space-y-2">
      {loading && <p className="text-sm text-center py-8" style={{ color: "var(--text-secondary)" }}>{t("training.plan.aiHistoryLoading")}</p>}
      {!loading && chats.length === 0 && (
        <p className="text-sm text-center py-8" style={{ color: "var(--text-secondary)" }}>{t("training.plan.aiHistoryEmpty")}</p>
      )}
      {chats.map((chat) => (
        <div key={chat.id} className="flex items-center gap-3 rounded-2xl p-3" style={{ backgroundColor: "var(--card-bg)", border: activeChatId === chat.id ? "1.5px solid #007AFF" : "1px solid var(--border-color)" }}>
          <button onClick={() => onOpen(chat)} className="flex-1 text-left min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-semibold truncate" style={{ color: "var(--text-color)" }}>{chat.title}</span>
              {chat.plan_imported && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "rgba(52,199,89,0.12)", color: "#34C759" }}>Plan</span>}
            </div>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {new Date(chat.updated_at).toLocaleDateString(lang === "de" ? "de-DE" : "en-US", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              {" · "}{t("training.plan.aiHistoryMessages", { count: (chat.messages || []).length })}
            </p>
          </button>
          <button onClick={() => onDelete(chat.id)} className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 active:scale-[0.9]" style={{ color: "var(--text-secondary)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
          </button>
        </div>
      ))}
    </div>
  </BottomSheet>
);

// ── Hook: useChatPersistence ──

function useChatPersistence(userId: string | null) {
  const [chatId, setChatId] = useState<string | null>(null);
  const [chatList, setChatList] = useState<SupaChat[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const getClient = () => getSupabaseClient();

  const saveChat = useCallback(async (msgs: ChatMessage[], planDone = false) => {
    const sb = getClient();
    if (!sb || !userId) return;
    try {
      const title = msgs.find((m) => m.role === "user")?.content?.slice(0, 60) || "Neuer Chat";
      if (chatId) {
        const { error } = await sb.from("ai_coach_chats").update({ messages: msgs, title, plan_imported: planDone, updated_at: new Date().toISOString() }).eq("id", chatId).eq("user_id", userId);
        if (error && import.meta.env.DEV) console.error("[AI Coach] Save failed:", error.message);
      } else {
        const { data, error } = await sb.from("ai_coach_chats").insert({ user_id: userId, messages: msgs, title, plan_imported: planDone }).select("id").single();
        if (error && import.meta.env.DEV) console.error("[AI Coach] Insert failed:", error.message);
        if (data?.id) setChatId(data.id);
      }
    } catch (e) {
      if (import.meta.env.DEV) console.error("[AI Coach] saveChat error:", e);
    }
  }, [userId, chatId]);

  const loadHistory = async () => {
    const sb = getClient();
    if (!sb || !userId) return;
    setHistoryLoading(true);
    try {
      const { data, error } = await sb.from("ai_coach_chats").select("id,title,messages,plan_imported,updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(50);
      if (error) throw error;
      setChatList(data || []);
    } catch (e) {
      if (import.meta.env.DEV) console.error("[AI Coach] loadHistory error:", e);
      setChatList([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const deleteChat = async (id: string) => {
    const sb = getClient();
    if (!sb || !userId) return;
    await sb.from("ai_coach_chats").delete().eq("id", id).eq("user_id", userId);
    setChatList((prev) => prev.filter((c) => c.id !== id));
    if (chatId === id) setChatId(null);
  };

  return { chatId, setChatId, chatList, setChatList, historyLoading, saveChat, loadHistory, deleteChat };
}

// ── Main Component ──

interface AiCoachChatProps {
  userId: string | null;
  onPlanImported: () => void;
}

const AiCoachChat: React.FC<AiCoachChatProps> = ({ userId, onPlanImported }) => {
  const { t, lang } = useI18n();
  const isPro = getActiveIsPro();

  // Pro gate
  if (!isPro) return <ProGateOverlay t={t} />;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [imported, setImported] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<any>(null);
  const [showOverlapConfirm, setShowOverlapConfirm] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);
  const [coachProfile] = useState<CoachProfile | null>(() => loadCoachProfile());

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const persistence = useChatPersistence(userId);

  // Keyboard
  useEffect(() => {
    let showH: any, hideH: any;
    import("@capacitor/keyboard").then(({ Keyboard }) => {
      showH = Keyboard.addListener("keyboardWillShow", (info) => { setKbHeight(info.keyboardHeight); scrollToBottom(); });
      hideH = Keyboard.addListener("keyboardWillHide", () => setKbHeight(0));
    }).catch(() => {});
    return () => { showH?.then?.((h: any) => h.remove()); hideH?.then?.((h: any) => h.remove()); };
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current?.scrollHeight || 0, behavior: "smooth" }), 50);
  };

  const resizeTextarea = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  };

  const openChat = (chat: SupaChat) => {
    persistence.setChatId(chat.id);
    setMessages(chat.messages);
    setImported(chat.plan_imported);
    setHistoryOpen(false);
    setTimeout(scrollToBottom, 100);
  };

  const startNewChat = () => {
    persistence.setChatId(null);
    setMessages([]);
    setImported(false);
    setPendingPlan(null);
    setInput("");
    setHistoryOpen(false);
  };

  // Plan import — uses getActiveUserId() to match MainAppShell's storage scope
  const doImport = useCallback((plan: any, replaceOverlap: boolean) => {
    const uid = getActiveUserId() || userId;
    if (!plan?.days?.length) {
      if (import.meta.env.DEV) console.error("[AI Coach] Import aborted: no days");
      return;
    }
    if (import.meta.env.DEV) console.log("[AI Coach] doImport called, uid:", uid, "days:", plan.days.length, "replace:", replaceOverlap);

    const now = new Date().toISOString();
    const startDate = getNextMonday();
    const planId = crypto.randomUUID();
    const durationWeeks = plan.durationWeeks || 4;

    // 1. Templates
    const existingTemplates = uid ? loadTrainingTemplates(uid) : [];
    const newTemplates = [...existingTemplates];

    const planDays = plan.days.map((day: any, idx: number) => {
      const templateId = crypto.randomUUID();
      const exercises: TrainingTemplateExercise[] = (day.exercises || []).map((ex: any) => ({
        id: crypto.randomUUID(), name: ex.name,
        sets: (ex.sets || []).map((s: any) => ({ reps: s.reps ?? 10, weight: s.weight ?? 0 })),
      }));
      const template: StoredTrainingTemplate = {
        id: templateId, userId: uid || "unknown", name: day.workoutName || `Tag ${idx + 1}`,
        sportType: (day.trainingType as SportType) || "Gym", exercises,
        sourcePlanId: planId, sourceDayIndex: day.dayIndex ?? idx,
        signature: buildTrainingTemplateSignature(exercises), createdAt: now, updatedAt: now,
      };
      newTemplates.push(template);
      return { dayIndex: day.dayIndex ?? idx, title: day.workoutName || day.dayName || `Tag ${idx + 1}`, trainingTemplateId: templateId, trainingSnapshot: { name: template.name, sportType: template.sportType, exercises } };
    });

    if (uid) saveTrainingTemplates(uid, newTemplates);

    // 2. Plan template
    if (uid) upsertTrainingPlanTemplate(uid, { id: planId, userId: uid, name: plan.planName || "KI Trainingsplan", kind: "weekly", startDate, durationWeeks, days: planDays, createdAt: now, updatedAt: now } as TrainingPlanTemplate);

    // 3. Build new calendar events
    const [sY, sM, sD] = startDate.split("-").map(Number);
    const startObj = new Date(sY, sM - 1, sD);
    const endObj = new Date(startObj.getFullYear(), startObj.getMonth(), startObj.getDate() + durationWeeks * 7 - 1);
    const endDateISO = `${endObj.getFullYear()}-${String(endObj.getMonth() + 1).padStart(2, "0")}-${String(endObj.getDate()).padStart(2, "0")}`;

    const newCalendarEvents: CalendarEvent[] = [];

    for (let week = 0; week < durationWeeks; week++) {
      for (const day of plan.days) {
        const dayIdx = day.dayIndex ?? 0;
        const ed = new Date(startObj.getFullYear(), startObj.getMonth(), startObj.getDate() + week * 7 + dayIdx);
        const dateISO = `${ed.getFullYear()}-${String(ed.getMonth() + 1).padStart(2, "0")}-${String(ed.getDate()).padStart(2, "0")}`;
        const liveEx = (day.exercises || []).map((ex: any) => ({
          id: crypto.randomUUID(), name: ex.name,
          sets: (ex.sets || []).map((s: any) => ({ id: crypto.randomUUID(), reps: s.reps ?? 10, weight: s.weight ?? 0, completed: false })),
        }));

        newCalendarEvents.push({
          id: crypto.randomUUID(),
          title: day.workoutName || "Training",
          date: dateISO,
          startTime: "",
          endTime: "",
          type: "training",
          templateId: planId,
          trainingType: day.trainingType === "laufen" ? "laufen" : day.trainingType === "radfahren" ? "radfahren" : "gym",
          trainingStatus: "open",
          workoutData: { exercises: liveEx },
        } as CalendarEvent);

        writeLiveSeedForEventOrKey({
          dateISO,
          title: day.workoutName || "Training",
          seed: {
            title: day.workoutName || "Training",
            sport: (day.trainingType === "laufen" ? "Laufen" : day.trainingType === "radfahren" ? "Radfahren" : "Gym") as TrainingSportType,
            isCardio: day.trainingType === "laufen" || day.trainingType === "radfahren",
            exercises: liveEx,
          },
        });
      }
    }

    // 4. Merge with existing events
    // Try scoped key first (logged-in user), then try all known storage keys
    const storageKey = "trainq_calendar_events";
    let rawCalendar = getScopedItem(storageKey, uid);
    if (!rawCalendar) rawCalendar = getScopedItem(storageKey);
    if (!rawCalendar) rawCalendar = localStorage.getItem(storageKey);

    let existingEvents: CalendarEvent[] = [];
    try { existingEvents = rawCalendar ? JSON.parse(rawCalendar) : []; } catch { existingEvents = []; }

    if (replaceOverlap) {
      existingEvents = existingEvents.filter((e) => {
        if ((e as any).type !== "training") return true;
        if (!e.date) return true;
        return e.date < startDate || e.date > endDateISO;
      });
    }

    const mergedEvents = [...existingEvents, ...newCalendarEvents];

    // Write to BOTH scoped and unscoped to ensure MainAppShell picks it up
    const json = JSON.stringify(mergedEvents);
    if (uid) setScopedItem(storageKey, json, uid);
    setScopedItem(storageKey, json);
    window.dispatchEvent(new Event("trainq:update_events"));

    if (import.meta.env.DEV) console.log(`[AI Coach] Imported ${newCalendarEvents.length} events, total: ${mergedEvents.length}`);

    setImported(true);
    setPendingPlan(null);
    setShowOverlapConfirm(false);

    // Save user profile from chat for future sessions
    const extractedProfile = extractProfileFromChat(messages);
    if (extractedProfile) saveCoachProfile({ ...coachProfile, ...extractedProfile, durationWeeks });

    const totalWorkouts = plan.days.length * durationWeeks;
    const successMsg: ChatMessage = { role: "assistant", content: t("training.plan.aiPlanImported", { weeks: durationWeeks, workouts: totalWorkouts }) };
    setMessages((prev) => {
      const next = [...prev, successMsg];
      persistence.saveChat(next, true);
      return next;
    });
    scrollToBottom();
    setTimeout(() => onPlanImported(), 2000);
  }, [userId, onPlanImported, persistence.saveChat, t, messages, coachProfile]);

  // Check for overlap before importing
  const importPlan = useCallback((plan: any) => {
    if (!plan?.days?.length) return;
    const startDate = getNextMonday();
    const durationWeeks = plan.durationWeeks || 4;
    const [sY, sM, sD] = startDate.split("-").map(Number);
    const endObj = new Date(sY, sM - 1, sD + durationWeeks * 7 - 1);
    const endDateISO = `${endObj.getFullYear()}-${String(endObj.getMonth() + 1).padStart(2, "0")}-${String(endObj.getDate()).padStart(2, "0")}`;

    // Check if there are existing training events in the date range
    const rawCalendar = getScopedItem("trainq_calendar_events");
    let existingEvents: CalendarEvent[] = [];
    try { existingEvents = rawCalendar ? JSON.parse(rawCalendar) : []; } catch {}

    const overlapping = existingEvents.filter((e) =>
      (e as any).type === "training" && e.date && e.date >= startDate && e.date <= endDateISO && (e as any).trainingStatus === "open"
    );

    if (overlapping.length > 0) {
      setShowOverlapConfirm(true);
    } else {
      doImport(plan, false);
    }
  }, [doImport]);

  // Send message
  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading || imported) return;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      setMessages((prev) => [...prev, { role: "assistant", content: t("training.plan.aiErrorNoConnection") }]);
      return;
    }

    const userMsg: ChatMessage = { role: "user", content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setLoading(true);
    scrollToBottom();

    try {
      const fnUrl = `${supabaseUrl}/functions/v1/groq-chat`;
      const models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
      const systemPrompt = buildSystemPrompt(coachProfile);
      const apiMessages = nextMessages.map((m) => ({ role: m.role, content: m.content }));

      let reply = "";
      for (const model of models) {
        const res = await fetch(fnUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": supabaseKey },
          body: JSON.stringify({ model, max_tokens: 4096, system: systemPrompt, messages: apiMessages }),
        });
        if (res.status === 429) {
          if (import.meta.env.DEV) console.warn(`[AI Coach] ${model} rate limited, trying fallback...`);
          continue; // try next model
        }
        if (!res.ok) {
          const errBody = await res.text().catch(() => "");
          throw new Error(`${res.status}: ${errBody.slice(0, 100)}`);
        }
        const data = await res.json();
        reply = data?.choices?.[0]?.message?.content || "";
        break;
      }
      if (!reply) throw new Error("Bitte in 1 Minute erneut versuchen.");
      reply = reply || t("training.plan.aiErrorNoResponse");

      // Check if reply contains a plan JSON — show preview instead of raw JSON
      const plan = extractJSON(reply);
      if (plan?.days?.length) {
        setPendingPlan(plan);
        const dayLabels = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
        const previewLines = plan.days.map((d: any) => `${dayLabels[d.dayIndex] || "?"}: ${d.workoutName} (${(d.exercises || []).length})`);
        const previewText = t("training.plan.aiPlanPreview", { name: plan.planName, weeks: plan.durationWeeks }) + "\n\n" + previewLines.join("\n");
        const previewMsgs = [...nextMessages, { role: "assistant" as const, content: previewText }];
        setMessages(previewMsgs);
        persistence.saveChat(previewMsgs);
      } else {
        const withReply = [...nextMessages, { role: "assistant" as const, content: reply }];
        setMessages(withReply);
        persistence.saveChat(withReply);
      }
      scrollToBottom();
    } catch (e: any) {
      const errMsgs = [...nextMessages, { role: "assistant" as const, content: t("training.plan.aiErrorGeneric", { message: e.message || "Connection error" }) }];
      setMessages(errMsgs);
      persistence.saveChat(errMsgs);
      scrollToBottom();
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="flex flex-col" style={{ height: kbHeight > 0 ? `calc(100dvh - 125px - ${kbHeight}px)` : "calc(100dvh - 235px)", transition: "height 0.2s ease-out" }}>
      {/* Header */}
      <div className="flex items-center justify-between pb-3">
        <button onClick={startNewChat} className="flex items-center gap-1.5 text-[13px] font-semibold active:scale-[0.95] transition-transform" style={{ color: "#007AFF" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          {t("training.plan.aiNewChat")}
        </button>
        <button onClick={() => { setHistoryOpen(true); persistence.loadHistory(); }} className="w-9 h-9 rounded-full flex items-center justify-center active:scale-[0.9] transition-transform" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border-color)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pb-4 scrollbar-none" style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center pt-12 pb-8">
            <div className="w-14 h-14 rounded-2xl overflow-hidden mb-4 shadow-lg" style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>
              <TrainQLogo size={56} />
            </div>
            <p className="text-[17px] font-bold text-center" style={{ color: "var(--text-color)" }}>{t("training.plan.aiCoachTitle")}</p>
            <p className="text-[13px] text-center mt-1 max-w-[260px]" style={{ color: "var(--text-secondary)" }}>{t("training.plan.aiCoachSubtitle")}</p>
          </div>
        )}
        {messages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}
        {loading && <LoadingDots />}
        {pendingPlan && !imported && (
          <PlanPreviewCard plan={pendingPlan} onImport={() => importPlan(pendingPlan)} onDiscard={() => setPendingPlan(null)} t={t} />
        )}
      </div>

      {/* Input */}
      {!imported && (
        <div className="rounded-2xl px-3 py-2 mt-1" style={{ backgroundColor: "var(--card-bg)" }}>
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => { setInput(e.target.value); resizeTextarea(); }}
            onFocus={() => { setTimeout(() => textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 300); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={t("training.plan.aiPlaceholder")}
            disabled={loading}
            className="w-full bg-transparent outline-none resize-none text-[15px] leading-relaxed"
            style={{ color: "var(--text-color)", fontSize: "16px", maxHeight: 120 }}
          />
          <div className="flex items-center justify-end pt-1">
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="w-8 h-8 rounded-full flex items-center justify-center active:scale-[0.9] transition-transform"
              style={{ backgroundColor: input.trim() ? "#2952E3" : "var(--border-color)", color: "#fff", opacity: loading ? 0.5 : 1 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* Overlap confirmation */}
      {showOverlapConfirm && pendingPlan && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm px-6">
          <div className="w-full max-w-sm rounded-2xl p-5 space-y-4" style={{ backgroundColor: "var(--card-bg)" }}>
            <p className="text-[15px] font-bold" style={{ color: "var(--text-color)" }}>
              {t("training.plan.aiOverlapTitle", "Bestehender Plan gefunden")}
            </p>
            <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
              {t("training.plan.aiOverlapDesc", "Im Zeitraum des neuen Plans gibt es bereits geplante Trainings. Möchtest du diese ersetzen?")}
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => doImport(pendingPlan, true)}
                className="w-full py-3 rounded-xl text-[14px] font-bold text-white active:scale-[0.97] transition-transform"
                style={{ backgroundColor: "#2952E3" }}
              >
                {t("training.plan.aiOverlapReplace", "Ersetzen")}
              </button>
              <button
                onClick={() => doImport(pendingPlan, false)}
                className="w-full py-3 rounded-xl text-[14px] font-semibold active:scale-[0.97] transition-transform"
                style={{ backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}
              >
                {t("training.plan.aiOverlapKeep", "Beide behalten")}
              </button>
              <button
                onClick={() => setShowOverlapConfirm(false)}
                className="w-full py-2 text-[13px] font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                {t("training.plan.aiOverlapCancel", "Abbrechen")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      <ChatHistorySheet
        open={historyOpen} onClose={() => setHistoryOpen(false)}
        loading={persistence.historyLoading} chats={persistence.chatList}
        activeChatId={persistence.chatId} onOpen={openChat}
        onDelete={(id) => { persistence.deleteChat(id); if (persistence.chatId === id) startNewChat(); }}
        t={t} lang={lang}
      />
    </section>
  );
};

export default AiCoachChat;
