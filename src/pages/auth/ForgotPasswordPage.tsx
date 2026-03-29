// src/pages/auth/ForgotPasswordPage.tsx
import React, { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "../../hooks/useAuth.ts";
import { useI18n } from "../../i18n/useI18n";

interface ForgotPasswordPageProps {
  onGoBackToLogin: () => void;
}

const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({
  onGoBackToLogin,
}) => {
  const { requestPasswordReset } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError(null);
    const result = await requestPasswordReset(email.trim());
    setSubmitting(false);
    if (!result.ok && result.error) {
      setError(result.error);
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-screen px-6 gap-5"
        style={{ backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}
      >
        <div className="w-16 h-16 rounded-full bg-blue-500/15 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M22 6c0-1.1-.9-2-2-2H4C2.9 4 2 4.9 2 6v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6zM20 8l-8 5-8-5V6l8 5 8-5v2z" fill="#3b82f6" />
          </svg>
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">{t("auth.forgot.title")}</h2>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {t("auth.forgot.sent")}
          </p>
        </div>
        <button
          type="button"
          onClick={onGoBackToLogin}
          className="w-full rounded-2xl px-4 py-4 text-base font-semibold transition-all active:scale-[0.98]"
          style={{ backgroundColor: "#007AFF", color: "#FFFFFF" }}
        >
          {t("auth.forgot.back")}
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}
    >
      {/* Header */}
      <div
        className="flex items-center px-4 pb-4"
        style={{ paddingTop: "max(3.5rem, env(safe-area-inset-top, 3.5rem))" }}
      >
        <button
          type="button"
          onClick={onGoBackToLogin}
          className="flex items-center gap-1 text-sm font-medium active:opacity-60 transition-opacity"
          style={{ color: "#007AFF" }}
        >
          <ChevronLeft size={20} />
          {t("auth.forgot.back")}
        </button>
      </div>

      {/* Title */}
      <div className="px-6 pb-8 pt-2">
        <h1 className="text-3xl font-bold tracking-tight mb-1">
          {t("auth.forgot.title")}
        </h1>
        <p className="text-base" style={{ color: "var(--text-secondary)" }}>
          {t("auth.forgot.subtitle")}
        </p>
      </div>

      {/* Form */}
      <div className="px-5 space-y-3">
        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div
            className="flex items-center rounded-2xl px-4 border"
            style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}
          >
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setEmail((v) => v.trim())}
              className="flex-1 py-4 text-base bg-transparent outline-none"
              style={{ color: "var(--text-color)" }}
              placeholder={t("auth.email")}
              type="email"
              autoCapitalize="none"
              autoCorrect="off"
              inputMode="email"
              autoComplete="email"
              autoFocus
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !email.trim()}
            className="w-full rounded-2xl px-4 py-4 text-base font-semibold transition-all active:scale-[0.98]"
            style={{
              backgroundColor: "#007AFF",
              color: "#FFFFFF",
              opacity: submitting || !email.trim() ? 0.6 : 1,
            }}
          >
            {submitting ? t("auth.forgot.loading") : t("auth.forgot.submit")}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
