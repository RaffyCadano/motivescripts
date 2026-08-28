import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthError, Session, User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { appUrl } from "@/lib/appUrl";

export type SignInResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "rate_limit" | "unconfigured" | "error"; message?: string };

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  configured: boolean;
  signInWithEmail: (email: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function describeAuthError(error: AuthError): string {
  const parts = [error.message, error.code, error.status != null ? String(error.status) : ""]
    .filter((part): part is string => Boolean(part && part.trim()))
    .map((part) => part.trim());
  return parts.join(" · ") || "Unknown auth error";
}

function isRedirectError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("redirect") ||
    normalized.includes("whitelist") ||
    normalized.includes("allow list") ||
    normalized.includes("not allowed")
  );
}

function mapSignInError(code?: string, message?: string): SignInResult {
  const normalized = (message ?? "").toLowerCase();
  if (
    code === "signup_disabled" ||
    code === "user_not_found" ||
    code === "otp_disabled" ||
    normalized.includes("signups not allowed") ||
    normalized.includes("user not found")
  ) {
    return { ok: false, reason: "not_found" };
  }
  if (
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    normalized.includes("rate limit") ||
    normalized.includes("rate_limit") ||
    normalized.includes("security purposes")
  ) {
    return { ok: false, reason: "rate_limit", message };
  }
  if (
    normalized.includes("error sending") ||
    normalized.includes("smtp") ||
    normalized.includes("failed to send") ||
    code === "unexpected_failure"
  ) {
    return {
      ok: false,
      reason: "error",
      message: `${message ?? "The email provider rejected this send."} Check Authentication → Emails → SMTP (host smtp.resend.com, port 465, username resend, password = Resend API key, sender email allowed in Resend).`,
    };
  }
  return { ok: false, reason: "error", message };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setSession(null);
      setLoading(false);
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      configured,
      async signInWithEmail(email: string) {
        const supabase = getSupabase();
        if (!supabase) return { ok: false, reason: "unconfigured" };

        const redirectTargets = [appUrl("/auth/callback"), appUrl("/")];

        try {
          let lastError: AuthError | null = null;
          for (const emailRedirectTo of redirectTargets) {
            const { error } = await supabase.auth.signInWithOtp({
              email: email.trim(),
              options: {
                shouldCreateUser: false,
                emailRedirectTo,
              },
            });
            if (!error) return { ok: true };
            lastError = error;
            if (!isRedirectError(`${error.message} ${error.code ?? ""}`)) break;
          }

          if (!lastError) return { ok: false, reason: "error", message: "Unknown auth error" };
          return mapSignInError(lastError.code, describeAuthError(lastError));
        } catch (caught) {
          const message = caught instanceof Error ? caught.message : "Unknown auth error";
          return { ok: false, reason: "error", message };
        }
      },
      async signOut() {
        const supabase = getSupabase();
        if (!supabase) {
          setSession(null);
          return;
        }
        await supabase.auth.signOut();
      },
    }),
    [configured, loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return value;
}
