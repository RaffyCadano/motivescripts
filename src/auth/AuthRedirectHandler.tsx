import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { invitePath, isInviteToken, staffInvitePath } from "@/data/invitation";

function urlHasAuthParams(search: string, hash: string): boolean {
  const query = new URLSearchParams(search);
  const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
  return (
    query.has("code") ||
    query.has("token_hash") ||
    query.has("error") ||
    query.has("error_description") ||
    hashParams.has("access_token") ||
    hashParams.has("error") ||
    hashParams.has("error_description")
  );
}

function inviteTokenFromPath(pathname: string): { kind: "client" | "staff"; token: string } | null {
  const client = pathname.match(/^\/invite\/([0-9a-f]{64})$/i);
  if (client && isInviteToken(client[1])) return { kind: "client", token: client[1] };
  const staff = pathname.match(/^\/staff-invite\/([0-9a-f]{64})$/i);
  if (staff && isInviteToken(staff[1])) return { kind: "staff", token: staff[1] };
  return null;
}

export function AuthRedirectHandler() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname === "/auth/callback") return;
    if (location.pathname === "/login" && new URLSearchParams(location.search).get("error")) return;
    if (!urlHasAuthParams(location.search, location.hash)) return;

    const params = new URLSearchParams(location.search);
    const invite = inviteTokenFromPath(location.pathname);
    if (invite && !params.get("next")) {
      params.set("next", invite.kind === "staff" ? staffInvitePath(invite.token) : invitePath(invite.token));
    }

    navigate(
      {
        pathname: "/auth/callback",
        search: params.toString() ? `?${params.toString()}` : location.search,
        hash: location.hash,
      },
      { replace: true },
    );
  }, [location.hash, location.pathname, location.search, navigate]);

  return null;
}
