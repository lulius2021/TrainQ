// src/pages/auth/RegisterPage.tsx
import React, { useState } from "react";
import { AuthInput } from "../../components/auth/AuthInput";
import { AuthButton } from "../../components/auth/AuthButton";
import { useAuth } from "../../hooks/useAuth";

interface Props {
  onGoToLogin?: () => void;
}

const RegisterPage: React.FC<Props> = ({ onGoToLogin }) => {
  const { register, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== repeatPassword) {
      setError("Passwörter stimmen nicht überein.");
      return;
    }
    setError(null);
    await register(email, password);
    // TODO: nach erfolgreicher Registrierung Onboarding starten
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#05060A] text-white px-4">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Account erstellen</h1>
          <p className="text-sm text-gray-400">
            Erstelle dein ARVIO Konto, um deinen Alltag und dein Training zu strukturieren.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AuthInput
            label="E-Mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
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

          <div className="text-[11px] text-gray-500">
            Mit der Registrierung akzeptierst du die Nutzungsbedingungen und
            Datenschutzbestimmungen von ARVIO.
          </div>

          <AuthButton type="submit" disabled={loading}>
            Registrieren
          </AuthButton>
        </form>

        <div className="text-xs text-center text-gray-400">
          Bereits ein Konto?{" "}
          <button
            type="button"
            onClick={onGoToLogin}
            className="text-blue-400 hover:text-blue-300"
          >
            Einloggen
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
