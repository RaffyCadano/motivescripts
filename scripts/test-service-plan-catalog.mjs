// Tests for the self-serve plan catalog (supabase/functions/_shared/servicePlanCatalog.ts).
//
//   node --test scripts/test-service-plan-catalog.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  SELF_SERVE_PLANS,
  SELF_SERVE_PLAN_TYPES,
  clientPlanErrorCode,
  isSelfServePlanType,
  isUuid,
} from "../supabase/functions/_shared/servicePlanCatalog.ts";

test("only hosting and SEO retainer are in the flat catalog; care is tiered, custom stays admin-only", () => {
  assert.deepEqual([...SELF_SERVE_PLAN_TYPES], ["hosting", "seo_retainer"]);
  for (const type of SELF_SERVE_PLAN_TYPES) assert.equal(isSelfServePlanType(type), true);
  // "care" is deliberately not a flat self-serve type anymore -- it's tiered (Essential/Business/Pro,
  // maintenance_plan_templates), chosen with a templateId instead of a fixed catalog price.
  for (const bad of ["custom", "care", "", "CARE", "care ", null, undefined, 5, {}, "pending"]) {
    assert.equal(isSelfServePlanType(bad), false, String(bad));
  }
});

test("catalog amounts equal the prices published on the Pricing page", () => {
  const pricing = readFileSync("src/data/pricing.ts", "utf8");
  const published = {
    hosting: pricing.match(/hostingStartingPrice = "\$(\d+)"/)?.[1],
    seo_retainer: pricing.match(/seoRetainerStartingPrice = "\$(\d+)"/)?.[1],
  };
  for (const type of SELF_SERVE_PLAN_TYPES) {
    assert.ok(published[type], `no published price found for ${type}`);
    assert.equal(SELF_SERVE_PLANS[type].amountCents, Number(published[type]) * 100, `${type} price out of sync with pricing.ts`);
  }
});

test("catalog amounts are valid Stripe amounts and labels are non-empty", () => {
  for (const type of SELF_SERVE_PLAN_TYPES) {
    const plan = SELF_SERVE_PLANS[type];
    assert.ok(Number.isInteger(plan.amountCents) && plan.amountCents >= 50, type);
    assert.ok(plan.label.trim().length > 0, type);
  }
});

test("uuid check accepts real ids and rejects anything else", () => {
  assert.equal(isUuid("3f2b8c1e-5a4d-4c7b-9e21-0a1b2c3d4e5f"), true);
  for (const bad of ["", "not-a-uuid", "3f2b8c1e5a4d4c7b9e210a1b2c3d4e5f", null, undefined, 42, "3f2b8c1e-5a4d-4c7b-9e21-0a1b2c3d4e5f; drop table"]) {
    assert.equal(isUuid(bad), false, String(bad));
  }
});

test("database errors map to the codes the portal understands", () => {
  assert.equal(clientPlanErrorCode("NOT_LAUNCHED"), "not_launched");
  assert.equal(clientPlanErrorCode("ERROR: ALREADY_SUBSCRIBED"), "already_subscribed");
  assert.equal(clientPlanErrorCode("INVALID_PLAN_TYPE"), "invalid_plan_type");
  assert.equal(clientPlanErrorCode("NOT_FOUND"), "not_found");
  assert.equal(clientPlanErrorCode("something else entirely"), "server_error");
  assert.equal(clientPlanErrorCode(""), "server_error");
});
