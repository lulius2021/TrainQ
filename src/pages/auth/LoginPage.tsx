// src/pages/auth/LoginPage.tsx
import React, { useEffect, useState } from "react";
import type { AuthResult } from "../../context/AuthContext";
import { useAuth } from "../../hooks/useAuth";
import { useI18n } from "../../i18n/useI18n";

import logoImg from "../../assets/logos/Logo.png";

type Props = {
  onGoToRegister?: () => void;
  onGoToForgotPassword?: () => void;
};

export default function LoginPage({ onGoToRegister, onGoToForgotPassword }: Props) {
  const auth = useAuth();
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

    const emailTrim = email.trim();
    if (!emailTrim || !password) {
      setError(t("auth.login.empty") || "Bitte E-Mail und Passwort eingeben.");
      return;
    }

    setBusy(true);

    try {
      const res = await auth.login(emailTrim, password);
      // Supabase returns generic error messages, map them if possible
      if (!res.ok) {
        let msg = res.error ?? t("auth.login.error");
        if (msg.includes("Invalid login credentials")) msg = t("auth.login.invalid") || "E-Mail oder Passwort falsch.";
        setError(msg);
      }
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
    <div className="min-h-screen w-full flex items-center justify-center px-4 bg-gradient-to-b from-[#0f172a] via-[#0a0e17] to-black">

      {/* Container for Branding + Card */}
      <div className="w-full max-w-md flex flex-col items-center">

        {/* Branding Header */}
        <div className="flex flex-col items-center justify-center mb-8 space-y-4">
          <div className="relative">
            <div className="absolute -inset-4 bg-blue-500/20 blur-xl rounded-full" />
            <img src={logoImg} alt="TrainQ Logo" className="relative w-20 h-20 drop-shadow-2xl object-contain" />
          </div>

          <div className="text-center">
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Willkommen bei TrainQ
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Dein Coach. Dein Fortschritt.
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="w-full rounded-3xl border border-white/10 bg-white/5 backdrop-blur-lg p-6 shadow-2xl">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-medium text-white/80">{t("auth.login.title")}</h1>
          </div>

          {/* DEV ONLY: Test Accounts */}
          {(import.meta.env.DEV || import.meta.env.VITE_ENABLE_TEST_USERS === "true") && (
            <div className="mb-6 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-yellow-500">
                Test Accounts (Dev Only)
              </label>
              <select
                className="w-full rounded-lg bg-black/20 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-yellow-500"
                onChange={(e) => {
                  if (!e.target.value) return;
                  const [addr, pass] = e.target.value.split(":");
                  setEmail(addr);
                  setPassword(pass);
                }}
                defaultValue=""
              >
                <option value="">-- Choose User --</option>
                <optgroup label="Pro Plan">
                  {Array.from({ length: 5 }, (_, i) => {
                    const id = i + 1 < 10 ? `0${i + 1}` : `${i + 1}`;
                    return (
                      <option key={`pro${id}`} value={`pro${id}@testflight.trainq:trainq1234`}>
                        Pro {id}
                      </option>
                    );
                  })}
                </optgroup>
                <optgroup label="Free Plan">
                  {Array.from({ length: 3 }, (_, i) => {
                    const id = i + 1 < 10 ? `0${i + 1}` : `${i + 1}`;
                    return (
                      <option key={`free${id}`} value={`free${id}@testflight.trainq:trainq1234`}>
                        Free {id}
                      </option>
                    );
                  })}
                </optgroup>
              </select>
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          <form onSubmit={onSubmitEmail} className="space-y-4" autoComplete="on">
            <div className="space-y-2">
              <label className="block text-sm text-gray-300">{t("auth.email")}</label>
              <input
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setEmail((e) => e.trim())} // Auto-trim on blur
                className="w-full rounded-xl bg-[var(--surface)] border border-[var(--border)] px-4 py-3 text-base text-[var(--text)] placeholder-[var(--muted)] outline-none focus:ring-2 focus:ring-[var(--primary)]"
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
              <label className="block text-sm text-gray-300">{t("auth.password")}</label>
              <div className="relative">
                <input
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl bg-[var(--surface)] border border-[var(--border)] pl-4 pr-12 py-3 text-base text-[var(--text)] placeholder-[var(--muted)] outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  placeholder="••••••••"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-300 hover:text-white hover:bg-white/10"
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
                className={`w-full rounded-xl px-4 py-3 text-base font-semibold transition-all duration-300 ${busy ? "bg-[var(--surface)] text-[var(--muted)] cursor-not-allowed" : "bg-[var(--primary)] text-white hover:opacity-90 shadow-lg"
                  }`}
              >
                {busy ? t("auth.login.loading") : t("auth.login.email")}
              </button>
            </div>

            <div className="flex items-center justify-between pt-2">
              {onGoToRegister ? (
                <button
                  type="button"
                  onClick={onGoToRegister}
                  className="text-sm text-gray-300 hover:text-white underline-offset-4 hover:underline"
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
                  className="text-sm text-gray-300 hover:text-white underline-offset-4 hover:underline"
                >
                  {t("auth.login.forgot") || "Passwort vergessen?"}
                </button>
              ) : (
                <div />
              )}
            </div>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white/5 px-2 text-sm text-gray-400 backdrop-blur-md">ODER</span>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={onApple}
              disabled={busy}
              className={`w-full rounded-xl px-4 py-3 text-base font-semibold transition-colors ${busy ? "bg-[var(--surface)] text-[var(--muted)] cursor-not-allowed" : "bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface2)] border border-[var(--border)]"
                }`}
            >
              {busy ? t("auth.login.loading") : t("auth.login.apple")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
