// src/pages/auth/LoginPage.tsx
import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth.ts";
import { useI18n } from "../../i18n/useI18n";

interface LoginPageProps {
  onGoToRegister: () => void;
  onGoToForgotPassword?: () => void;
}

export default function LoginPage({ onGoToRegister, onGoToForgotPassword }: LoginPageProps) {
  const { login, loginWithApple } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

  const onSubmitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError(t("auth.login.empty"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await login(email, password);
      if (res.error) {
        let msg = res.error;
        if (msg.includes("Invalid login credentials")) msg = t("auth.login.invalid");
        setError(msg);
      }
    } catch (e: any) {
      setError(e?.message ?? t("auth.login.error"));
    } finally {
      setBusy(false);
    }
  };

  const onApple = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await loginWithApple();
      if (!res.ok) setError(res.error ?? t("auth.login.appleError"));
    } catch (e: any) {
      setError(e?.message ?? t("auth.login.appleError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}
    >
      {/* Hero section */}
      <div className="flex flex-col items-center justify-center flex-1 px-6 pt-16 pb-8">
        <img
          src="/logo.png"
          alt="TrainQ"
          className="w-20 h-20 rounded-2xl mb-5 shadow-lg"
          style={{ boxShadow: "0 8px 24px rgba(0,122,255,0.25)" }}
        />
        <h1 className="text-3xl font-bold tracking-tight mb-2 text-center">
          TrainQ
        </h1>
        <p className="text-base text-center" style={{ color: "var(--text-secondary)" }}>
          {t("auth.login.subtitle")}
        </p>
      </div>

      {/* Auth section */}
      <div className="px-5 pb-10 space-y-3" style={{ paddingBottom: "max(2.5rem, env(safe-area-inset-bottom, 2.5rem))" }}>

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 text-center">
            {error}
          </div>
        )}

        {/* Apple Sign-In */}
        <button
          type="button"
          onClick={onApple}
          disabled={busy}
          className="w-full flex items-center justify-center gap-3 rounded-2xl px-4 py-4 text-base font-semibold transition-all active:scale-[0.98]"
          style={{
            backgroundColor: "var(--text-color)",
            color: "var(--bg-color)",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {/* Apple Logo */}
          <svg width="18" height="22" viewBox="0 0 18 22" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M14.98 11.63c-.02-2.29 1.87-3.39 1.96-3.44-1.07-1.57-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.47.83-.72 0-1.83-.81-3.01-.79-1.54.02-2.97.9-3.76 2.28-1.6 2.78-.41 6.89 1.15 9.14.77 1.1 1.68 2.34 2.87 2.3 1.16-.05 1.59-.74 2.99-.74 1.4 0 1.79.74 3.01.72 1.24-.02 2.03-1.12 2.79-2.23.88-1.28 1.24-2.52 1.26-2.58-.03-.01-2.44-.94-2.47-3.69zM12.72 4.37c.64-.78 1.07-1.86.95-2.94-.92.04-2.03.61-2.69 1.38-.59.68-1.1 1.77-.96 2.82.97.08 2.05-.5 2.7-1.26z"/>
          </svg>
          {busy ? t("auth.login.loading") : t("auth.login.apple")}
        </button>

        {/* Divider */}
        <div className="relative flex items-center gap-3 py-1">
          <div className="flex-1 h-px" style={{ backgroundColor: "var(--border-color)" }} />
          <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            {t("auth.login.or")}
          </span>
          <div className="flex-1 h-px" style={{ backgroundColor: "var(--border-color)" }} />
        </div>

        {/* Email toggle / form */}
        {!showEmailForm ? (
          <button
            type="button"
            onClick={() => setShowEmailForm(true)}
            className="w-full flex items-center justify-center gap-2 rounded-2xl px-4 py-4 text-base font-semibold transition-all active:scale-[0.98] border"
            style={{
              backgroundColor: "var(--card-bg)",
              color: "var(--text-color)",
              borderColor: "var(--border-color)",
            }}
          >
            {t("auth.login.withEmail")}
          </button>
        ) : (
          <form onSubmit={onSubmitEmail} className="space-y-3">
            {/* Email */}
            <div
              className="flex items-center rounded-2xl px-4 border"
              style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}
            >
              <input
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setEmail((v) => v.trim())}
                className="flex-1 py-4 text-base bg-transparent outline-none"
                style={{ color: "var(--text-color)" }}
                placeholder={t("auth.email")}
                type="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                inputMode="email"
                autoComplete="email"
                autoFocus
              />
            </div>

            {/* Password */}
            <div
              className="flex items-center rounded-2xl px-4 border"
              style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}
            >
              <input
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex-1 py-4 text-base bg-transparent outline-none"
                style={{ color: "var(--text-color)" }}
                placeholder={t("auth.password")}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="ml-2 p-1"
                style={{ color: "var(--text-secondary)" }}
                aria-label={showPassword ? t("auth.passwordHide") : t("auth.passwordShow")}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                )}
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-2xl px-4 py-4 text-base font-semibold transition-all active:scale-[0.98]"
              style={{
                backgroundColor: "#007AFF",
                color: "#FFFFFF",
                opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? t("auth.login.loading") : t("auth.login.title")}
            </button>

            {/* Forgot password */}
            {onGoToForgotPassword && (
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={onGoToForgotPassword}
                  className="text-sm"
                  style={{ color: "#007AFF" }}
                >
                  {t("auth.login.forgot")}
                </button>
              </div>
            )}
          </form>
        )}

        {/* Register link */}
        <p className="text-sm text-center pt-2" style={{ color: "var(--text-secondary)" }}>
          {t("auth.login.noAccount")}{" "}
          <button
            type="button"
            onClick={onGoToRegister}
            className="font-semibold"
            style={{ color: "#007AFF" }}
          >
            {t("auth.login.register")}
          </button>
        </p>
      </div>
    </div>
  );
}
