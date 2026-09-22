// The self-serve plan catalog and error mapping for clients choosing a plan in the portal. Pure (no Deno or
// Stripe imports) so it can be unit tested in plain Node (scripts/test-service-plan-catalog.mjs).
//
// The amount and label of a self-serve plan are ALWAYS taken from here, never from the request, so a client
// cannot pick their own price. Keep the amounts equal to the published prices in src/data/pricing.ts
// (hostingStartingPrice, seoRetainerStartingPrice); the test checks they match.
//
// "care" is deliberately NOT in this flat catalog: Website Care is tiered (Essential/Business/Pro, admin-
// editable in maintenance_plan_templates), so a client picks a specific tier rather than one flat price.
// See resolveCareTierForCheckout in index.ts, which looks the chosen tier up directly instead of using
// this catalog.

export const SELF_SERVE_PLAN_TYPES = ["hosting", "seo_retainer"] as const;
export type SelfServePlanType = (typeof SELF_SERVE_PLAN_TYPES)[number];

export const SELF_SERVE_PLANS: Record<SelfServePlanType, { label: string; amountCents: number }> = {
  hosting: { label: "Hosting", amountCents: 2_500 },
  seo_retainer: { label: "SEO Retainer", amountCents: 29_900 },
};

export function isSelfServePlanType(value: unknown): value is SelfServePlanType {
  return typeof value === "string" && (SELF_SERVE_PLAN_TYPES as readonly string[]).includes(value);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** Maps a create_client_service_plan database error onto the error code the portal understands. */
export function clientPlanErrorCode(message: string): string {
  const upper = (message ?? "").toUpperCase();
  if (upper.includes("NOT_LAUNCHED")) return "not_launched";
  if (upper.includes("ALREADY_SUBSCRIBED")) return "already_subscribed";
  if (upper.includes("INVALID_PLAN_TYPE")) return "invalid_plan_type";
  if (upper.includes("NOT_FOUND")) return "not_found";
  return "server_error";
}
