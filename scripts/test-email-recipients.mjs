// Tests for the invoice "Also send a copy to" validation: the browser-side parser
// (src/data/emailRecipients.ts) and the strict server-side validator used by document-email
// (supabase/functions/_shared/emailRecipients.ts).
//
//   node --test scripts/test-email-recipients.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_EXTRA_RECIPIENTS,
  extraRecipientsError,
  parseExtraRecipients,
} from "../src/data/emailRecipients.ts";
import { validateExtraRecipients } from "../supabase/functions/_shared/emailRecipients.ts";

test("browser parser splits on commas, semicolons, spaces and newlines, lowercases, and de-duplicates", () => {
  const result = parseExtraRecipients("Accountant@Example.com; you@motivescripts.com,\naccountant@example.com  third@x.io");
  assert.deepEqual(result.emails, ["accountant@example.com", "you@motivescripts.com", "third@x.io"]);
  assert.deepEqual(result.invalid, []);
  assert.equal(result.tooMany, false);
  assert.equal(extraRecipientsError(result), null);
});

test("browser parser skips addresses the client already receives", () => {
  const result = parseExtraRecipients("client@biz.com, extra@biz.com", ["Client@Biz.com"]);
  assert.deepEqual(result.emails, ["extra@biz.com"]);
});

test("browser parser reports invalid entries and too many addresses", () => {
  const bad = parseExtraRecipients("nope, a@b.com, @x.com, y@z");
  assert.deepEqual(bad.invalid, ["nope", "@x.com", "y@z"]);
  assert.match(extraRecipientsError(bad), /nope/);

  const many = parseExtraRecipients("a@x.com b@x.com c@x.com d@x.com");
  assert.equal(many.tooMany, true);
  assert.match(extraRecipientsError(many), new RegExp(String(MAX_EXTRA_RECIPIENTS)));

  assert.equal(parseExtraRecipients("").emails.length, 0, "empty input means no extras");
  assert.equal(extraRecipientsError(parseExtraRecipients("   ")), null);
});

test("server: no extras is fine, up to 3 valid addresses are accepted and normalized", () => {
  assert.deepEqual(validateExtraRecipients(undefined), { ok: true, emails: [] });
  assert.deepEqual(validateExtraRecipients(null), { ok: true, emails: [] });
  assert.deepEqual(validateExtraRecipients([]), { ok: true, emails: [] });
  assert.deepEqual(validateExtraRecipients(["  A@B.com ", "a@b.com", "c@d.org"]), { ok: true, emails: ["a@b.com", "c@d.org"] });
});

test("server rejects anything unexpected instead of trimming it", () => {
  const rejected = [
    ["a@b.com", "c@d.com", "e@f.com", "g@h.com"], // more than 3
    "a@b.com", // not an array
    { 0: "a@b.com" },
    [42],
    [null],
    [""],
    ["   "],
    ["a@b"],
    ["a b@c.com"],
    ["a@b.com,c@d.com"], // two addresses in one entry
    ["a@b.com;c@d.com"],
    ["<a@b.com>"],
    ["a@b.com\nBcc: victim@x.com"], // header-injection shape
    ["a@b.com\r\nTo: victim@x.com"],
    ["x".repeat(250) + "@b.com"],
  ];
  for (const input of rejected) {
    assert.deepEqual(validateExtraRecipients(input), { ok: false }, `should reject ${JSON.stringify(input).slice(0, 60)}`);
  }
});

test("anything the browser accepts, the server accepts (no surprise failures after Send)", () => {
  const samples = ["a@b.com", "first.last@sub.example.co.uk", "user+tag@example.com", "UPPER@CASE.COM", "a_b-c@d-e.io"];
  for (const sample of samples) {
    const parsed = parseExtraRecipients(sample);
    assert.equal(parsed.invalid.length, 0, sample);
    assert.equal(validateExtraRecipients(parsed.emails).ok, true, `server rejected browser-approved ${sample}`);
  }
});
