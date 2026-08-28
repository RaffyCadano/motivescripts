import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

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

export function AuthRedirectHandler() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname === "/auth/callback") return;
    if (location.pathname === "/login" && new URLSearchParams(location.search).get("error")) return;
    if (!urlHasAuthParams(location.search, location.hash)) return;

    navigate(
      {
        pathname: "/auth/callback",
        search: location.search,
        hash: location.hash,
      },
      { replace: true },
    );
  }, [location.hash, location.pathname, location.search, navigate]);

  return null;
}
