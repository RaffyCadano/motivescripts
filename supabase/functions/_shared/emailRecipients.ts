/**
 * Server-side validation of the optional "Also send a copy to" list on invoice emails. Free of Deno
 * APIs so it can be unit-tested in Node. Mirrors src/data/emailRecipients.ts, but is strict: anything
 * unexpected is rejected rather than trimmed, because these addresses receive a financial document.
 */
export const MAX_EXTRA_RECIPIENTS = 3;

const EMAIL_PATTERN = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

export type ExtraRecipientsResult = { ok: true; emails: string[] } | { ok: false };

/** `undefined`/`null` means "no extras". Otherwise it must be an array of up to 3 valid email strings. */
export function validateExtraRecipients(input: unknown): ExtraRecipientsResult {
  if (input === undefined || input === null) return { ok: true, emails: [] };
  if (!Array.isArray(input) || input.length > MAX_EXTRA_RECIPIENTS) return { ok: false };

  const emails: string[] = [];
  for (const item of input) {
    if (typeof item !== "string") return { ok: false };
    const email = item.trim().toLowerCase();
    if (email.length === 0 || email.length > 254 || !EMAIL_PATTERN.test(email)) return { ok: false };
    if (!emails.includes(email)) emails.push(email);
  }
  return { ok: true, emails };
}
