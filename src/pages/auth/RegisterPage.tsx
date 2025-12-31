// src/pages/auth/RegisterPage.tsx
import React, { useState } from "react";
import { AuthInput } from "../../components/auth/AuthInput";
import { AuthButton } from "../../components/auth/AuthButton";
import { useAuth } from "../../hooks/useAuth";

interface Props {
  onGoToLogin?: () => void;
}

const RegisterPage: React.FC<Props> = ({ onGoToLogin }) => {
  const { register } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== repeatPassword) {
      setError("Passwörter stimmen nicht überein.");
      return;
    }

    setError(null);
    setBusy(true);

    try {
      const res: any = await register(email, password);
      if (res && res.ok === false) {
        setError(res.error || "Registrierung fehlgeschlagen.");
      } else {
        // optional: nach erfolgreicher Registrierung zurück zum Login
        onGoToLogin?.();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4" style={{ background: "transparent" }}>
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-black/40 p-5 shadow-xl shadow-black/40">
        <div className="mb-4">
          <div className="text-lg font-semibold text-white">Account erstellen</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AuthInput label="E-Mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <AuthInput
            label="Passwort"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <AuthInput
            label="Passwort wiederholen"
            type="password"
            value={repeatPassword}
            onChange={(e) => setRepeatPassword(e.target.value)}
            required
            error={error ?? undefined}
          />

          <div className="text-[11px] text-white/45">
            Mit der Registrierung akzeptierst du die Nutzungsbedingungen und Datenschutzbestimmungen von TrainQ.
          </div>

          <AuthButton type="submit" disabled={busy}>
            {busy ? "Registrieren..." : "Registrieren"}
          </AuthButton>
        </form>

        <div className="mt-4 text-xs text-center text-white/60">
          Bereits ein Konto?{" "}
          <button type="button" onClick={onGoToLogin} className="text-blue-400 hover:text-blue-300">
            Einloggen
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;