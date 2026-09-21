// Tests for the notification-preference helpers, plus a check that the front-end event list and the SQL
// type-to-event mapping (supabase/migrations/20261001000000_notification_preferences.sql) agree.
//
//   node --test scripts/test-notification-preferences.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  applyNotificationPreferenceRows,
  defaultNotificationPreferences,
  notificationEvents,
} from "../src/data/notificationPreferences.ts";

test("every event defaults to on, so nobody loses notifications when this ships", () => {
  const defaults = defaultNotificationPreferences();
  assert.equal(Object.keys(defaults).length, notificationEvents.length);
  assert.ok(Object.values(defaults).every((value) => value === true));
});

test("saved rows override the defaults; unknown events are ignored", () => {
  const map = applyNotificationPreferenceRows([
    { event: "invoice_paid", in_app: false },
    { event: "new_message", in_app: true },
    { event: "not_an_event", in_app: false },
  ]);
  assert.equal(map.invoice_paid, false);
  assert.equal(map.new_message, true);
  assert.equal(map.proposal_accepted, true);
  assert.ok(!("not_an_event" in map));
});

test("the eight events the Settings screen shows match the ones the database accepts", () => {
  const sql = readFileSync("supabase/migrations/20261001000000_notification_preferences.sql", "utf8");
  const checkBlock = sql.match(/event text not null check \(event in \(([\s\S]*?)\)\)/)?.[1] ?? "";
  const sqlEvents = [...checkBlock.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]).sort();
  const uiEvents = notificationEvents.map((event) => event.key).sort();
  assert.deepEqual(uiEvents, sqlEvents);
  assert.equal(uiEvents.length, 8);
});

test("every event has a notification type mapped to it in SQL, and 'lead_submitted' is an allowed type", () => {
  const sql = readFileSync("supabase/migrations/20261001000000_notification_preferences.sql", "utf8");
  const mapping = sql.match(/create or replace function public\.notification_event_for_type[\s\S]*?end;\s*\$\$;/)?.[0] ?? "";
  for (const event of notificationEvents) {
    assert.ok(mapping.includes(`then '${event.key}'`), `no notification type maps to ${event.key}`);
  }
  assert.match(sql, /'project_completed', 'lead_submitted'/);
});

test("the client-side lead notification type and link exist", () => {
  assert.match(readFileSync("src/types/database.ts", "utf8"), /"lead_submitted"/);
  assert.match(readFileSync("src/data/messaging.ts", "utf8"), /case "lead_submitted"/);
});
