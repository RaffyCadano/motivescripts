/**
 * Pause / unpause a Vercel project through Vercel's REST API (POST /v1/projects/{id}/pause and /unpause).
 * Pure enough to unit-test with a stub fetch (scripts/test-vercel-site.mjs); the edge function around it
 * (vercel-site-control) decides WHEN to call it and records the result.
 */

export type SiteAction = "pause" | "unpause";

const SAFE_ID = /^[A-Za-z0-9._-]{1,100}$/;

/** Vercel project names/ids and team ids/slugs only ever contain these characters; anything else never reaches a URL. */
export function isSafeVercelId(value: unknown): value is string {
  return typeof value === "string" && SAFE_ID.test(value);
}

export function vercelSiteUrl(action: SiteAction, projectId: string, teamId?: string | null): string {
  const base = `https://api.vercel.com/v1/projects/${encodeURIComponent(projectId)}/${action}`;
  if (!teamId) return base;
  // "team_..." is a team id; anything else is treated as the team's slug.
  const key = teamId.startsWith("team_") ? "teamId" : "slug";
  return `${base}?${key}=${encodeURIComponent(teamId)}`;
}

export type SiteControlResult = { ok: boolean; message: string };

export async function controlVercelProject(input: {
  token: string | undefined;
  action: SiteAction;
  projectId: string;
  teamId?: string | null;
  fetchFn?: typeof fetch;
}): Promise<SiteControlResult> {
  const { token, action, projectId, teamId } = input;
  const fetchFn = input.fetchFn ?? fetch;
  if (!token) return { ok: false, message: "VERCEL_API_TOKEN is not set on the server." };
  if (!isSafeVercelId(projectId)) return { ok: false, message: "The Vercel project name has characters Vercel does not allow." };
  if (teamId && !isSafeVercelId(teamId)) return { ok: false, message: "The Vercel team id has characters Vercel does not allow." };

  let response: Response;
  try {
    response = await fetchFn(vercelSiteUrl(action, projectId, teamId), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
  } catch {
    return { ok: false, message: "Could not reach Vercel." };
  }
  if (response.ok) return { ok: true, message: action === "pause" ? "Paused on Vercel." : "Unpaused on Vercel." };

  let detail = "";
  try {
    const body = (await response.json()) as { error?: { message?: string; code?: string } };
    detail = body?.error?.message ?? body?.error?.code ?? "";
  } catch {
    // no JSON body
  }
  const suffix = detail ? `: ${detail}` : "";
  return { ok: false, message: `Vercel answered ${response.status}${suffix}`.slice(0, 240) };
}
