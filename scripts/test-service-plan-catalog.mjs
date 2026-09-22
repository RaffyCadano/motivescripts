// Tests for the client self-serve helpers (supabase/functions/_shared/servicePlanCatalog.ts).
//
//   node --test scripts/test-service-plan-catalog.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { clientPlanErrorCode, isUuid } from "../supabase/functions/_shared/servicePlanCatalog.ts";

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
