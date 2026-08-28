import type { ReactNode } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthStatusScreen } from "@/auth/AuthStatusScreen";
import { useAuth } from "@/auth/AuthProvider";
import { isAdminUser } from "@/auth/roles";

function AccessDenied() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <AuthStatusScreen
      title="This account can’t open the dashboard."
      body="Only users with an admin role can enter. Set app_metadata.role to admin in Supabase, then sign out and request a new sign-in link."
      actionLabel="Sign out"
      onAction={() => {
        void signOut().then(() => navigate("/login", { replace: true }));
      }}
    />
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, user, loading, configured } = useAuth();
  const location = useLocation();

  if (!configured) {
    return (
      <AuthStatusScreen
        title="Supabase isn’t connected yet."
        body="Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env, then restart npm run dev. The dashboard stays locked until that’s done."
        showSetupHints
        showLoginLink
      />
    );
  }

  if (loading) {
    return <AuthStatusScreen title="Checking your session." body="One moment." />;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!isAdminUser(user)) {
    return <AccessDenied />;
  }

  return children;
}

export function GuestOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (isAdminUser(user)) return <Navigate to="/admin" replace />;
  return children;
}
