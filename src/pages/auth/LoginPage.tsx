// src/pages/auth/LoginPage.tsx
import React, { useState } from "react";
import { AuthInput } from "../../components/auth/AuthInput";
import { AuthButton } from "../../components/auth/AuthButton";
import { useAuth } from "../../hooks/useAuth";

interface Props {
  onGoToRegister?: () => void;
  onGoToForgotPassword?: () => void;
}

const LoginPage: React.FC<Props> = ({
  onGoToRegister,
  onGoToForgotPassword,
}) => {
  const { login, loginWithProvider, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(email, password);
    // TODO: nach erfolgreichem Login zu OnboardingPage wechseln
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#05060A] text-white px-4">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Willkommen bei ARVIO 👋</h1>
          <p className="text-sm text-gray-400">
            Logge dich ein, um deine Trainings und deinen Alltag zu strukturieren.
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

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onGoToForgotPassword}
              className="text-xs text-gray-400 hover:text-gray-200"
            >
              Passwort vergessen?
            </button>
          </div>

          <AuthButton type="submit" disabled={loading}>
            Einloggen
          </AuthButton>
        </form>

        {/* Social Logins */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="flex-1 h-px bg-gray-800" />
            <span>oder einloggen mit</span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <button
              type="button"
              onClick={() => loginWithProvider("apple")}
              className="border border-gray-700 rounded-full py-2 bg-[#05060A]"
            >
              Apple
            </button>
            <button
              type="button"
              onClick={() => loginWithProvider("google")}
              className="border border-gray-700 rounded-full py-2 bg-[#05060A]"
            >
              Google
            </button>
            <button
              type="button"
              onClick={() => loginWithProvider("facebook")}
              className="border border-gray-700 rounded-full py-2 bg-[#05060A]"
            >
              Facebook
            </button>
          </div>
        </div>

        <div className="text-xs text-center text-gray-400">
          Noch keinen Account?{" "}
          <button
            type="button"
            onClick={onGoToRegister}
            className="text-blue-400 hover:text-blue-300"
          >
            Registrieren
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
