import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthStatusScreen } from "@/auth/AuthStatusScreen";
import { useAuth } from "@/auth/AuthProvider";
import { isActiveAgency } from "@/auth/permissions";
import { agencyHomePath, isAgencyRole } from "@/auth/roles";
import {
  acceptMyPendingInvitation,
  fetchMyPendingInvitation,
  type PendingInvitation,
} from "@/data/invitationRecovery";
import { AgencyDbError } from "@/lib/dbErrors";

function AccountNotConfigured() {
  const { signOut, refreshProfile, profileStatus } = useAuth();
  const navigate = useNavigate();
  const [retrying, setRetrying] = useState(false);
  // A transient profile-load failure is not the same as "not configured";
  // offer a retry instead of a sign-out-only dead end.
  const transient = profileStatus === "error";

  return (
    <AuthStatusScreen
      title={transient ? "We couldn’t load your account." : "Your account is not configured yet."}
      body={
        transient
          ? "This is usually a brief connection problem. Try again, and contact MotiveScripts if it keeps happening."
          : "Please contact MotiveScripts so we can finish setting up your access."
      }
      actionLabel={transient ? "Try again" : "Sign out"}
      actionBusy={retrying}
      secondaryLabel={transient ? "Sign out" : undefined}
      showLoginLink={!transient}
      onAction={() => {
        if (transient) {
          setRetrying(true);
          void refreshProfile().finally(() => setRetrying(false));
          return;
        }
        void signOut().then(() => navigate("/login", { replace: true }));
      }}
      onSecondary={() => {
        void signOut().then(() => navigate("/login", { replace: true }));
      }}
    />
  );
}

type RecoveryState =
  | { status: "loading" }
  | { status: "none" }
  | { status: "pending"; invite: PendingInvitation }
  | { status: "accepting"; invite: PendingInvitation }
  | { status: "error"; invite: PendingInvitation; message: string };

/**
 * A signed-in user whose profile is `client` with no linked client. That is either
 * (a) an invitee who signed in through /login instead of finishing the emailed link
 * (staff invitees land here too, because the auth user is created when the invite is
 * sent), or (b) a client whose link was removed. For (a) we can finish the invite right
 * here: the session's verified email matching the invited email is the same proof the
 * emailed link provides, so no token is needed.
 */
function InvitationNotFinished() {
  const { signOut, refreshProfile, user } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<RecoveryState>({ status: "loading" });
  const [checking, setChecking] = useState(false);

  async function lookup() {
    const invite = await fetchMyPendingInvitation();
    setState(invite ? { status: "pending", invite } : { status: "none" });
  }

  useEffect(() => {
    let active = true;
    void fetchMyPendingInvitation().then((invite) => {
      if (active) setState(invite ? { status: "pending", invite } : { status: "none" });
    });
    return () => {
      active = false;
    };
  }, [user?.id]);

  function leave() {
    void signOut().then(() => navigate("/login", { replace: true }));
  }

  if (state.status === "loading") {
    return <AuthStatusScreen loading title="Checking your invitation." body="One moment." />;
  }

  if (state.status === "pending" || state.status === "accepting" || state.status === "error") {
    const { invite } = state;
    const accepting = state.status === "accepting";
    return (
      <AuthStatusScreen
        title="You have an invitation waiting."
        body={
          state.status === "error"
            ? state.message
            : invite.kind === "staff"
              ? `You’ve been invited to join MotiveScripts as ${invite.label}. Accept it to open your workspace.`
              : `You’ve been invited to the ${invite.label} client portal. Accept it to open your portal.`
        }
        actionLabel={accepting ? "Connecting your account…" : "Accept invitation"}
        actionBusy={accepting}
        secondaryLabel="Sign out"
        onAction={() => {
          setState({ status: "accepting", invite });
          void acceptMyPendingInvitation()
            .then(() => refreshProfile())
            .catch((error) => {
              const message =
                error instanceof AgencyDbError ? error.message : "We couldn’t finish that. Try again in a moment.";
              setState({ status: "error", invite, message });
            });
        }}
        onSecondary={leave}
      />
    );
  }

  return (
    <AuthStatusScreen
      title="We couldn’t find an open invitation."
      body={`You’re signed in as ${user?.email ?? "this account"}, but there’s no open invitation for that address. If it expired or was cancelled, ask MotiveScripts to send a new one. Invitations only work for the exact email they were sent to. If you just accepted it somewhere else, choose Check again.`}
      actionLabel="Check again"
      actionBusy={checking}
      secondaryLabel="Sign out"
      onAction={() => {
        setChecking(true);
        void refreshProfile()
          .then(lookup)
          .finally(() => setChecking(false));
      }}
      onSecondary={leave}
    />
  );
}

function AccountDeactivated() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <AuthStatusScreen
      title="This account is deactivated."
      body="Your MotiveScripts workspace access is turned off. Contact an administrator if you still need access."
      actionLabel="Sign out"
      showLoginLink
      onAction={() => {
        void signOut().then(() => navigate("/login", { replace: true }));
      }}
    />
  );
}

function SessionLoading() {
  return <AuthStatusScreen loading title="Checking your session." body="One moment." />;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { session, profile, profileStatus, loading, configured } = useAuth();
  const location = useLocation();

  if (!configured) {
    return (
      <AuthStatusScreen
        title="Supabase isn’t connected yet."
        body={
          import.meta.env.DEV
            ? "Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env, then restart the dev server. The dashboard stays locked until that’s done."
            : "This site isn’t connected to the database. Contact MotiveScripts."
        }
        showSetupHints
        showLoginLink
      />
    );
  }

  if (loading || (session && profileStatus === "loading")) {
    return <SessionLoading />;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (profileStatus !== "ready" || !profile) {
    return <AccountNotConfigured />;
  }

  if (profile.role === "client") {
    return <Navigate to="/client" replace />;
  }

  if (!isAgencyRole(profile.role)) {
    return <AccountNotConfigured />;
  }

  if (!isActiveAgency(profile)) {
    return <AccountDeactivated />;
  }

  return children;
}

export function RequireClient({ children }: { children: ReactNode }) {
  const { session, profile, profileStatus, loading, configured } = useAuth();
  const location = useLocation();

  if (!configured) {
    return (
      <AuthStatusScreen
        title="Supabase isn’t connected yet."
        body={
          import.meta.env.DEV
            ? "Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env, then restart the dev server."
            : "This site isn’t connected to the database. Contact MotiveScripts."
        }
        showSetupHints
        showLoginLink
      />
    );
  }

  if (loading || (session && profileStatus === "loading")) {
    return <SessionLoading />;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (profileStatus !== "ready" || !profile) {
    return <AccountNotConfigured />;
  }

  if (isAgencyRole(profile.role)) {
    return <Navigate to={agencyHomePath(profile)} replace />;
  }

  if (profile.role === "client" && !profile.clientId) {
    return <InvitationNotFinished />;
  }

  if (profile.role !== "client" || !profile.clientId) {
    return <AccountNotConfigured />;
  }

  return children;
}

export function GuestOnly({ children }: { children: ReactNode }) {
  const { session, profile, profileStatus, loading } = useAuth();

  if (loading || (session && profileStatus === "loading")) {
    return <SessionLoading />;
  }

  if (isAgencyRole(profile?.role)) return <Navigate to={agencyHomePath(profile)} replace />;
  if (session) return <Navigate to="/client" replace />;
  return children;
}

/** @deprecated Use RequireAdmin. Kept so older imports keep compiling during the rename. */
export function RequireAuth({ children }: { children: ReactNode }) {
  return <RequireAdmin>{children}</RequireAdmin>;
}
