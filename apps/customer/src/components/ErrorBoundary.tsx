import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("SHADOW SHOP boundary caught error:", error, errorInfo);

    // Auto-recover from stale Vite deployment chunks
    const message = error?.message || "";
    const isChunkFailure =
      message.includes("Failed to fetch dynamically imported module") ||
      message.includes("Importing a module script failed") ||
      message.includes("error loading dynamically imported module");

    if (isChunkFailure) {
      const hasRetried = sessionStorage.getItem("shadow_chunk_retry");
      if (!hasRetried) {
        sessionStorage.setItem("shadow_chunk_retry", "true");
        window.location.reload();
      }
    }
  }

  private handleReset = () => {
    sessionStorage.removeItem("shadow_chunk_retry");
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "70vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px 20px",
            textAlign: "center",
            background: "var(--bg, #0d0d0f)",
            color: "var(--text, #f0f0f4)",
            fontFamily: "var(--font-sans, system-ui, -apple-system, sans-serif)",
          }}
        >
          <div
            style={{
              maxWidth: "460px",
              padding: "36px",
              background: "var(--card, #141418)",
              border: "1px solid var(--border, rgba(255, 255, 255, 0.08))",
              borderRadius: "16px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: "var(--gold, #d4af37)",
                fontWeight: 700,
                display: "block",
                marginBottom: "8px",
              }}
            >
              Application Notice
            </span>
            <h2 style={{ fontSize: "22px", margin: "0 0 12px 0", fontWeight: 700 }}>
              Something stepped into the shadows.
            </h2>
            <p style={{ color: "var(--muted, #9e9ea7)", fontSize: "14px", lineHeight: "1.6", margin: "0 0 24px 0" }}>
              We encountered a temporary rendering issue while loading this view. You can reload to fetch the latest assets or return to the catalog.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: "10px 20px",
                  background: "var(--gold, #d4af37)",
                  color: "#000",
                  border: "none",
                  borderRadius: "99px",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                  transition: "opacity 0.2s",
                }}
              >
                Reload View
              </button>
              <button
                onClick={this.handleReset}
                style={{
                  padding: "10px 20px",
                  background: "transparent",
                  color: "var(--text, #fff)",
                  border: "1px solid var(--border, rgba(255, 255, 255, 0.2))",
                  borderRadius: "99px",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Go to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
