const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

export function configuredSiteOrigin(): string | null {
  const raw = (Deno.env.get("PUBLIC_SITE_URL") ?? Deno.env.get("SITE_URL") ?? "").trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return raw.replace(/\/$/, "");
  }
}

export function allowOrigin(req: Request): string {
  const configured = configuredSiteOrigin();
  const origin = req.headers.get("Origin") ?? "";
  if (origin && LOCAL_ORIGIN.test(origin)) return origin;
  if (origin && configured && origin === configured) return origin;
  if (configured) return configured;
  return "null";
}

export function corsHeadersForRequest(
  req: Request,
  extra: Record<string, string> = {},
): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": allowOrigin(req),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
    ...extra,
  };
}
