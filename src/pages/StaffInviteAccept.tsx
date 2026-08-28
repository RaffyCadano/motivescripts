import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimateIn } from "@/components/AnimateIn";
import { Button } from "@/components/Button";
import { useAuth } from "@/auth/AuthProvider";
import { isAgencyRole } from "@/auth/roles";
import { site } from "@/data/site";
import {
  invitationErrorMessage,
  isInviteToken,
  normalizeInviteEmail,
  staffInvitePath,
  type InvitationPreviewState,
} from "@/data/invitation";
import { acceptStaffInvitation, previewStaffInvitation, staffInvitationEmailMatches } from "@/data/teamRepository";
import { AgencyDbError } from "@/lib/dbErrors";
import { appUrl } from "@/lib/appUrl";
import { cn } from "@/lib/cn";

type Screen =
  | "loading"
  | "invalid"
  | "expired"
  | "revoked"
  | "accepted"
  | "valid"
  | "sending"
  | "sent"
  | "mismatch"
  | "accepting"
  | "success"
  | "error";

const copy: Record<
  Exclude<Screen, "valid" | "sending" | "sent" | "mismatch" | "accepting" | "success" | "error">,
  { title: string; body: string }
> = {
  loading: { title: "Checking your invitation.", body: "One moment while we confirm this link." },
  invalid: {
    title: "This invitation isn’t valid.",
    body: "The link may be incomplete. Ask MotiveScripts to send a new invitation.",
  },
  expired: {
    title: "This invitation has expired.",
    body: "Ask MotiveScripts to send a new invitation to your email.",
  },
  revoked: {
    title: "This invitation is no longer valid.",
    body: "It was cancelled. Ask MotiveScripts if you still need workspace access.",
  },
  accepted: {
    title: "This invitation has already been used.",
    body: "If you already have access, sign in to open the MotiveScripts workspace.",
  },
};

function previewToScreen(state: InvitationPreviewState): Screen {
  if (state === "valid") return "valid";
  if (state === "expired") return "expired";
  if (state === "revoked") return "revoked";
  if (state === "accepted") return "accepted";
  return "invalid";
}

export function StaffInviteAcceptPage() {
  const { token: rawToken = "" } = useParams();
  const token = rawToken.trim().toLowerCase();
  const navigate = useNavigate();
  const { configured, loading: authLoading, session, user, profile, signInWithEmail, signOut, refreshProfile } =
    useAuth();
  const [screen, setScreen] = useState<Screen>("loading");
  const [roleLabel, setRoleLabel] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [authEmailOk, setAuthEmailOk] = useState<boolean | null>(null);
  const authEmail = normalizeInviteEmail(user?.email ?? profile?.email ?? "");

  useEffect(() => {
    if (!configured) {
      setScreen("error");
      setErrorMessage("This invitation page isn’t connected yet. Please contact MotiveScripts.");
      return;
    }
    if (!isInviteToken(token)) {
      setScreen("invalid");
      setRoleLabel(null);
      return;
    }
    let active = true;
    setScreen("loading");
    void previewStaffInvitation(token)
      .then((result) => {
        if (!active) return;
        setRoleLabel(result.roleLabel);
        setScreen(previewToScreen(result.state));
      })
      .catch(() => {
        if (!active) return;
        setRoleLabel(null);
        setScreen("error");
        setErrorMessage(invitationErrorMessage("network"));
      });
    return () => {
      active = false;
    };
  }, [configured, token]);

  const authenticated = Boolean(session && !authLoading);

  useEffect(() => {
    if (screen !== "valid" || !authenticated) {
      setAuthEmailOk(null);
      return;
    }
    if (!authEmail) {
      setScreen("mismatch");
      return;
    }
    let active = true;
    void staffInvitationEmailMatches(token, authEmail).then((matches) => {
      if (!active) return;
      if (matches === null) {
        setScreen("error");
        setErrorMessage(invitationErrorMessage("network"));
        return;
      }
      if (!matches) {
        setScreen("mismatch");
        return;
      }
      setAuthEmailOk(true);
    });
    return () => {
      active = false;
    };
  }, [authEmail, authenticated, screen, token]);

  const heading = useMemo(() => {
    if (screen === "valid" && roleLabel) return roleLabel;
    if (screen === "success") return "You're in.";
    if (screen === "mismatch") return "Wrong email for this invitation.";
    if (screen === "sending" || screen === "sent") return roleLabel ?? "You're invited";
    if (screen === "accepting") return "Connecting your workspace.";
    if (screen === "error") return "We couldn’t finish that.";
    if (screen in copy) return copy[screen as keyof typeof copy].title;
    return "You're invited";
  }, [roleLabel, screen]);

  async function onRequestLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (screen === "sending") return;
    const submitted = normalizeInviteEmail(email);
    setErrorMessage(null);
    setScreen("sending");
    const matches = await staffInvitationEmailMatches(token, submitted);
    if (matches === null) {
      setScreen("error");
      setErrorMessage(invitationErrorMessage("network"));
      return;
    }
    if (!matches) {
      setScreen("mismatch");
      return;
    }
    const redirectTo = appUrl(`/auth/callback?next=${encodeURIComponent(staffInvitePath(token))}`);
    const result = await signInWithEmail(submitted, { redirectTo });
    if (result.ok || result.reason === "not_found") {
      setScreen("sent");
      return;
    }
    if (result.reason === "rate_limit") {
      setScreen("error");
      setErrorMessage("Too many email attempts. Wait a bit, then try again.");
      return;
    }
    setScreen("error");
    setErrorMessage("We couldn’t send the sign-in link. Try again in a moment.");
  }

  async function onAccept() {
    if (screen === "accepting") return;
    setErrorMessage(null);
    setScreen("accepting");
    try {
      await acceptStaffInvitation(token);
      await refreshProfile();
      setScreen("success");
      window.setTimeout(() => navigate("/admin", { replace: true }), 700);
    } catch (error) {
      const message = error instanceof AgencyDbError ? error.message : invitationErrorMessage("error");
      if (message === invitationErrorMessage("EMAIL_MISMATCH")) {
        setScreen("mismatch");
        return;
      }
      setScreen("error");
      setErrorMessage(message);
    }
  }

  return (
    <main id="main" className="relative">
      <div className="hero-glow-pulse pointer-events-none absolute -right-8 top-6 size-[18rem] rounded-full bg-[radial-gradient(circle,rgb(0_104_255_/_0.08),transparent_64%)] blur-2xl" />
      <div className="hero-grid pointer-events-none absolute inset-0 opacity-80" />
      <div className="container-wide relative flex justify-center py-16 md:py-24">
        <AnimateIn className="w-full max-w-lg">
          <div className="relative overflow-hidden rounded-[1.25rem] border border-[var(--color-line-strong)] bg-[linear-gradient(180deg,#f4f8ff,#ffffff)]">
            <span className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,#0038C8,#00C8FF)]" aria-hidden="true" />
            <div className="relative px-6 py-8 md:px-10 md:py-10">
              <p className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-faint">{site.name}</p>
              <h1 className="mt-3 text-2xl md:text-[1.75rem]">{heading}</h1>
              {screen === "valid" && roleLabel ? (
                <p className="mt-2 font-heading text-sm font-semibold text-blue">Team invitation</p>
              ) : null}
              <p className="mt-3 text-sm leading-relaxed text-muted">{bodyCopy(screen, roleLabel, errorMessage)}</p>

              {screen === "valid" && (authLoading || (authenticated && authEmailOk === null)) ? (
                <p className="mt-6 font-heading text-sm font-semibold text-ink">Checking this account…</p>
              ) : null}

              {screen === "valid" && !authLoading && !authenticated ? (
                <form className="mt-8" onSubmit={onRequestLink}>
                  <label className="block font-heading text-sm font-semibold text-ink" htmlFor="staff-invite-email">
                    Invited email
                  </label>
                  <input
                    id="staff-invite-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@motivescripts.com"
                    className={inputClass}
                  />
                  <Button type="submit" className="mt-6 w-full" size="lg">
                    Continue
                  </Button>
                </form>
              ) : null}

              {screen === "sending" ? (
                <p className="mt-6 font-heading text-sm font-semibold text-ink">Sending your sign-in link…</p>
              ) : null}

              {screen === "sent" ? (
                <div className="mt-6 border-l-2 border-cyan pl-4" role="status">
                  <p className="font-heading text-base font-semibold text-ink">Check your email.</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    We sent a sign-in link to the invited address. Open it in this browser to join the workspace.
                  </p>
                </div>
              ) : null}

              {screen === "valid" && authenticated && authEmailOk ? (
                <div className="mt-8 space-y-3">
                  <Button className="w-full" size="lg" onClick={() => void onAccept()}>
                    Continue
                  </Button>
                  <button
                    type="button"
                    className="w-full text-center font-heading text-sm font-semibold text-ink underline-offset-2 hover:underline"
                    onClick={() => void signOut()}
                  >
                    Sign out and use a different email
                  </button>
                </div>
              ) : null}

              {screen === "mismatch" ? (
                <div className="mt-8 space-y-3">
                  {authenticated ? (
                    <Button className="w-full" size="lg" onClick={() => void signOut().then(() => setScreen("valid"))}>
                      Sign out and use the invited email
                    </Button>
                  ) : (
                    <Button className="w-full" size="lg" onClick={() => setScreen("valid")}>
                      Try the invited email
                    </Button>
                  )}
                </div>
              ) : null}

              {screen === "accepted" && authenticated && isAgencyRole(profile?.role) ? (
                <Button className="mt-8 w-full" size="lg" to="/admin">
                  Open workspace
                </Button>
              ) : null}

              {screen === "accepted" && !authenticated ? (
                <Button className="mt-8 w-full" size="lg" to="/login">
                  Sign in
                </Button>
              ) : null}

              {screen === "accepting" ? (
                <p className="mt-6 font-heading text-sm font-semibold text-ink">Connecting your account…</p>
              ) : null}

              {screen === "success" ? (
                <p className="mt-6 font-heading text-sm font-semibold text-ink">Workspace access connected.</p>
              ) : null}

              {screen === "error" ? (
                <Button className="mt-8 w-full" size="lg" onClick={() => window.location.reload()}>
                  Try again
                </Button>
              ) : null}

              <p className="mt-8 border-t border-[var(--color-line)] pt-5 text-sm leading-relaxed text-muted">
                Need help?{" "}
                <a className="font-medium text-ink underline-offset-2 hover:underline" href={`mailto:${site.email}`}>
                  Email us directly
                </a>
              </p>
            </div>
          </div>
        </AnimateIn>
      </div>
    </main>
  );
}

function bodyCopy(screen: Screen, roleLabel: string | null, errorMessage: string | null): string {
  if (screen === "valid") {
    return roleLabel
      ? `You've been invited to join MotiveScripts as ${roleLabel}. Continue with the invited email address.`
      : "You've been invited to join the MotiveScripts team. Continue with the invited email address.";
  }
  if (screen === "sending") return "We’re sending a sign-in link to the invited email.";
  if (screen === "sent") return "The invitation is verified. Finish signing in from the email we just sent.";
  if (screen === "mismatch") return invitationErrorMessage("EMAIL_MISMATCH");
  if (screen === "accepting") return "We’re connecting this account to the MotiveScripts workspace.";
  if (screen === "success") return "Workspace access connected. Taking you to the dashboard.";
  if (screen === "error") return errorMessage ?? invitationErrorMessage("error");
  if (screen in copy) return copy[screen as keyof typeof copy].body;
  return "You've been invited to join the MotiveScripts team.";
}

const inputClass = cn(
  "mt-2 h-12 w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white px-4 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-[rgb(0_80_240_/_0.55)]",
);
