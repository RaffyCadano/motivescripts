import { useMemo } from "react";
import { usePortalOnboarding } from "@/components/client/usePortalOnboarding";
import { usePortalSession } from "@/components/admin/leads/LeadsProvider";
import { deriveClientPortalAction } from "@/data/clientPortal";
import { awaitingReview } from "@/data/review";

export function useClientPortalAction() {
  const { files } = usePortalSession();
  const onboarding = usePortalOnboarding();
  const waiting = awaitingReview(files.filter((item) => item.status !== "Archived"));
  const first = waiting[0] ?? null;
  const action = useMemo(
    () =>
      onboarding.loading
        ? null
        : deriveClientPortalAction(onboarding.flags, first ? { id: first.id, name: first.name } : null),
    [onboarding.loading, onboarding.flags, first?.id, first?.name],
  );

  return {
    action,
    waiting,
    first,
    onboarding,
    loading: onboarding.loading,
  };
}
