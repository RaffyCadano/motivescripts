// Tests for the Vercel pause/unpause helper (supabase/functions/_shared/vercelSite.ts). No network: fetch is stubbed.
//
//   node --test scripts/test-vercel-site.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { controlVercelProject, isSafeVercelId, vercelProjectLookupUrl, vercelSiteUrl } from "../supabase/functions/_shared/vercelSite.ts";

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

test("the lookup URL accepts a name and the right team parameter", () => {
  assert.equal(vercelProjectLookupUrl("site"), "https://api.vercel.com/v9/projects/site");
  assert.equal(vercelProjectLookupUrl("site", "team_abc"), "https://api.vercel.com/v9/projects/site?teamId=team_abc");
});

test("a project id (prj_) is used directly: one POST with the bearer token", async () => {
  const seen = [];
  const result = await controlVercelProject({
    token: "tok",
    action: "pause",
    projectId: "prj_abc123",
    fetchFn: async (url, init) => {
      seen.push({ url, init });
      return okResponse();
    },
  });
  assert.equal(result.ok, true);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].init.method, "POST");
  assert.equal(seen[0].init.headers.Authorization, "Bearer tok");
  assert.match(seen[0].url, /projects\/prj_abc123\/pause$/);
});

test("a project NAME is looked up first, then paused by the id Vercel returns", async () => {
  const seen = [];
  const result = await controlVercelProject({
    token: "tok",
    action: "unpause",
    projectId: "my-site",
    teamId: "team_abc",
    fetchFn: async (url, init) => {
      seen.push({ url, method: init.method });
      return init.method === "GET" ? new Response(JSON.stringify({ id: "prj_real123" }), { status: 200 }) : okResponse();
    },
  });
  assert.equal(result.ok, true);
  assert.equal(seen.length, 2);
  assert.equal(seen[0].method, "GET");
  assert.match(seen[0].url, /v9\/projects\/my-site\?teamId=team_abc$/);
  assert.equal(seen[1].method, "POST");
  assert.match(seen[1].url, /projects\/prj_real123\/unpause\?teamId=team_abc$/);
});

test("a name Vercel cannot find, or a bad token, stops at the lookup and says why", async () => {
  let calls = 0;
  const notFound = await controlVercelProject({
    token: "tok",
    action: "pause",
    projectId: "nope",
    fetchFn: async () => {
      calls++;
      return errResponse(404, "Project not found");
    },
  });
  assert.equal(notFound.ok, false);
  assert.match(notFound.message, /404/);
  assert.equal(calls, 1);
  const badToken = await controlVercelProject({ token: "bad", action: "pause", projectId: "nope", fetchFn: async () => errResponse(403, "Not authorized") });
  assert.match(badToken.message, /403/);
});

test("a Vercel error is reported with its message", async () => {
  const result = await controlVercelProject({
    token: "tok",
    action: "pause",
    projectId: "prj_site1",
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
    projectId: "prj_site1",
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
