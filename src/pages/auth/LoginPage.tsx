// src/pages/auth/LoginPage.tsx
import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth.ts";
import { useI18n } from "../../i18n/useI18n";

interface LoginPageProps {
  onGoToRegister: () => void;
  onGoToForgotPassword?: () => void;
}

export default function LoginPage({
  onGoToRegister,
  onGoToForgotPassword,
}: LoginPageProps) {
  const { login, loginWithApple } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Magic Backdoor for TestFlight/AppReview (Legacy)
  const isBackdoor = email.startsWith("free") && email.endsWith("@testflight.trainq:trainq1234");
  const onMagic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBackdoor) return;
    const [addr, pass] = email.split(":");
    await login(addr, pass || "trainq1234");
  };

  const onSubmitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBackdoor) return onMagic(e);

    if (!email || !password) {
      setError(t("auth.login.empty"));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await login(email, password);
      // If error
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
    if (typeof window === "undefined" || !(window as any).AppleID) {
      setError(t("auth.login.appleUnavailable"));
      return;
    }
    setBusy(true);
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
    <div className="flex min-h-screen flex-col justify-center px-6 py-12 lg:px-8" style={{ backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}>
      <div className="sm:mx-auto sm:w-full sm:max-w-sm text-center">
        <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ color: "var(--text-color)" }}>
          {t("auth.login.welcomeBack")}
        </h1>
        <p style={{ color: "var(--text-secondary)" }}>
          {t("auth.login.subtitle")}
        </p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        <div className="backdrop-blur-xl rounded-2xl p-6 shadow-2xl border" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}>
          {/* Backdoor UI (Hidden for normal users) */}
          {email === "testflight" && (
            <div className="mb-4 bg-yellow-500/20 p-2 rounded text-xs text-yellow-200">
              Dev Mode Active
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-3xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={onSubmitEmail} className="space-y-4" autoComplete="on">
            <div className="space-y-2">
              <label className="block text-sm" style={{ color: "var(--text-secondary)" }}>{t("auth.email")}</label>
              <input
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setEmail((e) => e.trim())}
                className="w-full rounded-3xl px-4 py-3 text-base outline-none focus:ring-2 focus:ring-blue-500/50"
                style={{ backgroundColor: "var(--input-bg)", borderColor: "var(--border-color)", color: "var(--text-color)", border: "1px solid var(--border-color)" }}
                placeholder="name@email.com"
                type="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                inputMode="email"
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm" style={{ color: "var(--text-secondary)" }}>{t("auth.password")}</label>
              <div className="relative">
                <input
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-3xl pl-4 pr-12 py-3 text-base outline-none focus:ring-2 focus:ring-blue-500/50"
                  style={{ backgroundColor: "var(--input-bg)", borderColor: "var(--border-color)", color: "var(--text-color)", border: "1px solid var(--border-color)" }}
                  placeholder="••••••••"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-2xl p-1.5 transition-colors"
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
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={busy}
                className={`w-full rounded-3xl px-4 py-3 text-base font-semibold transition-all duration-300 ${busy ? "cursor-not-allowed opacity-50" : "hover:opacity-90 shadow-lg"}`}
                style={{ backgroundColor: busy ? "var(--button-bg)" : "var(--accent-color)", color: busy ? "var(--text-secondary)" : "#FFFFFF" }}
              >
                {busy ? t("auth.login.loading") : t("auth.login.title")}
              </button>
            </div>

            <div className="flex items-center justify-between pt-2">
              {onGoToRegister ? (
                <button
                  type="button"
                  onClick={onGoToRegister}
                  className="text-sm underline-offset-4 hover:underline"
                  style={{ color: "var(--text-secondary)" }}
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
                  className="text-sm underline-offset-4 hover:underline"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {t("auth.login.forgot")}
                </button>
              ) : (
                <div />
              )}
            </div>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t" style={{ borderColor: "var(--border-color)" }}></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-2 text-sm" style={{ backgroundColor: "var(--card-bg)", color: "var(--text-secondary)" }}>{t("auth.login.or")}</span>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={onApple}
              disabled={busy}
              className={`w-full rounded-3xl px-4 py-3 text-base font-semibold transition-colors border ${busy ? "cursor-not-allowed opacity-50" : "hover:opacity-80"}`}
              style={{ backgroundColor: "var(--button-bg)", color: "var(--text-color)", borderColor: "var(--border-color)" }}
            >
              {busy ? t("auth.login.loading") : t("auth.login.apple")}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
