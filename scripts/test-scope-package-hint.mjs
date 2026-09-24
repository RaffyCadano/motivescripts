// Tests for the scope form's package hint (src/data/scopePackageHint.ts).
//
//   node --test scripts/test-scope-package-hint.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { scopePackageHint } from "../src/data/scopePackageHint.ts";

test("no package chosen means no hint", () => {
  assert.equal(scopePackageHint(null, ["FAQ"], ["Customer Login"]), null);
});

test("Website with only base pages and a contact form is fine", () => {
  assert.equal(scopePackageHint("website", ["Services", "About", "Contact"], ["Contact Form"]), null);
});

test("Website plus extra pages or booking/quote forms points at Growth", () => {
  for (const [pages, features] of [[["Gallery / Portfolio"], []], [["FAQ"], []], [["Locations"], []], [[], ["Booking / Appointment Form"]], [[], ["Quote Request Form"]]]) {
    assert.match(scopePackageHint("website", pages, features), /Growth/);
  }
});

test("Growth is fine with extra pages and booking forms", () => {
  assert.equal(scopePackageHint("growth", ["FAQ", "Locations"], ["Booking / Appointment Form"]), null);
});

test("e-commerce and customer login point at Custom for Website and Growth, and are fine on Custom", () => {
  for (const feature of ["E-commerce / Online Store", "Customer Login"]) {
    assert.match(scopePackageHint("website", [], [feature]), /Custom/);
    assert.match(scopePackageHint("growth", [], [feature]), /Custom/);
    assert.equal(scopePackageHint("custom", [], [feature]), null);
  }
});

test("the Custom hint wins over the Growth hint", () => {
  assert.match(scopePackageHint("website", ["FAQ"], ["Customer Login"]), /Custom/);
});
