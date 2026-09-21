/**
 * Optional extra recipients ("Also send a copy to") for invoice emails. Kept deliberately small: at most
 * MAX_EXTRA_RECIPIENTS addresses, one plain email format, no display names. The email function
 * re-validates with the same rules (supabase/functions/_shared/emailRecipients.ts); this copy only
 * gives the admin immediate feedback.
 */
export const MAX_EXTRA_RECIPIENTS = 3;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ExtraRecipients = {
  /** Valid, lowercased, de-duplicated addresses (excluding ones the client already receives). */
  emails: string[];
  /** Entries that did not look like an email address, as typed. */
  invalid: string[];
  tooMany: boolean;
};

/** Splits a free-typed list on commas, semicolons, spaces, and newlines. */
export function parseExtraRecipients(raw: string, alreadyReceiving: string[] = []): ExtraRecipients {
  const skip = new Set(alreadyReceiving.map((email) => email.trim().toLowerCase()));
  const emails: string[] = [];
  const invalid: string[] = [];

  for (const token of raw.split(/[\s,;]+/).map((item) => item.trim()).filter(Boolean)) {
    const email = token.toLowerCase();
    if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
      invalid.push(token);
      continue;
    }
    if (skip.has(email) || emails.includes(email)) continue;
    emails.push(email);
  }

  return { emails, invalid, tooMany: emails.length > MAX_EXTRA_RECIPIENTS };
}

/** A user-facing problem with the typed list, or null when it is fine to send. */
export function extraRecipientsError(result: ExtraRecipients): string | null {
  if (result.invalid.length > 0) {
    return `This doesn’t look like an email address: ${result.invalid[0]}`;
  }
  if (result.tooMany) return `Add at most ${MAX_EXTRA_RECIPIENTS} extra addresses.`;
  return null;
}
