/**
 * The checklist of third-party accounts a client needs for their project (Vercel, GitHub, Supabase, their business
 * email, a domain registrar) and whether they've been invited yet. Deliberately has no password field -- the app's
 * own guidance is to add the client as a collaborator on each service under their own email, never to share a login.
 */

export const clientAccountServices = ["vercel", "github", "supabase", "email", "domain", "other"] as const;
export type ClientAccountService = (typeof clientAccountServices)[number];

export const clientAccountStatuses = ["needs_invite", "invited", "active"] as const;
export type ClientAccountStatus = (typeof clientAccountStatuses)[number];

export type ClientProjectAccount = {
  id: string;
  projectId: string;
  service: ClientAccountService;
  label: string;
  loginUrl: string;
  username: string;
  status: ClientAccountStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ClientProjectAccountDraft = {
  service: ClientAccountService;
  label: string;
  loginUrl: string;
  username: string;
  status: ClientAccountStatus;
  notes: string;
};

export const emptyClientProjectAccountDraft: ClientProjectAccountDraft = {
  service: "vercel",
  label: "",
  loginUrl: "",
  username: "",
  status: "needs_invite",
  notes: "",
};

const SERVICE_LABELS: Record<ClientAccountService, string> = {
  vercel: "Vercel",
  github: "GitHub",
  supabase: "Supabase",
  email: "Email",
  domain: "Domain registrar",
  other: "Other",
};

export function clientAccountServiceLabel(service: ClientAccountService): string {
  return SERVICE_LABELS[service];
}

/** What to show as the row's name: the label if one was given, else the plain service name. */
export function clientAccountDisplayName(account: Pick<ClientProjectAccount, "service" | "label">): string {
  return account.label.trim() || clientAccountServiceLabel(account.service);
}

const STATUS_LABELS: Record<ClientAccountStatus, string> = {
  needs_invite: "Needs invite",
  invited: "Invited",
  active: "Active",
};

export function clientAccountStatusLabel(status: ClientAccountStatus): string {
  return STATUS_LABELS[status];
}

/** A row needs an invite link, a username, or at least a name to go on -- never all blank. */
export function validateClientProjectAccountDraft(draft: ClientProjectAccountDraft): string | null {
  if (draft.service === "other" && !draft.label.trim()) return "Name this account so you know what it is.";
  if (!draft.loginUrl.trim() && !draft.username.trim() && !draft.label.trim()) {
    return "Add a login link, a username, or a name.";
  }
  return null;
}

/** Not-yet-invited first, then invited, then active -- the ones needing action float to the top. */
const STATUS_ORDER: Record<ClientAccountStatus, number> = { needs_invite: 0, invited: 1, active: 2 };

export function sortClientProjectAccounts(accounts: ClientProjectAccount[]): ClientProjectAccount[] {
  return [...accounts].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || clientAccountDisplayName(a).localeCompare(clientAccountDisplayName(b)),
  );
}
