/** What a team member fills in the first time they sign in, before they can work. */

export type StaffOnboarding = {
  userId: string;
  legalName: string;
  phone: string;
  emergencyName: string;
  emergencyPhone: string;
  zelleContact: string;
  paypalEmail: string;
  agreementVersion: string;
  signedName: string;
  agreementAcceptedAt: string;
  completedAt: string;
};

export type StaffOnboardingInput = {
  legalName: string;
  phone: string;
  emergencyName: string;
  emergencyPhone: string;
  zelleContact: string;
  paypalEmail: string;
  signedName: string;
  acknowledged: boolean;
};

export const AGREEMENT_VERSION = "2026-09-v1";

/**
 * The working agreement every team member accepts. The text they saw is stored with their acceptance, so a later
 * edit here never rewrites what someone agreed to. Have it reviewed before relying on it.
 */
export const AGREEMENT_TEXT = [
  "Working agreement between you and MotiveScripts.",
  "1. Confidentiality. You will keep private everything you learn about MotiveScripts and its clients: their plans, files, logins, customers and pricing. You will only use it to do your assigned work, during and after your time here.",
  "2. Client work. Everything you make for a client project belongs to MotiveScripts and the client, not to you. You will not reuse it, resell it or show it to anyone else without written permission.",
  "3. Access. Use the logins and files you are given only for your assigned projects. Do not share them, and tell us straight away if you think one has been exposed.",
  "4. Independent contractor. Unless MotiveScripts tells you otherwise in writing, you work as an independent contractor, are paid for the hours you log at your agreed rate, and are responsible for your own taxes.",
  "5. Honest hours. Log only time you actually worked on the task you log it against.",
  "6. Leaving. Either of us can end the arrangement at any time. When it ends, you will delete client files you hold and stop using any access.",
].join("\n\n");

export type OnboardingFieldErrors = Partial<Record<keyof StaffOnboardingInput, string>>;

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function squash(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/** The same checks the database makes, so people are told what to fix before they submit. */
export function validateOnboarding(input: StaffOnboardingInput): OnboardingFieldErrors {
  const errors: OnboardingFieldErrors = {};
  if (input.legalName.trim().length < 2) errors.legalName = "Enter your full legal name.";
  if (input.phone.trim().length < 5) errors.phone = "Enter a phone number we can reach you on.";
  if (!input.zelleContact.trim() && !input.paypalEmail.trim()) {
    errors.zelleContact = "Add a Zelle contact or a PayPal email so we can pay you.";
  }
  if (input.paypalEmail.trim() && !EMAIL_PATTERN.test(input.paypalEmail.trim())) {
    errors.paypalEmail = "That doesn’t look like an email address.";
  }
  if (input.emergencyPhone.trim() && !input.emergencyName.trim()) {
    errors.emergencyName = "Who should we call at that number?";
  }
  if (input.emergencyName.trim() && !input.emergencyPhone.trim()) {
    errors.emergencyPhone = "Add their phone number.";
  }
  if (squash(input.signedName) !== squash(input.legalName) || input.signedName.trim().length < 2) {
    errors.signedName = "Type your full legal name exactly as above to sign.";
  }
  if (!input.acknowledged) errors.acknowledged = "Tick the box to accept the agreement.";
  return errors;
}

export function onboardingErrorMessage(message: string): string {
  if (message.includes("NAME_REQUIRED")) return "Enter your full legal name.";
  if (message.includes("PHONE_REQUIRED")) return "Enter a phone number we can reach you on.";
  if (message.includes("PAYOUT_REQUIRED")) return "Add a Zelle contact or a PayPal email so we can pay you.";
  if (message.includes("PAYPAL_INVALID")) return "That PayPal email doesn’t look right.";
  if (message.includes("SIGNATURE_MISMATCH")) return "Type your full legal name exactly as above to sign.";
  if (message.includes("AGREEMENT_REQUIRED")) return "Accept the agreement to continue.";
  if (message.includes("Not allowed")) return "This account can’t complete onboarding.";
  return "We couldn’t save that. Try again in a moment.";
}

/** Whether to send someone to the onboarding page: staff (not admins) who have not finished it. */
export function needsOnboarding(role: string | null | undefined, completedAt: string | null | undefined): boolean {
  return role === "staff" && !completedAt;
}
