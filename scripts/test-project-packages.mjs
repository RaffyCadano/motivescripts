// Tests for the project package rules (src/data/projectPackages.ts): who gets the full client portal.
//
//   node --test scripts/test-project-packages.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { clientHasFullPortal, isProjectPackage, projectPackageLabels, projectPackages } from "../src/data/projectPackages.ts";

const project = (pkg, archived = false) => ({ package: pkg, archived });

test("the three packages match the Pricing page tier ids", () => {
  assert.deepEqual([...projectPackages], ["website", "growth", "custom"]);
  assert.deepEqual(Object.keys(projectPackageLabels), ["website", "growth", "custom"]);
});

test("isProjectPackage accepts only the three ids", () => {
  for (const value of projectPackages) assert.equal(isProjectPackage(value), true);
  for (const value of [null, undefined, "", "Website", "pro", 1]) assert.equal(isProjectPackage(value), false);
});

test("a client with only Website-package projects gets the essentials", () => {
  assert.equal(clientHasFullPortal([project("website")]), false);
  assert.equal(clientHasFullPortal([project("website"), project("website")]), false);
});

test("any Growth or Custom project gives the full portal", () => {
  assert.equal(clientHasFullPortal([project("growth")]), true);
  assert.equal(clientHasFullPortal([project("custom")]), true);
  assert.equal(clientHasFullPortal([project("website"), project("growth")]), true);
});

test("a project with no package (every project from before packages) keeps the full portal", () => {
  assert.equal(clientHasFullPortal([project(null)]), true);
  assert.equal(clientHasFullPortal([project("website"), project(null)]), true);
});

test("archived projects don't count, and no active project means the full portal", () => {
  assert.equal(clientHasFullPortal([project("website"), project("growth", true)]), false);
  assert.equal(clientHasFullPortal([project("website", true), project("growth")]), true);
  assert.equal(clientHasFullPortal([]), true);
  assert.equal(clientHasFullPortal([project("website", true)]), true);
});
