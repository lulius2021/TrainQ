// src/pages/auth/LoginPage.tsx
import React, { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useI18n } from "../../i18n/useI18n";

type Props = {
  onGoToRegister?: () => void;
  onGoToForgotPassword?: () => void;
};

type AuthResult = { ok: boolean; error?: string };

export default function LoginPage({ onGoToRegister, onGoToForgotPassword }: Props) {
  const auth = useAuth() as unknown as {
    login: (email: string, password: string) => Promise<AuthResult>;
    loginWithApple?: () => Promise<AuthResult>;
  };
  const { t } = useI18n();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setError(null);
  }, []);

  const onSubmitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const res = await auth.login(email, password);
      if (!res.ok) setError(res.error ?? t("auth.login.error"));
    } catch (e: any) {
      setError(e?.message ?? t("auth.login.error"));
    } finally {
      setBusy(false);
    }
  };

  const onApple = async () => {
    setError(null);

    if (typeof auth.loginWithApple !== "function") {
      setError(t("auth.login.appleUnavailable"));
      return;
    }

    setBusy(true);
    try {
      const res = await auth.loginWithApple();
      if (!res.ok) setError(res.error ?? t("auth.login.appleError"));
    } catch (e: any) {
      setError(e?.message ?? t("auth.login.appleError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4" style={{ background: "transparent" }}>
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-black/40 p-5 shadow-xl shadow-black/40">
        <div className="mb-4">
          <div className="text-lg font-semibold text-white">{t("auth.login.title")}</div>
        </div>

        {error && (
          <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={onSubmitEmail} className="space-y-3" autoComplete="off">
          <div className="space-y-1">
            <label className="block text-xs text-white/60">{t("auth.email")}</label>
            <input
              name="trainq_email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl bg-black/30 border border-white/15 px-3 py-2 text-white"
              placeholder=""
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="email"
              autoComplete="off"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs text-white/60">{t("auth.password")}</label>

            <div className="relative">
              <input
                name="trainq_password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl bg-black/30 border border-white/15 pl-3 pr-10 py-2 text-white"
                placeholder=""
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
              />

              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-white/70 hover:text-white hover:bg-white/5"
                aria-label={showPassword ? t("auth.passwordHide") : t("auth.passwordShow")}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                    <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold ${
              busy ? "bg-white/10 text-white/40" : "bg-brand-primary text-black hover:bg-brand-primary/90"
            }`}
          >
            {busy ? t("auth.login.loading") : t("auth.login.email")}
          </button>

          <div className="flex items-center justify-between pt-1">
            {onGoToRegister ? (
              <button
                type="button"
                onClick={onGoToRegister}
                className="text-xs text-white/70 hover:text-white underline-offset-2 hover:underline"
              >
                {t("auth.login.register")}
              </button>
            ) : (
              <div />
            )}

            {onGoToForgotPassword ? (
              <button
                type="button"
                onClick={onGoToForgotPassword}
                className="text-xs text-white/70 hover:text-white underline-offset-2 hover:underline"
              >
                {t("auth.login.forgot")}
              </button>
            ) : (
              <div />
            )}
          </div>
        </form>

        <div className="mt-4">
          <button
            type="button"
            onClick={onApple}
            disabled={busy}
            className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold ${
              busy ? "bg-white/10 text-white/40" : "bg-white text-black hover:bg-white/90"
            }`}
          >
            {busy ? t("auth.login.loading") : t("auth.login.apple")}
          </button>
        </div>
      </div>
    </div>
  );
}
