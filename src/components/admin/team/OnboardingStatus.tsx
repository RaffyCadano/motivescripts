import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { listCompletedOnboardingIds } from "@/data/staffOnboardingRepository";

const CompletedContext = createContext<Set<string> | null>(null);

/** Loads, once, which team members have finished onboarding. A failed load shows no pills rather than wrong ones. */
export function OnboardingStatusProvider({ children }: { children: ReactNode }) {
  const [completed, setCompleted] = useState<Set<string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    listCompletedOnboardingIds()
      .then((ids) => {
        if (!cancelled) setCompleted(ids);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return <CompletedContext.Provider value={completed}>{children}</CompletedContext.Provider>;
}

/** "Onboarding pending" for a team member (not an admin) who has not filled in the welcome form yet. */
export function OnboardingPendingPill({ userId, role }: { userId: string; role: string }) {
  const completed = useContext(CompletedContext);
  if (role !== "staff" || !completed || completed.has(userId)) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 font-heading text-xs font-semibold tracking-tight text-[#b45309] ring-1 ring-amber-200">
      Onboarding pending
    </span>
  );
}
