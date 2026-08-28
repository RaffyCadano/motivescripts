import type { EmailOtpType, Session, SupabaseClient } from "@supabase/supabase-js";

export type AuthRedirectResult =
  | { ok: true; session: Session }
  | { ok: false; message: string };

let inFlight: Promise<AuthRedirectResult> | null = null;

function hashParams(): URLSearchParams {
  return new URLSearchParams(window.location.hash.replace(/^#/, ""));
}

function redirectErrorMessage(): string | null {
  const search = new URLSearchParams(window.location.search);
  const hash = hashParams();
  return (
    search.get("error_description") ??
    hash.get("error_description") ??
    search.get("error") ??
    hash.get("error")
  );
}

function tokensFromUrl(): { access_token: string; refresh_token: string } | null {
  const search = new URLSearchParams(window.location.search);
  const hash = hashParams();
  const access_token = hash.get("access_token") ?? search.get("access_token");
  const refresh_token = hash.get("refresh_token") ?? search.get("refresh_token");
  if (!access_token || !refresh_token) return null;
  return { access_token, refresh_token };
}

function otpTypeFromUrl(value: string | null): EmailOtpType {
  const allowed: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];
  if (value && allowed.includes(value as EmailOtpType)) return value as EmailOtpType;
  return "magiclink";
}

async function waitForSession(supabase: SupabaseClient, attempts = 20): Promise<Session | null> {
  for (let i = 0; i < attempts; i += 1) {
    const { data } = await supabase.auth.getSession();
    if (data.session) return data.session;
    await new Promise((resolve) => window.setTimeout(resolve, 150));
  }
  return null;
}

async function runAuthRedirect(supabase: SupabaseClient): Promise<AuthRedirectResult> {
  const urlError = redirectErrorMessage();
  if (urlError) {
    return { ok: false, message: urlError.replace(/\+/g, " ") };
  }

  const tokens = tokensFromUrl();
  if (tokens) {
    const { data, error } = await supabase.auth.setSession(tokens);
    if (error) return { ok: false, message: error.message };
    if (data.session) return { ok: true, session: data.session };
  }

  const search = new URLSearchParams(window.location.search);
  const tokenHash = search.get("token_hash");
  if (tokenHash) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpTypeFromUrl(search.get("type")),
    });
    if (error) return { ok: false, message: error.message };
    if (data.session) return { ok: true, session: data.session };
  }

  const code = search.get("code");
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return { ok: false, message: error.message };
    if (data.session) return { ok: true, session: data.session };
  }

  const session = await waitForSession(supabase);
  if (session) return { ok: true, session };

  return {
    ok: false,
    message: "That sign-in link expired or was already used. Request a new one from this same browser.",
  };
}

export function completeAuthRedirect(supabase: SupabaseClient): Promise<AuthRedirectResult> {
  if (!inFlight) {
    inFlight = runAuthRedirect(supabase).then((result) => {
      if (!result.ok) inFlight = null;
      return result;
    });
  }
  return inFlight;
}
