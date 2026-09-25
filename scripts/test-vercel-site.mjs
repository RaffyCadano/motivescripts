// Tests for the Vercel pause/unpause helper (supabase/functions/_shared/vercelSite.ts). No network: fetch is stubbed.
//
//   node --test scripts/test-vercel-site.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { controlVercelProject, isSafeVercelId, vercelSiteUrl } from "../supabase/functions/_shared/vercelSite.ts";

const okResponse = () => new Response("{}", { status: 200 });
const errResponse = (status, message) => new Response(JSON.stringify({ error: { message } }), { status });

test("only safe ids are accepted", () => {
  for (const good of ["unlistedgarage", "my-site_1.0", "prj_abc123"]) assert.equal(isSafeVercelId(good), true);
  for (const bad of ["", "a/b", "../x", "a b", "a?b=c", "x".repeat(101), null, undefined, 5]) assert.equal(isSafeVercelId(bad), false);
});

test("the URL uses the pause / unpause endpoint and the right team parameter", () => {
  assert.equal(vercelSiteUrl("pause", "site"), "https://api.vercel.com/v1/projects/site/pause");
  assert.equal(vercelSiteUrl("unpause", "site"), "https://api.vercel.com/v1/projects/site/unpause");
  assert.equal(vercelSiteUrl("pause", "site", "team_abc"), "https://api.vercel.com/v1/projects/site/pause?teamId=team_abc");
  assert.equal(vercelSiteUrl("pause", "site", "my-team"), "https://api.vercel.com/v1/projects/site/pause?slug=my-team");
});

test("a successful call sends a POST with the bearer token", async () => {
  let seen;
  const result = await controlVercelProject({
    token: "tok",
    action: "pause",
    projectId: "site",
    fetchFn: async (url, init) => {
      seen = { url, init };
      return okResponse();
    },
  });
  assert.equal(result.ok, true);
  assert.equal(seen.init.method, "POST");
  assert.equal(seen.init.headers.Authorization, "Bearer tok");
  assert.match(seen.url, /\/pause$/);
});

test("a Vercel error is reported with its message", async () => {
  const result = await controlVercelProject({
    token: "tok",
    action: "pause",
    projectId: "site",
    fetchFn: async () => errResponse(403, "Not authorized"),
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /403/);
  assert.match(result.message, /Not authorized/);
});

test("a network failure is reported, not thrown", async () => {
  const result = await controlVercelProject({
    token: "tok",
    action: "unpause",
    projectId: "site",
    fetchFn: async () => {
      throw new Error("boom");
    },
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /reach Vercel/);
});

test("no token, or an unsafe id, never calls Vercel", async () => {
  let calls = 0;
  const fetchFn = async () => {
    calls++;
    return okResponse();
  };
  assert.equal((await controlVercelProject({ token: undefined, action: "pause", projectId: "site", fetchFn })).ok, false);
  assert.equal((await controlVercelProject({ token: "tok", action: "pause", projectId: "../evil", fetchFn })).ok, false);
  assert.equal((await controlVercelProject({ token: "tok", action: "pause", projectId: "site", teamId: "a/b", fetchFn })).ok, false);
  assert.equal(calls, 0);
});
