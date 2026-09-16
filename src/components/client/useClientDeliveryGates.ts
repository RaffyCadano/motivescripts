import { useEffect, useState } from "react";
import { fetchClientDeliveryGates, type ClientDeliveryGates } from "@/data/clientProjectProgress";

export function useClientDeliveryGates(projectId: string | undefined) {
  const [gates, setGates] = useState<ClientDeliveryGates | null>(null);
  const [loading, setLoading] = useState(Boolean(projectId));

  useEffect(() => {
    if (!projectId) {
      setGates(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    void fetchClientDeliveryGates(projectId)
      .then((result) => {
        if (active) setGates(result);
      })
      .catch(() => {
        if (active) setGates(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  return { gates, loading };
}
