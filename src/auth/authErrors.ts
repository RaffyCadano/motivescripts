const LINK_FAILED =
  "That sign-in link expired or was already used. Request a new one from this same browser.";

export function publicAuthLinkError(): string {
  return LINK_FAILED;
}

export function publicSignInError(reason: "rate_limit" | "error"): string {
  if (reason === "rate_limit") {
    return "Too many email attempts. Wait a while, then try again.";
  }
  return "We couldn’t send that link. Try again in a moment, or email us directly.";
}

export function devAuthDetail(error: { message?: string; code?: string; status?: number } | string | null | undefined): string | undefined {
  if (!import.meta.env.DEV) return undefined;
  if (!error) return undefined;
  if (typeof error === "string") {
    const trimmed = error.trim();
    return trimmed || undefined;
  }
  const parts = [error.message, error.code, error.status != null ? String(error.status) : ""]
    .filter((part): part is string => Boolean(part && String(part).trim()))
    .map((part) => String(part).trim());
  return parts.join(" · ") || undefined;
}
