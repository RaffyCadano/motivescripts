import { emailAlertCategories } from "@/data/emailAlertPreferences";

/** One alert email sent to a team member, from staff_email_log (written by the document-email function). */
export type StaffEmailLogEntry = {
  id: string;
  type: string;
  category: string;
  subject: string;
  toEmail: string;
  providerId: string | null;
  createdAt: string;
};

/** The alert group an email belonged to, as the person sees it on their profile. */
export function staffEmailGroupLabel(category: string): string {
  return emailAlertCategories.find((item) => item.key === category)?.label ?? category.replace(/_/g, " ");
}
