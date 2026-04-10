// src/components/ai/AICoachCard.tsx
// TrainQ AI Coach Widget – Chat-Interface für personalisiertes KI-Coaching

import React, { useState, useRef, useEffect } from "react";
import { Sparkles, Send, RefreshCw, X, ChevronDown, ChevronUp } from "lucide-react";
import { useAICoach } from "../../hooks/useAICoach";
import type { AICoachUserContext, AICoachAction } from "../../services/AICoachService";
import { useI18n } from "../../i18n/useI18n";

// ---------- Types ----------

interface AICoachCardProps {
  userContext: AICoachUserContext;
}

type QuickAction = {
  labelKey: string;
  action: AICoachAction;
};

const QUICK_ACTIONS: QuickAction[] = [
  { labelKey: "aiCoach.action.recommendation", action: "workout_recommendation" },
  { labelKey: "aiCoach.action.motivation",     action: "generate_motivation" },
];

// ---------- Component ----------

export default function AICoachCard({ userContext }: AICoachCardProps) {
  const { t } = useI18n();
  const { response, loading, error, fetchRecommendation, fetchMotivation, ask, clearError } =
    useAICoach();

  const [question, setQuestion] = useState("");
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-expand when a response arrives
  useEffect(() => {
    if (response) setExpanded(true);
  }, [response]);

  function handleQuickAction(action: AICoachAction) {
    clearError();
    if (action === "workout_recommendation") {
      fetchRecommendation(userContext);
    } else if (action === "generate_motivation") {
      fetchMotivation(userContext);
    }
    setExpanded(true);
  }

  function handleSend() {
    const trimmed = question.trim();
    if (!trimmed || loading) return;
    clearError();
    ask(userContext, trimmed);
    setQuestion("");
    setExpanded(true);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSend();
  }

  const errorKey = (() => {
    if (!error) return null;
    switch (error.code) {
      case "rate_limit":    return "aiCoach.error.rateLimit";
      case "unauthorized":  return "aiCoach.error.unauthorized";
      case "not_configured":return "aiCoach.error.notConfigured";
      case "network":       return "aiCoach.error.network";
      default:              return "aiCoach.error.unknown";
    }
  })();

  return (
    <div
      className="rounded-[24px] border border-[var(--border-color)] bg-[var(--card-bg)] overflow-hidden"
      style={{ transition: "all 0.3s ease" }}
    >
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[rgba(0,122,255,0.15)] flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-[#007AFF]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)] leading-tight">
              {t("aiCoach.title")}
            </p>
            <p className="text-xs text-[var(--text-secondary)] leading-tight">
              {t("aiCoach.subtitle")}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-[var(--text-secondary)]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
        )}
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          {/* Quick Actions */}
          <div className="flex gap-2 flex-wrap">
            {QUICK_ACTIONS.map((qa) => (
              <button
                key={qa.action}
                onClick={() => handleQuickAction(qa.action)}
                disabled={loading}
                className="px-3 py-1.5 rounded-full text-xs font-medium border border-[var(--border-color)] text-[var(--text-primary)] bg-[var(--surface-bg)] active:opacity-70 disabled:opacity-40 transition-opacity"
              >
                {t(qa.labelKey)}
              </button>
            ))}
          </div>

          {/* Response area */}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <RefreshCw className="w-4 h-4 animate-spin text-[#007AFF]" />
              <span>{t("aiCoach.loading")}</span>
            </div>
          )}

          {error && errorKey && (
            <div className="flex items-start gap-2 rounded-[12px] bg-[rgba(255,59,48,0.1)] border border-[rgba(255,59,48,0.3)] p-3">
              <p className="text-xs text-red-400 flex-1">{t(errorKey)}</p>
              <button onClick={clearError} className="shrink-0">
                <X className="w-3.5 h-3.5 text-red-400" />
              </button>
            </div>
          )}

          {response && !loading && (
            <div className="rounded-[16px] bg-[rgba(0,122,255,0.06)] border border-[rgba(0,122,255,0.18)] p-3">
              <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
                {response.text}
              </p>
            </div>
          )}

          {/* Chat input */}
          <div className="flex items-center gap-2 rounded-[14px] border border-[var(--border-color)] bg-[var(--surface-bg)] px-3 py-2">
            <input
              ref={inputRef}
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("aiCoach.inputPlaceholder")}
              maxLength={500}
              disabled={loading}
              className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] outline-none disabled:opacity-40"
            />
            <button
              onClick={handleSend}
              disabled={loading || !question.trim()}
              className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-[#007AFF] disabled:opacity-40 active:scale-95 transition-transform"
              aria-label={t("aiCoach.send")}
            >
              <Send className="w-3.5 h-3.5 text-white" />
            </button>
          </div>

          <p className="text-[10px] text-[var(--text-secondary)] text-center">
            {t("aiCoach.disclaimer")}
          </p>
        </div>
      )}
    </div>
  );
}
