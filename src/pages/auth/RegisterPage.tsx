// src/pages/auth/RegisterPage.tsx
import React, { useState } from "react";
import { AuthInput } from "../../components/auth/AuthInput";
import { AuthButton } from "../../components/auth/AuthButton";
import { useAuth } from "../../hooks/useAuth";
import { useI18n } from "../../i18n/useI18n";

interface Props {
  onGoToLogin?: () => void;
}

const RegisterPage: React.FC<Props> = ({ onGoToLogin }) => {
  const { register } = useAuth();
  const { t } = useI18n();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== repeatPassword) {
      setError(t("auth.register.passwordMismatch"));
      return;
    }

    setError(null);
    setBusy(true);

    try {
      const res: any = await register(email, password);
      if (res && res.ok === false) {
        setError(res.error || t("auth.register.error"));
      } else {
        // optional: nach erfolgreicher Registrierung zurück zum Login
        onGoToLogin?.();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 bg-gradient-to-b from-[#0f172a] via-[#0a0e17] to-black">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-black/40 p-5 shadow-xl shadow-black/40">
        <div className="mb-4">
          <div className="text-lg font-semibold text-white">{t("auth.register.title")}</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AuthInput label={t("auth.email")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <AuthInput
            label={t("auth.password")}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <AuthInput
            label={t("auth.register.repeatPassword")}
            type="password"
            value={repeatPassword}
            onChange={(e) => setRepeatPassword(e.target.value)}
            required
            error={error ?? undefined}
          />

          <div className="text-[11px] text-white/45">
            {t("auth.register.terms")}
          </div>

          <AuthButton type="submit" disabled={busy}>
            {busy ? t("auth.register.loading") : t("auth.register.submit")}
          </AuthButton>
        </form>

        <div className="mt-4 text-xs text-center text-white/60">
          {t("auth.register.already")}{" "}
          <button type="button" onClick={onGoToLogin} className="text-blue-400 hover:text-blue-300">
            {t("auth.register.login")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
