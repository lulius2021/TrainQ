// src/pages/auth/LoginPage.tsx
import React, { useMemo, useState } from "react";
import { useAuth } from "../../hooks/useAuth";

type Props = {
  onGoToRegister: () => void;
  onGoToForgotPassword: () => void;
};

export default function LoginPage({ onGoToRegister, onGoToForgotPassword }: Props) {
  const { login } = useAuth();

  const [email, setEmail] = useState("pro01@testflight.trainq");
  const [password, setPassword] = useState("trainq1234");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const quickAccounts = useMemo(
    () => [
      { label: "Pro 01", email: "pro01@testflight.trainq", password: "trainq1234" },
      { label: "Pro 02", email: "pro02@testflight.trainq", password: "trainq1234" },
      { label: "Free 01", email: "free01@testflight.trainq", password: "trainq1234" },
    ],
    []
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const res = await login(email, password);

    setBusy(false);
    if (!res.ok) setError(res.error);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4" style={{ background: "transparent" }}>
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-black/40 p-5 shadow-xl shadow-black/40">
        <div className="mb-4">
          <div className="text-xs text-white/60">TrainQ</div>
          <div className="text-lg font-semibold text-white">Login</div>
          <div className="mt-1 text-sm text-white/60">
            TestFlight Accounts: <span className="text-white/80">Passwort ist überall: trainq1234</span>
          </div>
        </div>

        <div className="mb-3 flex gap-2 flex-wrap">
          {quickAccounts.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => {
                setEmail(a.email);
                setPassword(a.password);
                setError(null);
              }}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/75 hover:bg-white/10"
            >
              {a.label}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="block text-xs text-white/60">E-Mail</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl bg-black/30 border border-white/15 px-3 py-2 text-white"
              placeholder="pro01@testflight.trainq"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs text-white/60">Passwort</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl bg-black/30 border border-white/15 px-3 py-2 text-white"
              placeholder="trainq1234"
              type="password"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold ${
              busy ? "bg-white/10 text-white/40" : "bg-brand-primary text-black hover:bg-brand-primary/90"
            }`}
          >
            {busy ? "Anmelden..." : "Anmelden"}
          </button>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={onGoToRegister}
              className="text-xs text-white/70 hover:text-white underline-offset-2 hover:underline"
            >
              Account erstellen
            </button>
            <button
              type="button"
              onClick={onGoToForgotPassword}
              className="text-xs text-white/70 hover:text-white underline-offset-2 hover:underline"
            >
              Passwort vergessen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}