import type { ReactNode } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthStatusScreen } from "@/auth/AuthStatusScreen";
import { useAuth } from "@/auth/AuthProvider";
import { isActiveAgency } from "@/auth/permissions";
import { isAgencyRole } from "@/auth/roles";

function AccountNotConfigured() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <AuthStatusScreen
      title="Your account is not configured yet."
      body="Please contact MotiveScripts so we can finish setting up your access."
      actionLabel="Sign out"
      showLoginLink
      onAction={() => {
        void signOut().then(() => navigate("/login", { replace: true }));
      }}
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
    return <Navigate to="/admin" replace />;
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

  if (isAgencyRole(profile?.role)) return <Navigate to="/admin" replace />;
  if (session) return <Navigate to="/client" replace />;
  return children;
}

/** @deprecated Use RequireAdmin. Kept so older imports keep compiling during the rename. */
export function RequireAuth({ children }: { children: ReactNode }) {
  return <RequireAdmin>{children}</RequireAdmin>;
}
