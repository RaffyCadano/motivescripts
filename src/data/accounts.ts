/** One login on the Accounts page, from admin_list_accounts(). */
export type AccountRow = {
  userId: string;
  email: string;
  fullName: string;
  role: "admin" | "staff" | "client";
  templateKey: string | null;
  isActive: boolean;
  clientId: string | null;
  businessName: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  hasActivePlan: boolean;
  isSelf: boolean;
};

/** A row of account_deletions: who was deleted, and by whom. */
export type AccountDeletion = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  businessName: string | null;
  deletedByEmail: string | null;
  createdAt: string;
};

const TEMPLATE_LABELS: Record<string, string> = {
  admin: "Admin",
  staff: "Staff",
  project_manager: "Project Manager",
  developer: "Developer",
  designer: "Designer",
  content_writer: "Content Writer",
  team_member: "Team Member",
  sales: "Sales",
  accounting: "Accounting",
};

/** "Client", "Admin", "Developer"... */
export function accountRoleLabel(account: Pick<AccountRow, "role" | "templateKey">): string {
  if (account.role === "client") return "Client";
  if (account.role === "admin") return "Admin";
  return (account.templateKey && TEMPLATE_LABELS[account.templateKey]) || "Staff";
}

/** Why deleting an account was refused, in words for the admin. Unknown errors get the fallback. */
export function deleteAccountErrorMessage(message: string | null | undefined): string {
  const text = message ?? "";
  if (text.includes("CONFIRMATION_REQUIRED")) return "Type the account's email exactly to confirm.";
  if (text.includes("CANNOT_DELETE_SELF")) return "You can't delete your own account.";
  if (text.includes("LAST_ADMIN")) return "This is the last active admin. Add or activate another admin first.";
  if (text.includes("ACTIVE_PLAN")) return "This client still has an active Website Care plan. Cancel the plan first.";
  if (text.includes("HAS_RECORDS")) return "Other records still depend on this account, so it can't be deleted. Deactivate it instead.";
  if (text.includes("NOT_FOUND")) return "That account no longer exists.";
  if (text.includes("Not allowed")) return "You don't have permission to delete accounts.";
  return "Unable to delete this account.";
}
