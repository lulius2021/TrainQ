import React, { useEffect, useRef } from "react";
import { AuthContextProvider, useAuth } from "./context/AuthContext";
import { OnboardingProvider } from "./context/OnboardingContext";
import { ThemeProvider } from "./theme/ThemeContext";
import { AppRouter } from "./routes/AppRouter";
import { ensureTestAccountsSeeded } from "./utils/testAccountsSeed";

// Types explicitly exported to maintain compatibility
export type { TabKey } from "./types";

class GlobalErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: unknown }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, errorInfo: unknown) {
    console.error("Global Error Boundary caught:", error, errorInfo);
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

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-color)' }} className="flex h-screen w-full flex-col items-center justify-center px-6 text-center">
          <h2 className="mb-2 text-xl font-bold">Ups, etwas ist schiefgelaufen.</h2>
          <p className="mb-6 text-sm max-w-xs" style={{ color: 'var(--text-secondary)' }}>
            Keine Sorge, deine Daten sind sicher. Wir bringen dich zurück.
          </p>

          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl max-w-xs w-full">
            <p className="text-xs font-mono text-red-400 break-words mb-2">
              {(this.state.error as any)?.message || "Unbekannter Fehler"}
            </p>
            <button
              onClick={this.handleCopyError}
              className="text-[10px] uppercase tracking-wider font-bold text-red-400/70 hover:text-red-400 underline"
            >
              Fehlercode kopieren
            </button>
          </div>

          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              onClick={this.handleReload}
              className="w-full rounded-3xl bg-blue-600 px-4 py-3 font-semibold text-white active:scale-95 transition-transform shadow-lg shadow-blue-500/20"
            >
              Seite neu laden
            </button>
            <button
              onClick={this.handleBackToDashboard}
              className="w-full rounded-3xl px-4 py-3 font-semibold active:scale-95 transition-transform border"
              style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-color)' }}
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

export const App: React.FC = () => {
  const seededRef = useRef(false);

  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    if (import.meta.env.DEV) {
      ensureTestAccountsSeeded();
    }
  }, []);

  return (
    <GlobalErrorBoundary>
      <AuthContextProvider>
        <ThemeProvider>
          <OnboardingProvider>
            <AppRouter />
          </OnboardingProvider>
        </ThemeProvider>
      </AuthContextProvider>
    </GlobalErrorBoundary>
  );
};

export default App;
