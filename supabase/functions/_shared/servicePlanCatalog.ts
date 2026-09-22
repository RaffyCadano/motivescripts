// UUID validation and error mapping for clients choosing a Website Care plan in the portal. Pure (no
// Deno or Stripe imports) so it can be unit tested in plain Node (scripts/test-service-plan-catalog.mjs).
//
// There is no flat self-serve catalog anymore: Website Care is the only plan a client can choose
// themselves, and it's tiered (Essential/Business/Pro, admin-editable in maintenance_plan_templates) --
// see resolveCareTierForCheckout in index.ts, which looks the chosen tier up directly. Hosting and SEO
// are not sold as separate ongoing plans; they're included starting at the Essential and Pro tiers.

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
