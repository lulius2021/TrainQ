// src/pages/auth/RegisterPage.tsx
import React, { useState } from "react";
import { AuthInput } from "../../components/auth/AuthInput.tsx";
import { AuthButton } from "../../components/auth/AuthButton.tsx";
import { useAuth } from "../../hooks/useAuth.ts";

interface RegisterPageProps {
  onGoToLogin: () => void;
}

const RegisterPage: React.FC<RegisterPageProps> = ({ onGoToLogin }) => {
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // New onboarding logic: Name
  const [name, setName] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwörter stimmen nicht überein.");
      return;
    }
    setError(null);
    setBusy(true);

    try {
      const res = await register(email, password, { full_name: name });
      if (!res.ok) {
        setError(res.error || "Registrierung fehlgeschlagen.");
      } else {
        if (!res.session) {
          alert("Konto erstellt! Bitte E-Mail bestätigen.");
          onGoToLogin();
        }
        // If session exists, AppRouter handles redirect
      }
    } catch (err: any) {
      setError(err?.message || "Ein unbekannter Fehler ist aufgetreten.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center bg-[var(--bg)] px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-white">
          Konto erstellen
        </h2>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
          <form className="space-y-6" onSubmit={handleRegister}>
            {error && (
              <div className="p-3 text-sm text-red-200 bg-red-900/40 border border-red-500/50 rounded-2xl">
                {error}
              </div>
            )}

            <AuthInput
              label="Name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dein Name"
            />

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
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />

            <div className="text-xs text-gray-400">
              Durch die Registrierung stimmst du unseren Nutzungsbedingungen und Datenschutzrichtlinien zu.
            </div>

            <div>
              <AuthButton type="submit" disabled={busy}>
                {busy ? "Erstelle Konto..." : "Registrieren"}
              </AuthButton>
            </div>
          </form>

          <p className="mt-10 text-center text-sm text-gray-400">
            Bereits ein Konto?{" "}
            <button
              onClick={onGoToLogin}
              className="font-semibold leading-6 text-[#007AFF] hover:text-[#0056b3]"
            >
              Anmelden
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
