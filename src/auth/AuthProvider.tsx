import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AuthError, Session, User } from "@supabase/supabase-js";
import { loadCurrentProfile, type AppProfile, type ProfileStatus } from "@/auth/loadProfile";
import { isAgencyRole } from "@/auth/roles";
import { clearSignedUrlCache } from "@/data/fileStorage";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { appUrl } from "@/lib/appUrl";
import { devAuthDetail, publicSignInError } from "@/auth/authErrors";

export type SignInResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "rate_limit" | "unconfigured" | "error"; message?: string };

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: AppProfile | null;
  profileStatus: ProfileStatus;
  loading: boolean;
  configured: boolean;
  signInWithEmail: (email: string, options?: { redirectTo?: string }) => Promise<SignInResult>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

function markStaffActive(profile: AppProfile) {
  if (!isAgencyRole(profile.role) || !profile.isActive) return;
  const supabase = getSupabase();
  if (!supabase) return;
  void supabase.rpc("touch_staff_last_active");
}

const AuthContext = createContext<AuthContextValue | null>(null);

function isRedirectError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("redirect") ||
    normalized.includes("whitelist") ||
    normalized.includes("allow list") ||
    normalized.includes("not allowed")
  );
}

function mapSignInError(error: AuthError): SignInResult {
  const message = error.message ?? "";
  const code = error.code;
  const normalized = message.toLowerCase();
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
    return { ok: false, reason: "rate_limit", message: import.meta.env.DEV ? devAuthDetail(error) : publicSignInError("rate_limit") };
  }
  if (import.meta.env.DEV) {
    const detail = devAuthDetail(error);
    if (
      normalized.includes("error sending") ||
      normalized.includes("smtp") ||
      normalized.includes("failed to send") ||
      code === "unexpected_failure"
    ) {
      return {
        ok: false,
        reason: "error",
        message: `${detail ?? "The email provider rejected this send."} Check Authentication → Emails → SMTP.`,
      };
    }
    return { ok: false, reason: "error", message: detail ?? publicSignInError("error") };
  }
  return { ok: false, reason: "error", message: publicSignInError("error") };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>("idle");
  const [loading, setLoading] = useState(configured);
  const loadSeq = useRef(0);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setSession(null);
      setProfile(null);
      setProfileStatus("idle");
      setLoading(false);
      return;
    }

    const applySession = (nextSession: Session | null) => {
      const seq = ++loadSeq.current;
      setSession(nextSession);
      if (!nextSession) {
        setProfile(null);
        setProfileStatus("idle");
        setLoading(false);
        return;
      }

      setLoading(true);
      setProfileStatus("loading");
      void loadCurrentProfile().then((result) => {
        if (seq !== loadSeq.current) return;
        if (result.status === "ready") {
          setProfile(result.profile);
          setProfileStatus("ready");
          markStaffActive(result.profile);
        } else {
          setProfile(null);
          setProfileStatus(result.status);
        }
        setLoading(false);
      });
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      window.setTimeout(() => applySession(nextSession), 0);
    });

    return () => {
      loadSeq.current += 1;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      profileStatus,
      loading,
      configured,
      async signInWithEmail(email: string, options?: { redirectTo?: string }) {
        const supabase = getSupabase();
        if (!supabase) return { ok: false, reason: "unconfigured" };

        const redirectTargets = options?.redirectTo
          ? [options.redirectTo]
          : [appUrl("/auth/callback"), appUrl("/")];

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

          if (!lastError) return { ok: false, reason: "error", message: publicSignInError("error") };
          return mapSignInError(lastError);
        } catch {
          return { ok: false, reason: "error", message: publicSignInError("error") };
        }
      },
      async refreshProfile() {
        const seq = loadSeq.current;
        const result = await loadCurrentProfile();
        if (seq !== loadSeq.current) return;
        if (result.status === "ready") {
          setProfile(result.profile);
          setProfileStatus("ready");
          markStaffActive(result.profile);
        } else {
          setProfile(null);
          setProfileStatus(result.status);
        }
      },
      async signOut() {
        const supabase = getSupabase();
        loadSeq.current += 1;
        setProfile(null);
        setProfileStatus("idle");
        clearSignedUrlCache();
        if (!supabase) {
          setSession(null);
          setLoading(false);
          return;
        }
        await supabase.auth.signOut();
      },
    }),
    [configured, loading, profile, profileStatus, session],
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
