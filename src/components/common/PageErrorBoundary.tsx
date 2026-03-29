import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

type Props = {
  children: React.ReactNode;
  pageName?: string;
};

type State = {
  hasError: boolean;
  error: unknown;
};

export class PageErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: unknown) {
    if (import.meta.env.DEV) console.error(`[PageErrorBoundary] ${this.props.pageName ?? "page"} crashed:`, error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const errMsg = import.meta.env.DEV
        ? ((this.state.error as any)?.message ?? String(this.state.error))
        : null;
      return (
        <div
          className="flex flex-col items-center justify-center px-6 text-center py-20 gap-4"
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "var(--bg-color)",
            color: "var(--text-color)",
          }}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "rgba(239,68,68,0.1)" }}
          >
            <AlertTriangle size={24} style={{ color: "#EF4444" }} />
          </div>
          <div>
            <h3 className="text-lg font-bold mb-1">Seite konnte nicht geladen werden</h3>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Ein unerwarteter Fehler ist aufgetreten.
            </p>
            {errMsg && (
              <p className="text-xs mt-2 font-mono break-all px-2" style={{ color: "#EF4444" }}>
                {errMsg}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 w-full max-w-xs">
            <button
              onClick={this.handleRetry}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold active:scale-95 transition-transform"
              style={{ backgroundColor: "var(--accent-color)", color: "#FFFFFF" }}
            >
              <RefreshCw size={16} />
              Erneut versuchen
            </button>
            <button
              onClick={() => window.location.reload()}
              className="text-xs py-2 rounded-full active:scale-95 transition-transform"
              style={{ color: "var(--text-secondary)", backgroundColor: "var(--button-bg)" }}
            >
              App neu laden
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
