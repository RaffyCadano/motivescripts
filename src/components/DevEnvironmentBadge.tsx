/**
 * Dev-only visual confirmation of which Supabase project the app is talking
 * to. Never rendered in a production build (`import.meta.env.DEV` is false
 * there). Reads the configured URL at runtime instead of comparing against
 * any hardcoded project ref, so it never embeds either project's identity in
 * source code -- it just tells the truth about whatever is actually
 * configured, which is what makes it useful if `.env.local` is ever missing
 * or misconfigured.
 */
function supabaseProjectRef(): string | null {
  const raw = import.meta.env.VITE_SUPABASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

export function DevEnvironmentBadge() {
  if (!import.meta.env.DEV) return null;
  const ref = supabaseProjectRef();

  return (
    <div
      style={{
        position: "fixed",
        left: 8,
        bottom: 8,
        zIndex: 2147483647,
        pointerEvents: "none",
        fontFamily: "ui-monospace, monospace",
        fontSize: 11,
        lineHeight: 1.4,
        padding: "3px 8px",
        borderRadius: 999,
        background: "rgba(15, 23, 42, 0.82)",
        color: "#fff",
        letterSpacing: "0.02em",
      }}
      title={ref ? `Local dev is connected to Supabase project: ${ref}` : "VITE_SUPABASE_URL is not set"}
    >
      DEV{ref ? ` · ${ref}` : " · no Supabase URL configured"}
    </div>
  );
}
