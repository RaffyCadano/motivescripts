import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthStatusScreen } from "@/auth/AuthStatusScreen";
import { useAuth } from "@/auth/AuthProvider";
import { needsOnboarding } from "@/data/staffOnboarding";
import { fetchStaffOnboarding } from "@/data/staffOnboardingRepository";

export const ONBOARDING_PATH = "/onboarding";

type GateValue = { markComplete: () => void };

const GateContext = createContext<GateValue>({ markComplete: () => {} });

/** Lets the onboarding page tell the gate that the form has been saved, so the app opens without a reload. */
export function useStaffOnboardingGate(): GateValue {
  return useContext(GateContext);
}

/**
 * Team members (not admins) land on the onboarding page until they have filled it in. If the check itself fails,
 * they are let through rather than locked out of the app; the database still enforces everything else.
 */
export function StaffOnboardingGate({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const appliesToUser = profile?.role === "staff";
  const userId = profile?.id ?? null;
  const [state, setState] = useState<"checking" | "done" | "required">(appliesToUser ? "checking" : "done");

  useEffect(() => {
    if (!userId || !appliesToUser) {
      setState("done");
      return;
    }
    let cancelled = false;
    setState("checking");
    fetchStaffOnboarding(userId)
      .then((row) => {
        if (!cancelled) setState(needsOnboarding("staff", row?.completedAt) ? "required" : "done");
      })
      .catch(() => {
        if (!cancelled) setState("done");
      });
    return () => {
      cancelled = true;
    };
  }, [userId, appliesToUser]);

  const markComplete = useCallback(() => setState("done"), []);
  const value = useMemo(() => ({ markComplete }), [markComplete]);

  if (state === "checking") {
    return <AuthStatusScreen loading title="Checking your account." body="One moment." />;
  }
  if (state === "required" && pathname !== ONBOARDING_PATH) {
    return <Navigate to={ONBOARDING_PATH} replace />;
  }
  return <GateContext.Provider value={value}>{children}</GateContext.Provider>;
}
