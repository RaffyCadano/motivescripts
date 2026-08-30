import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthStatusScreen } from "@/auth/AuthStatusScreen";
import { completeAuthRedirect } from "@/auth/completeAuthRedirect";
import { loadCurrentProfile } from "@/auth/loadProfile";
import { safeInviteNext } from "@/data/invitation";
import { agencyHomePath, isAgencyRole } from "@/auth/roles";
import { getSupabase } from "@/lib/supabase";

export function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      navigate("/login", { replace: true });
      return;
    }

    const inviteNext = safeInviteNext(new URLSearchParams(window.location.search).get("next"));
    let active = true;

    void completeAuthRedirect(supabase).then(async (result) => {
      if (!active) return;
      if (!result.ok) {
        navigate("/login?error=link", { replace: true });
        return;
      }

      if (inviteNext) {
        navigate(inviteNext, { replace: true });
        return;
      }

      const profile = await loadCurrentProfile();
      if (!active) return;
      if (profile.status === "ready" && isAgencyRole(profile.profile.role)) {
        navigate(agencyHomePath(profile.profile), { replace: true });
        return;
      }
      navigate("/client", { replace: true });
    });

    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <AuthStatusScreen
      inSiteLayout
      loading
      title="Signing you in."
      body="You’ll land in your workspace in a moment."
    />
  );
}
