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
    <div className="min-h-screen flex flex-col justify-center px-6 py-12 lg:px-8" style={{ backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}>
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight" style={{ color: "var(--text-color)" }}>
          Konto erstellen
        </h2>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        <div className="backdrop-blur-xl rounded-2xl p-6 shadow-2xl border" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}>
          <form className="space-y-6" onSubmit={handleRegister}>
            {error && (
              <div className="p-3 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-2xl">
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

            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Durch die Registrierung stimmst du unseren Nutzungsbedingungen und Datenschutzrichtlinien zu.
            </div>

            <div>
              <AuthButton type="submit" disabled={busy}>
                {busy ? "Erstelle Konto..." : "Registrieren"}
              </AuthButton>
            </div>
          </form>

          <p className="mt-10 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
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
