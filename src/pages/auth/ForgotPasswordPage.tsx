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
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const result = await requestPasswordReset(email);
    if (!result.ok && result.error) {
      setInfo(result.error);
      setSubmitting(false);
      return;
    }
    setInfo(t("auth.forgot.sent"));
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}>
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--text-color)" }}>{t("auth.forgot.title")}</h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {t("auth.forgot.subtitle")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AuthInput
            label={t("auth.email")}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <AuthButton type="submit" disabled={submitting}>
            {submitting ? t("auth.forgot.loading") : t("auth.forgot.submit")}
          </AuthButton>
        </form>

        {info && <p className="text-xs text-green-400">{info}</p>}

        <div className="text-xs text-center" style={{ color: "var(--text-secondary)" }}>
          <button
            type="button"
            onClick={onGoBackToLogin}
            className="text-blue-500 hover:text-blue-400"
          >
            {t("auth.forgot.back")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
