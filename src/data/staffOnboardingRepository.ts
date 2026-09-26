import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AGREEMENT_TEXT,
  AGREEMENT_VERSION,
  onboardingErrorMessage,
  type StaffOnboarding,
  type StaffOnboardingInput,
} from "@/data/staffOnboarding";
import { AgencyDbError } from "@/lib/dbErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

type OnboardingRow = {
  user_id: string;
  legal_name: string;
  phone: string;
  emergency_name: string;
  emergency_phone: string;
  zelle_contact: string;
  paypal_email: string;
  agreement_version: string;
  signed_name: string;
  agreement_accepted_at: string;
  completed_at: string;
};

const COLUMNS =
  "user_id, legal_name, phone, emergency_name, emergency_phone, zelle_contact, paypal_email, agreement_version, signed_name, agreement_accepted_at, completed_at";

function requireClient(): SupabaseClient {
  if (!isSupabaseConfigured()) throw new AgencyDbError("Supabase is not configured.");
  const client = getSupabase() as SupabaseClient | null;
  if (!client) throw new AgencyDbError("Supabase is not configured.");
  return client;
}

function mapRow(row: OnboardingRow): StaffOnboarding {
  return {
    userId: row.user_id,
    legalName: row.legal_name,
    phone: row.phone,
    emergencyName: row.emergency_name,
    emergencyPhone: row.emergency_phone,
    zelleContact: row.zelle_contact,
    paypalEmail: row.paypal_email,
    agreementVersion: row.agreement_version,
    signedName: row.signed_name,
    agreementAcceptedAt: row.agreement_accepted_at,
    completedAt: row.completed_at,
  };
}

/** One person's onboarding record, or null when they have not done it yet. Themselves or an admin only. */
export async function fetchStaffOnboarding(userId: string): Promise<StaffOnboarding | null> {
  const { data, error } = await requireClient().from("staff_onboarding").select(COLUMNS).eq("user_id", userId).maybeSingle();
  if (error) throw new AgencyDbError("Unable to load onboarding details.");
  return data ? mapRow(data as OnboardingRow) : null;
}

/** Everyone who has finished onboarding. Admins see all rows; anyone else sees only their own. */
export async function listCompletedOnboardingIds(): Promise<Set<string>> {
  const { data, error } = await requireClient().from("staff_onboarding").select("user_id");
  if (error) throw new AgencyDbError("Unable to load onboarding status.");
  return new Set(((data ?? []) as { user_id: string }[]).map((row) => row.user_id));
}

export async function submitStaffOnboarding(input: StaffOnboardingInput): Promise<void> {
  const { error } = await requireClient().rpc("submit_staff_onboarding", {
    p_legal_name: input.legalName,
    p_phone: input.phone,
    p_emergency_name: input.emergencyName,
    p_emergency_phone: input.emergencyPhone,
    p_zelle_contact: input.zelleContact,
    p_paypal_email: input.paypalEmail,
    p_agreement_version: AGREEMENT_VERSION,
    p_agreement_text: AGREEMENT_TEXT,
    p_signed_name: input.signedName,
  });
  if (error) throw new AgencyDbError(onboardingErrorMessage(error.message ?? ""), error);
}

export async function resetStaffOnboarding(userId: string): Promise<void> {
  const { error } = await requireClient().rpc("admin_reset_staff_onboarding", { p_user_id: userId });
  if (error) throw new AgencyDbError("Unable to reset onboarding.", error);
}
