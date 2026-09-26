/** One of the signed-in person's login sessions (from my_auth_sessions()). */
export type AuthSession = {
  id: string;
  userAgent: string;
  ip: string;
  createdAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
};

/** "Chrome on Windows" from a browser user-agent string; "Unknown device" when there is nothing to go on. */
export function describeUserAgent(userAgent: string | null | undefined): string {
  const ua = (userAgent ?? "").trim();
  if (!ua) return "Unknown device";

  const os = /iPhone|iPad|iPod/i.test(ua)
    ? "iOS"
    : /Android/i.test(ua)
      ? "Android"
      : /Windows/i.test(ua)
        ? "Windows"
        : /Mac OS X|Macintosh/i.test(ua)
          ? "macOS"
          : /CrOS/i.test(ua)
            ? "ChromeOS"
            : /Linux/i.test(ua)
              ? "Linux"
              : "";

  // Order matters: Edge, Opera and Brave-like builds also say "Chrome", and Chrome also says "Safari".
  const browser = /Edg(e|A|iOS)?\//i.test(ua)
    ? "Edge"
    : /OPR\/|Opera/i.test(ua)
      ? "Opera"
      : /Firefox\/|FxiOS/i.test(ua)
        ? "Firefox"
        : /Chrome\/|CriOS/i.test(ua)
          ? "Chrome"
          : /Safari\//i.test(ua)
            ? "Safari"
            : "";

  if (browser && os) return `${browser} on ${os}`;
  if (browser) return browser;
  if (os) return os;
  return "Unknown device";
}

/** "Sep 26, 2026, 9:41 AM". */
export function formatSessionTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
