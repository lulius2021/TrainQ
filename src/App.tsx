import React, { useEffect, useRef } from "react";
import { AuthContextProvider } from "./context/AuthContext";
import { OnboardingProvider } from "./context/OnboardingContext";
import { AppRouter } from "./routes/AppRouter";
import { ensureTestAccountsSeeded } from "./utils/testAccountsSeed";

// Types explicitly exported to maintain compatibility
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

  handleResetStorage = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    } catch (e) {
      console.error(e);
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-transparent backdrop-blur-md px-6 text-center text-white">
          <h2 className="mb-2 text-xl font-bold">Ups, etwas ist schiefgelaufen.</h2>
          <p className="mb-6 text-sm text-gray-400 max-w-xs">
            {(this.state.error as any)?.message || "Ein unerwarteter Fehler ist aufgetreten."}
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              onClick={this.handleReload}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white active:scale-95 transition-transform"
            >
              App neu laden
            </button>
            <button
              onClick={this.handleResetStorage}
              className="w-full rounded-xl bg-white/10 px-4 py-3 font-semibold text-white active:scale-95 transition-transform"
            >
              Daten zurücksetzen (Logout)
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
    <div className="h-screen w-screen overflow-hidden bg-transparent font-[SF Pro Display,sans-serif] text-[var(--text)]">
      <GlobalErrorBoundary>
        <AuthContextProvider>
          <OnboardingProvider>
            <AppRouter />
          </OnboardingProvider>
        </AuthContextProvider>
      </GlobalErrorBoundary>
    </div>
  );
};

export default App;
