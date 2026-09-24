import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useClientPortalAccess } from "@/components/client/useClientPortalAccess";

/** Sends a client on the Website package (essentials only) back to their overview instead of a page their package doesn't include. */
export function RequireFullPortal({ children }: { children: ReactNode }) {
  const { fullPortal } = useClientPortalAccess();
  return fullPortal ? children : <Navigate to="/client" replace />;
}
