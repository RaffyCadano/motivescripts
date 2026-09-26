/**
 * The email copies of staff alerts, in four groups a person can switch off. Keep in step with
 * notification_email_category() in supabase/migrations/20261112000000_staff_email_alerts.sql, which decides
 * which notification types are emailed and in which group. Everything is on until someone switches it off.
 */
export type EmailAlertCategory = "money" | "client_activity" | "site_alerts" | "team_work";

export const emailAlertCategories: { key: EmailAlertCategory; label: string; description: string }[] = [
  {
    key: "money",
    label: "Money & paperwork",
    description: "A proposal or contract is accepted, an invoice is paid, or a payment is received.",
  },
  {
    key: "client_activity",
    label: "Client activity",
    description: "File feedback and approvals, new care requests, and a client's reply to an information request.",
  },
  {
    key: "site_alerts",
    label: "Site alerts",
    description: "A website is down or slow, a backup fails, a site is paused or unpaused, and domain or SSL renewals.",
  },
  {
    key: "team_work",
    label: "Team work",
    description: "A task is assigned to you or due or overdue, QA results, and payroll payments.",
  },
];

export type EmailAlertPreferenceMap = Record<EmailAlertCategory, boolean>;

export function defaultEmailAlertPreferences(): EmailAlertPreferenceMap {
  return { money: true, client_activity: true, site_alerts: true, team_work: true };
}

/** Merges saved rows over the defaults. Unknown categories are ignored. */
export function applyEmailAlertRows(rows: { category: string; enabled: boolean }[]): EmailAlertPreferenceMap {
  const map = defaultEmailAlertPreferences();
  for (const row of rows) {
    if (row.category in map) map[row.category as EmailAlertCategory] = row.enabled;
  }
  return map;
}
