import { useCallback, useEffect, useState } from "react";
import { usePortalSession } from "@/components/admin/leads/LeadsProvider";
import { fetchClientDeliveryGates } from "@/data/clientProjectProgress";
import type { ServicePlan } from "@/data/servicePlans";
import { listServicePlans } from "@/data/servicePlansRepository";
import { AgencyDbError } from "@/lib/dbErrors";

/**
 * What the client portal needs to offer plans: the client's project, whether its website has launched (from the
 * server-side delivery gates, not anything the browser could fake), and their current plans. The server
 * enforces the launch rule again when a plan is actually chosen.
 */
export function useClientPlanOffer() {
  const { project } = usePortalSession();
  const projectId = project?.id ?? null;
  const [launched, setLaunched] = useState(false);
  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reloadPlans = useCallback(async () => {
    try {
      setPlans(await listServicePlans());
      setError(null);
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to load your plans.");
    }
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const gates = projectId
      ? fetchClientDeliveryGates(projectId)
          .then((result) => result?.isLaunched ?? false)
          .catch(() => false)
      : Promise.resolve(false);
    void Promise.all([gates, reloadPlans()]).then(([isLaunched]) => {
      if (!active) return;
      setLaunched(isLaunched);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [projectId, reloadPlans]);

  return { project, projectId, launched, plans, loading, error, reloadPlans };
}
