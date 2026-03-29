// src/pages/auth/RegisterPage.tsx
import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth.ts";
import { useI18n } from "../../i18n/useI18n";
import { ChevronLeft } from "lucide-react";

interface RegisterPageProps {
  onGoToLogin: () => void;
}

const RegisterPage: React.FC<RegisterPageProps> = ({ onGoToLogin }) => {
  const { register } = useAuth();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError(t("auth.register.passwordMismatch"));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await register(email, password, { full_name: name });
      if (!res.ok) {
        setError(res.error || t("auth.register.error"));
      } else {
        if (!res.session) {
          setConfirmed(true);
        }
      }
    } catch (err: any) {
      setError(err?.message || t("auth.register.error"));
    } finally {
      setBusy(false);
    }
  };

  if (confirmed) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-screen px-6 gap-5"
        style={{ backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}
      >
        <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">{t("auth.register.title")}</h2>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {t("auth.register.confirmEmail")}
          </p>
        </div>
        <button
          type="button"
          onClick={onGoToLogin}
          className="w-full rounded-2xl px-4 py-4 text-base font-semibold transition-all active:scale-[0.98]"
          style={{ backgroundColor: "#007AFF", color: "#FFFFFF" }}
        >
          {t("auth.register.login")}
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
        className="flex items-center px-4 pt-14 pb-4"
        style={{ paddingTop: "max(3.5rem, env(safe-area-inset-top, 3.5rem))" }}
      >
        <button
          type="button"
          onClick={onGoToLogin}
          className="flex items-center gap-1 text-sm font-medium active:opacity-60 transition-opacity"
          style={{ color: "#007AFF" }}
        >
          <ChevronLeft size={20} />
          {t("auth.register.back")}
        </button>
      </div>

      {/* Title */}
      <div className="px-6 pb-8 pt-2">
        <h1 className="text-3xl font-bold tracking-tight mb-1">
          {t("auth.register.title")}
        </h1>
        <p className="text-base" style={{ color: "var(--text-secondary)" }}>
          {t("auth.register.subtitle")}
        </p>
      </div>

      {/* Form */}
      <div className="flex-1 px-5 space-y-3">
        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-3">
          {/* Name */}
          <div
            className="flex items-center rounded-2xl px-4 border"
            style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 py-4 text-base bg-transparent outline-none"
              style={{ color: "var(--text-color)" }}
              placeholder={t("auth.register.namePlaceholder")}
              type="text"
              autoComplete="name"
              autoFocus
            />
          </div>

          {/* Email */}
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
            />
          </div>

          {/* Password */}
          <div
            className="flex items-center rounded-2xl px-4 border"
            style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}
          >
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex-1 py-4 text-base bg-transparent outline-none"
              style={{ color: "var(--text-color)" }}
              placeholder={t("auth.password")}
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="ml-2 p-1"
              style={{ color: "var(--text-secondary)" }}
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

          {/* Confirm Password */}
          <div
            className="flex items-center rounded-2xl px-4 border"
            style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}
          >
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="flex-1 py-4 text-base bg-transparent outline-none"
              style={{ color: "var(--text-color)" }}
              placeholder={t("auth.register.repeatPassword")}
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
            />
          </div>

          {/* Terms */}
          <p className="text-xs px-1" style={{ color: "var(--text-secondary)" }}>
            {t("auth.register.terms")}
          </p>

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
            {busy ? t("auth.register.loading") : t("auth.register.submit")}
          </button>
        </form>

        {/* Login link */}
        <p className="text-sm text-center pt-3" style={{ color: "var(--text-secondary)" }}>
          {t("auth.register.already")}{" "}
          <button
            type="button"
            onClick={onGoToLogin}
            className="font-semibold"
            style={{ color: "#007AFF" }}
          >
            {t("auth.register.login")}
          </button>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
