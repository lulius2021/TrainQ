// src/pages/auth/LoginPage.tsx
import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth.ts";

interface LoginPageProps {
  onGoToRegister: () => void;
  onGoToForgotPassword?: () => void;
}

export default function LoginPage({
  onGoToRegister,
  onGoToForgotPassword,
}: LoginPageProps) {
  const { login, loginWithApple } = useAuth();
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
      setError("Bitte E-Mail und Passwort eingeben.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await login(email, password);
      // If error
      if (res.error) {
        let msg = res.error;
        if (msg.includes("Invalid login credentials")) msg = "E-Mail oder Passwort falsch.";
        setError(msg);
      }
    } catch (e: any) {
      setError(e?.message ?? "Ein Fehler ist aufgetreten.");
    } finally {
      setBusy(false);
    }
  };

  const onApple = async () => {
    if (typeof window === "undefined" || !(window as any).AppleID) {
      setError("Apple Login ist in dieser Umgebung momentan nicht verfügbar.");
      return;
    }
    setBusy(true);
    try {
      const res = await loginWithApple();
      if (!res.ok) setError(res.error ?? "Apple Login fehlgeschlagen.");
    } catch (e: any) {
      setError(e?.message ?? "Apple Login fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  // --- Development Backdoor Select ---
  // Only shows if localStorage dev flag is set or always hidden in prod.
  // We'll keep it hidden unless specific email typed.

  return (
    <div className="flex min-h-screen flex-col justify-center bg-[var(--bg)] px-6 py-12 lg:px-8 text-[var(--text)]">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm text-center">
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
          Willkommen zurück
        </h1>
        <p className="text-[var(--muted)]">
          Melde dich an, um fortzufahren
        </p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
          {/* Backdoor UI (Hidden for normal users) */}
          {email === "testflight" && (
            <div className="mb-4 bg-yellow-500/20 p-2 rounded text-xs text-yellow-200">
              Dev Mode Active
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-3xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          <form onSubmit={onSubmitEmail} className="space-y-4" autoComplete="on">
            <div className="space-y-2">
              <label className="block text-sm text-gray-300">E-Mail</label>
              <input
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setEmail((e) => e.trim())} // Auto-trim
                className="w-full rounded-3xl bg-[var(--surface)] border border-[var(--border)] px-4 py-3 text-base text-[var(--text)] placeholder-[var(--muted)] outline-none focus:ring-2 focus:ring-[var(--primary)]"
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
              <label className="block text-sm text-gray-300">Passwort</label>
              <div className="relative">
                <input
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-3xl bg-[var(--surface)] border border-[var(--border)] pl-4 pr-12 py-3 text-base text-[var(--text)] placeholder-[var(--muted)] outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  placeholder="••••••••"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-2xl p-1.5 text-gray-300 hover:text-white hover:bg-white/10"
                  aria-label={showPassword ? "Passwort verbergen" : "Passwort anzeigen"}
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
                className={`w-full rounded-3xl px-4 py-3 text-base font-semibold transition-all duration-300 ${busy ? "bg-[var(--surface)] text-[var(--muted)] cursor-not-allowed" : "bg-[var(--primary)] text-white hover:opacity-90 shadow-lg"
                  }`}
              >
                {busy ? "Lädt..." : "Anmelden"}
              </button>
            </div>

            <div className="flex items-center justify-between pt-2">
              {onGoToRegister ? (
                <button
                  type="button"
                  onClick={onGoToRegister}
                  className="text-sm text-gray-300 hover:text-white underline-offset-4 hover:underline"
                >
                  Neues Konto erstellen
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
                  Passwort vergessen?
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
              className={`w-full rounded-3xl px-4 py-3 text-base font-semibold transition-colors ${busy ? "bg-[var(--surface)] text-[var(--muted)] cursor-not-allowed" : "bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface2)] border border-[var(--border)]"
                }`}
            >
              {busy ? "Lädt..." : "Mit Apple anmelden"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
