import React, { useEffect, useRef } from "react";
import { AuthContextProvider } from "./context/AuthContext";
import { OnboardingProvider } from "./context/OnboardingContext";
import { ThemeProvider } from "./theme/ThemeContext";
import { AppRouter } from "./routes/AppRouter";
import { ensureTestAccountsSeeded } from "./utils/testAccountsSeed";
import { KeyboardDismissBar } from "./components/common/KeyboardDismissBar";
import { useModalStore } from "./store/useModalStore";
import { SplashScreen } from "@capacitor/splash-screen";

// Types explicitly exported to maintain compatibility
export type { TabKey } from "./types";

let _autoRecoveryRetries = 0;
const MAX_AUTO_RECOVERY_RETRIES = 3;

class GlobalErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: unknown }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, errorInfo: unknown) {
    if (import.meta.env.DEV) console.error("Global Error Boundary caught:", error, errorInfo);

    // Auto-recover from transient auth-context init errors (race condition on cold start).
    // On retry the JS module is fully loaded and the context renders correctly.
    const msg = (error as any)?.message ?? "";
    if (msg.includes("AuthContextProvider") && _autoRecoveryRetries < MAX_AUTO_RECOVERY_RETRIES) {
      _autoRecoveryRetries++;
      setTimeout(() => this.setState({ hasError: false, error: null }), 400);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleBackToDashboard = () => {
    // Hard reset to root without clearing storage to preserve data
    window.location.href = '/';
  };

  handleCopyError = () => {
    const errorMsg = (this.state.error as any)?.message || "Unknown error";
    // Using a simple alert for feedback as toast might not be available in error boundary
    navigator.clipboard.writeText(`${errorMsg}\n\nCallstack unavailable in production build.`);
    alert("Fehlercode in die Zwischenablage kopiert.");
  };

  handleClearAndReload = () => {
    try { localStorage.removeItem('trainq-active-workout-storage'); } catch { /* ignore */ }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ backgroundColor: '#1a1a1a', color: '#ffffff', fontFamily: 'system-ui, sans-serif' }} className="flex h-screen w-full flex-col items-center justify-center px-6 text-center">
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Ups, etwas ist schiefgelaufen.</h2>
          <p style={{ fontSize: 14, color: '#aaaaaa', marginBottom: 24, maxWidth: 280 }}>
            Keine Sorge, deine Daten sind sicher.
          </p>

          <div style={{ marginBottom: 24, padding: 16, backgroundColor: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 16, maxWidth: 280, width: '100%' }}>
            <p style={{ fontSize: 12, fontFamily: 'monospace', color: '#f87171', wordBreak: 'break-all', marginBottom: 8 }}>
              {(this.state.error as any)?.message || "Unbekannter Fehler"}
            </p>
            <button
              onClick={this.handleCopyError}
              style={{ fontSize: 10, color: '#f87171', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}
            >
              Fehlercode kopieren
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 280 }}>
            <button
              onClick={this.handleClearAndReload}
              style={{ width: '100%', borderRadius: 24, backgroundColor: '#2563eb', padding: '12px 16px', fontWeight: 600, color: '#ffffff', border: 'none', fontSize: 16, cursor: 'pointer' }}
            >
              Neu starten
            </button>
            <button
              onClick={this.handleBackToDashboard}
              style={{ width: '100%', borderRadius: 24, backgroundColor: '#2a2a2a', padding: '12px 16px', fontWeight: 600, color: '#ffffff', border: '1px solid #444', fontSize: 16, cursor: 'pointer' }}
            >
              Zurück zum Dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }

}

function GlobalClickShield() {
  const shieldActive = useModalStore((s) => s.shieldActive);
  if (!shieldActive) return null;
  return (
    <div
      className="fixed inset-0 z-[99999]"
      style={{ touchAction: "none" }}
      onPointerDown={(e) => e.preventDefault()}
      onClick={(e) => e.preventDefault()}
    />
  );
}

export const App: React.FC = () => {
  const seededRef = useRef(false);

  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    if (import.meta.env.DEV) {
      ensureTestAccountsSeeded();
    }
    // Hide splash screen now that React has mounted and UI is ready
    SplashScreen.hide({ fadeOutDuration: 300 }).catch(() => {});
  }, []);

  return (
    <GlobalErrorBoundary>
      <AuthContextProvider>
        <ThemeProvider>
          <OnboardingProvider>
            <AppRouter />
            <KeyboardDismissBar />
            <GlobalClickShield />
          </OnboardingProvider>
        </ThemeProvider>
      </AuthContextProvider>
    </GlobalErrorBoundary>
  );
};

export default App;
