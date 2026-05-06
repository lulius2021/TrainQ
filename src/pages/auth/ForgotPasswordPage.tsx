// src/pages/auth/ForgotPasswordPage.tsx
import React, { useState } from "react";
import { AuthInput } from "../../components/auth/AuthInput.tsx";
import { AuthButton } from "../../components/auth/AuthButton.tsx";
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
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setError(t("auth.forgot.emptyEmail") || "Bitte E-Mail eingeben.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await requestPasswordReset(trimmed);
      if (!result.ok && result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
      }
    } catch (e: any) {
      setError(e?.message ?? t("auth.forgot.error") || "Ein Fehler ist aufgetreten.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#05060A] text-white px-4">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold mb-1">{t("auth.forgot.title")}</h1>
          <p className="text-sm text-gray-400">
            {t("auth.forgot.subtitle")}
          </p>
        </div>

        {success ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {t("auth.forgot.sent")}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <AuthInput
              label={t("auth.email")}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            <AuthButton type="submit" disabled={submitting}>
              {submitting ? t("auth.forgot.loading") : t("auth.forgot.submit")}
            </AuthButton>
          </form>
        )}

        <div className="text-xs text-center text-gray-400">
          <button
            type="button"
            onClick={onGoBackToLogin}
            className="text-blue-400 hover:text-blue-300"
          >
            {t("auth.forgot.back")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
