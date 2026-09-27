import { Component, type ErrorInfo, type ReactNode } from "react";
import { isChunkLoadError, reloadForNewVersion } from "@/lib/chunkReload";

type State = { error: Error | null };

/**
 * Sits above the whole app. Without it, any error while drawing a page unmounts everything and leaves a blank white
 * screen. A stale-files error (a new release went out while the tab was open or asleep) reloads the page once; any
 * other error shows a short message with a Reload button instead of nothing.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (isChunkLoadError(error) && reloadForNewVersion()) return;
    console.error("App error", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const stale = isChunkLoadError(error);
    return (
      <main
        role="alert"
        style={{
          minHeight: "100svh",
          display: "grid",
          placeItems: "center",
          padding: "1.5rem",
          background: "#f7f9fc",
          color: "#07111f",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        <div style={{ maxWidth: "26rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.35rem", margin: 0 }}>{stale ? "A new version is ready" : "Something went wrong"}</h1>
          <p style={{ margin: "0.75rem 0 1.25rem", color: "#556070", lineHeight: 1.55 }}>
            {stale
              ? "We just updated the site. Reload to get the latest version."
              : "This page didn’t load properly. Reloading usually fixes it."}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              height: "2.75rem",
              padding: "0 1.5rem",
              border: 0,
              borderRadius: "0.75rem",
              background: "#001030",
              color: "#fff",
              fontSize: "0.95rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
          <p style={{ marginTop: "1rem" }}>
            <a href="/" style={{ color: "#0050f0", fontSize: "0.9rem" }}>
              Go to the home page
            </a>
          </p>
        </div>
      </main>
    );
  }
}
