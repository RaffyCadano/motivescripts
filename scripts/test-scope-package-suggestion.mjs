// The package staff are shown when a client chose "Not sure yet", worked out from the pages and features they picked.
//
//   node --test scripts/test-scope-package-suggestion.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { describePackageSuggestion, scopePackageHint, suggestProjectPackage } from "../src/data/scopePackageHint.ts";

test("a plain scope suggests Website", () => {
  assert.deepEqual(suggestProjectPackage(["Homepage", "Services", "About", "Contact"], ["Contact Form"]), { package: "website", reasons: [] });
  assert.deepEqual(suggestProjectPackage([], []), { package: "website", reasons: [] });
});

test("extra pages or booking and quote forms suggest Growth, and name what put it there", () => {
  assert.deepEqual(suggestProjectPackage(["Services", "Gallery / Portfolio"], []), { package: "growth", reasons: ["Gallery / Portfolio"] });
  assert.deepEqual(suggestProjectPackage(["FAQ"], ["Booking / Appointment Form"]), { package: "growth", reasons: ["FAQ", "Booking / Appointment Form"] });
  assert.equal(suggestProjectPackage([], ["Quote Request Form"]).package, "growth");
});

test("e-commerce or customer login suggests Custom, even alongside Growth items", () => {
  assert.deepEqual(suggestProjectPackage(["Gallery / Portfolio"], ["E-commerce / Online Store", "Booking / Appointment Form"]), {
    package: "custom",
    reasons: ["E-commerce / Online Store"],
  });
  assert.equal(suggestProjectPackage([], ["Customer Login"]).package, "custom");
});

test("the suggestion reads clearly, and agrees with the hint the client sees", () => {
  assert.equal(describePackageSuggestion({ package: "growth", reasons: ["FAQ", "Locations"] }), "Growth (FAQ, Locations)");
  assert.equal(describePackageSuggestion({ package: "website", reasons: [] }), "Website (no extra pages or forms)");
  // If the client had chosen the suggested package, the form would have nothing to warn about.
  for (const [pages, features] of [[["Gallery / Portfolio"], []], [[], ["Customer Login"]], [["Services"], []]]) {
    assert.equal(scopePackageHint(suggestProjectPackage(pages, features).package, pages, features), null);
  }
});
