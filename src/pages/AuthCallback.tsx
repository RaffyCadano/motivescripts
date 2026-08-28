import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthStatusScreen } from "@/auth/AuthStatusScreen";
import { completeAuthRedirect } from "@/auth/completeAuthRedirect";
import { isAdminUser } from "@/auth/roles";
import { getSupabase } from "@/lib/supabase";

export function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      navigate("/login", { replace: true });
      return;
    }

    let active = true;

    void completeAuthRedirect(supabase).then((result) => {
      if (!active) return;
      if (!result.ok) {
        const reason = encodeURIComponent(result.message.slice(0, 180));
        navigate(`/login?error=link&reason=${reason}`, { replace: true });
        return;
      }
      navigate(isAdminUser(result.session.user) ? "/admin" : "/login?error=denied", { replace: true });
    });

    return () => {
      active = false;
    };
  }, [navigate]);

  return <AuthStatusScreen title="Signing you in." body="You’ll land in the dashboard in a moment." />;
}
