// src/pages/auth/ForgotPasswordPage.tsx
import React, { useState } from "react";
import { AuthInput } from "../../components/auth/AuthInput.tsx";
import { AuthButton } from "../../components/auth/AuthButton.tsx";
import { useAuth } from "../../hooks/useAuth.ts";

interface ForgotPasswordPageProps {
  onGoBackToLogin: () => void;
}

const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({
  onGoBackToLogin,
}) => {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const result = await requestPasswordReset(email);
    if (!result.ok && result.error) {
      setInfo(result.error);
      setSubmitting(false);
      return;
    }
    setInfo("E-Mail gesendet!");
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-white px-4">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Passwort vergessen</h1>
          <p className="text-sm text-gray-400">
            Gib deine E-Mail ein, um dein Passwort zurückzusetzen.
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

          <AuthButton type="submit" disabled={submitting}>
            {submitting ? "Lädt..." : "Link senden"}
          </AuthButton>
        </form>

        {info && <p className="text-xs text-green-400">{info}</p>}

        <div className="text-xs text-center text-gray-400">
          <button
            type="button"
            onClick={onGoBackToLogin}
            className="text-blue-400 hover:text-blue-300"
          >
            Zurück zum Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
