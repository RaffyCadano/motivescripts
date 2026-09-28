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

test("permissions are grouped into one row per area, View before Manage", async () => {
  const { groupPermissions } = await import("../src/data/teamPermissions.ts");
  const groups = groupPermissions([
    { code: "leads.manage", label: "Manage leads" },
    { code: "leads.view", label: "View leads" },
    { code: "activity.view", label: "View activity" },
    { code: "feedback.manage", label: "Manage feedback" },
  ]);
  assert.deepEqual(groups.map((group) => group.title), ["Leads", "Activity", "Feedback"]);
  assert.deepEqual(groups[0].actions.map((action) => action.label), ["View", "Manage"]);
  assert.deepEqual(groups[0].actions.map((action) => action.code), ["leads.view", "leads.manage"]);
  assert.deepEqual(groupPermissions([]), []);
});

test("the onboarding page is a private path, so it is never indexed", async () => {
  const { privatePathPrefixes } = await import("../src/data/seoPages.ts");
  assert.ok(privatePathPrefixes.includes("/onboarding"));
});

test("the notification badge counts unread notifications beyond the loaded list", () => {
  const provider = readFileSync("src/providers/MessagingProvider.tsx", "utf8");
  const repo = readFileSync("src/data/messagingRepository.ts", "utf8");
  assert.ok(repo.includes('{ count: "exact", head: true }') && repo.includes('.is("read_at", null)'));
  assert.ok(provider.includes("+ unreadBeyondList"));
  assert.ok(!provider.includes("void fetchNotifications()"), "the realtime refresh must also use the counted loader");
});

test("background job failures are parsed safely, grouped per job, and only shown when there is a problem", async () => {
  const { parseBackgroundHealth, hasBackgroundProblems, groupFailures, jobLabel } = await import("../src/data/backgroundHealth.ts");
  assert.deepEqual(parseBackgroundHealth(null), { failures: [], failedCalls24h: 0 });
  assert.equal(hasBackgroundProblems(parseBackgroundHealth({ failures: [], failedCalls24h: 0 })), false);
  const health = parseBackgroundHealth({
    failures: [
      { job: "run_scope_reminder_sweep", message: "boom", created_at: "2026-09-25T10:00:00Z" },
      { job: "run_scope_reminder_sweep", message: "boom again", created_at: "2026-09-26T10:00:00Z" },
      { job: "notify_task_deadlines", message: "x", created_at: "2026-09-24T10:00:00Z" },
      { nope: true },
    ],
    failedCalls24h: "3",
  });
  assert.equal(health.failures.length, 3);
  assert.equal(health.failedCalls24h, 3);
  assert.equal(hasBackgroundProblems(health), true);
  const groups = groupFailures(health.failures);
  assert.deepEqual(groups.map((g) => [g.job, g.count]), [["run_scope_reminder_sweep", 2], ["notify_task_deadlines", 1]]);
  assert.equal(groups[0].latest.message, "boom again");
  assert.equal(jobLabel("run_scope_reminder_sweep"), "Scope reminder emails");
  assert.equal(jobLabel("some_new_job"), "some new job");
});

test("signing out clears the session together with the profile, so no fallback screen with a second Sign out button appears", () => {
  const auth = readFileSync("src/auth/AuthProvider.tsx", "utf8");
  const start = auth.indexOf("async signOut(scope)");
  const body = auth.slice(start, auth.indexOf("await supabase.auth.signOut", start));
  assert.ok(body.includes("setProfile(null)") && body.includes("setSession(null)"));
  assert.ok(body.indexOf("setSession(null)") < auth.indexOf("await supabase.auth.signOut", start));
});

test("stale-file errors are recognised and only trigger one automatic reload per 30 seconds", async () => {
  const { isChunkLoadError, canAutoReload } = await import("../src/lib/chunkReload.ts");
  assert.equal(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: https://x/assets/Foo-abc.js")), true);
  assert.equal(isChunkLoadError(new Error("error loading dynamically imported module")), true);
  assert.equal(isChunkLoadError("Importing a module script failed."), true);
  assert.equal(isChunkLoadError(new Error("Expected a JavaScript module script but the server responded with a MIME type of text/html")), true);
  assert.equal(isChunkLoadError(new Error("Cannot read properties of undefined (reading 'map')")), false);
  assert.equal(isChunkLoadError(null), false);
  assert.equal(canAutoReload(1000, null), true);
  assert.equal(canAutoReload(100_000, 90_000), false);
  assert.equal(canAutoReload(100_000, 60_000), true);
  assert.equal(canAutoReload(100_000, NaN), true);
});

test("the app is wrapped in an error boundary, and the auth start-up cannot wait forever", () => {
  const main = readFileSync("src/main.tsx", "utf8");
  const auth = readFileSync("src/auth/AuthProvider.tsx", "utf8");
  assert.ok(main.includes("<AppErrorBoundary>") && main.includes("vite:preloadError"));
  assert.ok(auth.includes("window.setTimeout(() => {") && auth.includes("12000") && auth.includes("clearTimeout(watchdog)"));
});

test("the Project Manager menu's four work items each open their own focused view", async () => {
  const { pmFocusFromHash, PM_FOCUS_VIEWS } = await import("../src/data/pmFocusViews.ts");
  for (const key of ["needs-attention", "today-work", "overdue", "reviews"]) {
    assert.equal(pmFocusFromHash(`#${key}`)?.key, key);
    assert.ok(PM_FOCUS_VIEWS[key].title && PM_FOCUS_VIEWS[key].description);
  }
  assert.equal(pmFocusFromHash(""), null);
  assert.equal(pmFocusFromHash("#upcoming"), null);
  assert.equal(pmFocusFromHash("#toString"), null);
  const nav = readFileSync("src/data/adminNav.ts", "utf8");
  for (const key of ["needs-attention", "today-work", "overdue", "reviews"]) assert.ok(nav.includes(`/admin#${key}`), key);
});

test("PM chart numbers: status counts in workflow order, a week of due dates with overdue first, and least-finished projects on top", async () => {
  const { taskStatusCounts, workloadByDay, projectProgressRows } = await import("../src/data/pmCharts.ts");
  const counts = taskStatusCounts([{ status: "Todo" }, { status: "Todo" }, { status: "Completed" }, { status: "Blocked" }]);
  assert.deepEqual(counts.map((c) => [c.status, c.count]), [["Todo", 2], ["In Progress", 0], ["In Review", 0], ["Completed", 1], ["Blocked", 1]]);

  const now = new Date(2026, 8, 28, 15, 0); // Mon Sep 28, 2026, mid-afternoon
  const bars = workloadByDay(
    [
      { status: "Todo", dueDate: "2026-09-20" },        // overdue
      { status: "In Progress", dueDate: "2026-09-27" },  // overdue
      { status: "Completed", dueDate: "2026-09-10" },    // finished, ignored
      { status: "Todo", dueDate: "2026-09-28" },         // today
      { status: "Todo", dueDate: "2026-09-28" },
      { status: "Blocked", dueDate: "2026-09-30" },
      { status: "Todo", dueDate: "2026-10-05" },         // beyond the week
      { status: "Todo", dueDate: "" },                   // no date, ignored
    ],
    now,
  );
  assert.equal(bars.length, 8);
  assert.deepEqual(bars.map((b) => b.label), ["Late", "Today", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  assert.deepEqual(bars.map((b) => b.count), [2, 2, 0, 1, 0, 0, 0, 0]);
  assert.equal(bars[1].kind, "today");
  assert.equal(bars[0].kind, "overdue");

  const rows = projectProgressRows([
    { id: "a", name: "Alpha", status: "In Development", tasks: [{ status: "Completed" }, { status: "Todo" }] },
    { id: "b", name: "Beta", status: "In Development", tasks: [{ status: "Todo" }] },
    { id: "c", name: "Done", status: "Completed", tasks: [{ status: "Completed" }] },
    { id: "d", name: "Old", status: "In Development", archived: true, tasks: [] },
    { id: "e", name: "Empty", status: "Planning", tasks: [] },
  ]);
  assert.deepEqual(rows.map((r) => [r.name, r.percent]), [["Beta", 0], ["Empty", 0], ["Alpha", 50]]);
});

test("tile change badges show a plain change when the count started small, and a percent otherwise", async () => {
  const { trendChange } = await import("../src/data/overviewExtras.ts");
  assert.equal(trendChange([1]), null);
  assert.deepEqual(trendChange([1, 1, 7]), { direction: "up", label: "+6" });
  assert.deepEqual(trendChange([1, 2]), { direction: "up", label: "+1" });
  assert.deepEqual(trendChange([0, 3]), { direction: "up", label: "+3" });
  assert.deepEqual(trendChange([4, 2]), { direction: "down", label: "−2" });
  assert.deepEqual(trendChange([10, 15]), { direction: "up", label: "+50%" });
  assert.deepEqual(trendChange([20, 15]), { direction: "down", label: "−25%" });
  assert.deepEqual(trendChange([3, 3]), { direction: "flat", label: "0" });
});

test("this month's revenue counts only this calendar month", async () => {
  const { revenueForMonth } = await import("../src/data/overviewExtras.ts");
  const now = new Date(2026, 8, 26);
  assert.equal(
    revenueForMonth(
      [
        { amountCents: 10000, paymentDate: "2026-09-01" },
        { amountCents: 5000, paymentDate: "2026-09-25T10:00:00Z" },
        { amountCents: 99900, paymentDate: "2026-08-31" },
        { amountCents: 99900, paymentDate: "2025-09-15" },
      ],
      now,
    ),
    15000,
  );
});

test("waiting on clients lists the longest waits first and only what is really stuck", async () => {
  const { buildWaitingOnClients } = await import("../src/data/overviewExtras.ts");
  const now = new Date(2026, 8, 26, 12);
  const { items, counts } = buildWaitingOnClients(
    {
      clients: [
        { id: "c1", businessName: "Bravo Bakery", status: "Active", createdAt: "2026-09-01T00:00:00Z" },
        { id: "c2", businessName: "Acme Co", status: "Active", createdAt: "2026-09-20T00:00:00Z" },
        { id: "c3", businessName: "Old Client", status: "Archived", createdAt: "2026-01-01T00:00:00Z" },
        { id: "c4", businessName: "Has Project", status: "Active", createdAt: "2026-01-01T00:00:00Z" },
      ],
      projects: [{ clientId: "c4" }],
      briefs: [{ clientId: "c2", submittedAt: null, updatedAt: "2026-09-22T12:00:00" }],
      proposals: [
        { id: "p1", clientId: "c1", number: "P-1", effectiveStatus: "sent", sentAt: "2026-09-10T12:00:00", createdAt: "2026-09-09T00:00:00Z" },
        { id: "p2", clientId: "c1", number: "P-2", effectiveStatus: "accepted", sentAt: "2026-09-01T12:00:00", createdAt: "2026-09-01T00:00:00Z" },
        { id: "p3", clientId: "c1", number: "P-3", effectiveStatus: "draft", sentAt: null, createdAt: "2026-09-01T00:00:00Z" },
      ],
      contracts: [{ id: "k1", clientId: "c4", number: "C-1", effectiveStatus: "viewed", sentAt: null, createdAt: "2026-09-24T12:00:00" }],
      invoices: [
        { id: "i1", clientId: "c1", number: "INV-1", effectiveStatus: "overdue", issueDate: "2026-08-20", createdAt: "2026-08-20T00:00:00Z" },
        { id: "i2", clientId: "c1", number: "INV-2", effectiveStatus: "paid", issueDate: "2026-08-01", createdAt: "2026-08-01T00:00:00Z" },
      ],
    },
    now,
  );
  assert.deepEqual(counts, { proposal: 1, contract: 1, invoice: 1, scope: 2 });
  assert.deepEqual(items.map((i) => [i.label, i.clientName, i.days]), [
    ["Invoice INV-1", "Bravo Bakery", 37],
    // c1's createdAt ("2026-09-01T00:00:00Z") is Aug 31, 8pm America/New_York -- one calendar day
    // earlier locally than its UTC date -- so the correct count from local midnight to local
    // midnight is 26, not 25 (25 was the old, buggy raw-elapsed-time count from before daysSince
    // was fixed to compare local calendar days instead of full 24-hour periods).
    ["Scope form not started", "Bravo Bakery", 26],
    ["Proposal P-1", "Bravo Bakery", 16],
    ["Scope form started, not finished", "Acme Co", 4],
    ["Contract C-1", "Has Project", 2],
  ]);
  assert.equal(items[0].href, "/admin/invoices/i1");
});

test("website overview separates paused sites and ranks the ones with problems", async () => {
  const { websiteOverview, upcomingRenewals } = await import("../src/data/overviewExtras.ts");
  const o = websiteOverview([
    { id: "a", name: "Alpha", clientName: "A", paused: false, state: "healthy" },
    { id: "b", name: "Bravo", clientName: "B", paused: false, state: "degraded" },
    { id: "c", name: "Charlie", clientName: "C", paused: false, state: "down" },
    { id: "d", name: "Delta", clientName: "D", paused: true, state: "down" },
    { id: "e", name: "Echo", clientName: "E", paused: false, state: "unknown" },
  ]);
  assert.deepEqual([o.total, o.healthy, o.degraded, o.down, o.unknown, o.paused], [5, 1, 1, 1, 1, 1]);
  assert.deepEqual(o.issues.map((s) => s.name), ["Charlie", "Bravo"]);

  const r = upcomingRenewals(
    [
      { id: "1", domain: "soon.com", status: "active", domainExpiresAt: "2026-10-03", sslExpiresAt: "2027-01-01" },
      { id: "2", domain: "late.com", status: "past_due", domainExpiresAt: "2026-09-20", sslExpiresAt: null },
      { id: "3", domain: "gone.com", status: "canceled", domainExpiresAt: "2026-09-30", sslExpiresAt: null },
      { id: "4", domain: "far.com", status: "active", domainExpiresAt: "2027-06-01", sslExpiresAt: "2026-10-20" },
    ],
    new Date(2026, 8, 26, 9),
  );
  assert.deepEqual(r.map((x) => [x.domain, x.kind, x.daysLeft]), [["late.com", "Domain", -6], ["soon.com", "Domain", 7], ["far.com", "SSL", 24]]);
});
