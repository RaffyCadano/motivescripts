// The Active sessions list in the client Settings: turning a user-agent into "Chrome on Windows", and the
// functions that expose only the caller's own sessions.
//
//   node --test scripts/test-auth-sessions.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { describeUserAgent } from "../src/data/authSessions.ts";

test("common browsers and systems are named", () => {
  assert.equal(describeUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"), "Chrome on Windows");
  assert.equal(describeUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0"), "Edge on Windows");
  assert.equal(describeUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"), "Safari on macOS");
  assert.equal(describeUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1"), "Safari on iOS");
  assert.equal(describeUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/120.0 Mobile/15E148 Safari/604.1"), "Chrome on iOS");
  assert.equal(describeUserAgent("Mozilla/5.0 (Android 14; Mobile; rv:121.0) Gecko/121.0 Firefox/121.0"), "Firefox on Android");
  assert.equal(describeUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36 OPR/106.0"), "Opera on Linux");
});

test("nothing to go on is said plainly", () => {
  assert.equal(describeUserAgent(""), "Unknown device");
  assert.equal(describeUserAgent(null), "Unknown device");
  assert.equal(describeUserAgent("curl/8.0"), "Unknown device");
});

test("the session functions only ever touch the caller's own sessions, and never the one in use", () => {
  const sql = readFileSync("supabase/migrations/20261114000000_my_auth_sessions.sql", "utf8");
  assert.ok(sql.includes("where s.user_id = auth.uid()"));
  assert.ok(sql.includes("delete from auth.sessions where id = p_session_id and user_id = auth.uid()"));
  assert.ok(sql.includes("CURRENT_SESSION"));
  assert.ok(sql.includes("revoke all on function public.my_auth_sessions() from public, anon"));
  assert.ok(!/grant execute[^;]*to anon/i.test(sql));
});
