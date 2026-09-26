// Staff onboarding: the answers that are checked, who can read or write the record, and where the gate sits.
//
//   node --test scripts/test-staff-onboarding.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { needsOnboarding, onboardingErrorMessage, validateOnboarding } from "../src/data/staffOnboarding.ts";

const sql = readFileSync("supabase/migrations/20261117000000_staff_onboarding.sql", "utf8");
const guards = readFileSync("src/auth/guards.tsx", "utf8");
const gate = readFileSync("src/auth/StaffOnboardingGate.tsx", "utf8");
const app = readFileSync("src/App.tsx", "utf8");

const good = {
  legalName: "Ana Reyes",
  phone: "336 555 0100",
  emergencyName: "",
  emergencyPhone: "",
  zelleContact: "ana@example.com",
  paypalEmail: "",
  signedName: "ana  reyes",
  acknowledged: true,
};

test("a complete form passes, and the signature only needs to match the name ignoring case and spacing", () => {
  assert.deepEqual(validateOnboarding(good), {});
});

test("each required answer is asked for", () => {
  assert.ok(validateOnboarding({ ...good, legalName: " " }).legalName);
  assert.ok(validateOnboarding({ ...good, phone: "12" }).phone);
  assert.ok(validateOnboarding({ ...good, zelleContact: "", paypalEmail: "" }).zelleContact);
  assert.ok(validateOnboarding({ ...good, acknowledged: false }).acknowledged);
  assert.ok(validateOnboarding({ ...good, signedName: "Someone Else" }).signedName);
  assert.ok(validateOnboarding({ ...good, signedName: "" }).signedName);
});

test("PayPal must be an email, and an emergency contact needs both a name and a number", () => {
  assert.ok(validateOnboarding({ ...good, paypalEmail: "not-an-email" }).paypalEmail);
  assert.deepEqual(validateOnboarding({ ...good, zelleContact: "", paypalEmail: "ana@paypal.com" }), {});
  assert.ok(validateOnboarding({ ...good, emergencyPhone: "555" }).emergencyName);
  assert.ok(validateOnboarding({ ...good, emergencyName: "Mum" }).emergencyPhone);
});

test("only team members who have not finished are sent to onboarding, never admins or clients", () => {
  assert.equal(needsOnboarding("staff", null), true);
  assert.equal(needsOnboarding("staff", "2026-09-26T00:00:00Z"), false);
  assert.equal(needsOnboarding("admin", null), false);
  assert.equal(needsOnboarding("client", null), false);
});

test("every refusal the database raises has its own message", () => {
  for (const code of ["NAME_REQUIRED", "PHONE_REQUIRED", "PAYOUT_REQUIRED", "PAYPAL_INVALID", "SIGNATURE_MISMATCH", "AGREEMENT_REQUIRED"]) {
    assert.ok(sql.includes(`'${code}'`), `${code} is not raised`);
    assert.notEqual(onboardingErrorMessage(`P0001: ${code}`), onboardingErrorMessage("something else"), code);
  }
});

test("the table can be read by the person and by admins, and written only through the functions", () => {
  assert.ok(sql.includes("using (public.is_admin() or user_id = auth.uid())"));
  assert.ok(sql.includes("revoke all on public.staff_onboarding from public, anon, authenticated"));
  assert.ok(sql.includes("grant select on public.staff_onboarding to authenticated"));
  assert.ok(!/grant (insert|update|delete)[^;]*staff_onboarding/i.test(sql));
  assert.ok(sql.includes("if not public.is_admin() then"), "the reset is admin only");
  assert.ok(!/grant execute[^;]*to anon/i.test(sql));
});

test("the gate sits inside the staff and admin guard, lets the onboarding page through, and never blocks admins", () => {
  assert.ok(guards.includes("<StaffOnboardingGate>{children}</StaffOnboardingGate>"));
  assert.ok(gate.includes("pathname !== ONBOARDING_PATH"));
  assert.ok(gate.includes('needsOnboarding("staff"'));
  assert.ok(app.includes('path="onboarding"'));
});

test("an invitation says how long it has left, and when it has run out", async () => {
  const { inviteExpiryLabel } = await import("../src/data/teamInvite.ts");
  const now = Date.parse("2026-09-26T12:00:00Z");
  assert.deepEqual(inviteExpiryLabel("2026-10-03T12:00:00Z", now), { text: "Expires in 7 days", expired: false });
  assert.deepEqual(inviteExpiryLabel("2026-09-26T20:00:00Z", now), { text: "Expires today", expired: false });
  assert.deepEqual(inviteExpiryLabel("2026-09-25T20:00:00Z", now), { text: "Expired yesterday", expired: true });
  assert.deepEqual(inviteExpiryLabel("2026-09-20T12:00:00Z", now), { text: "Expired 6 days ago", expired: true });
  assert.equal(inviteExpiryLabel("not a date", now).expired, false);
});
