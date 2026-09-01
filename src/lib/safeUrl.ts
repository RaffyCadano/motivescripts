/** Accept only http(s) links. Reject javascript:, data:, and credentialed URLs. */
export function normalizeHttpUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (!parsed.hostname) return null;
  if (parsed.username || parsed.password) return null;
  return parsed.href;
}

export function safeHttpHref(value: string): string | null {
  return normalizeHttpUrl(value);
}

export function displayHttpHost(value: string): string {
  const href = normalizeHttpUrl(value);
  if (!href) return "";
  try {
    const parsed = new URL(href);
    const path = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, "");
    return `${parsed.host}${path}${parsed.search}`;
  } catch {
    return href;
  }
}
