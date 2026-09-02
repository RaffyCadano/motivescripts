import { useEffect, useState } from "react";
import type { DiscoveryIntake } from "@/data/discoveryIntake";
import { fetchDiscoveryIntakeByProject } from "@/data/discoveryIntakeRepository";

export function useClientDiscovery(projectId: string | undefined) {
  const [intake, setIntake] = useState<DiscoveryIntake | null>(null);
  const [loading, setLoading] = useState(Boolean(projectId));

  useEffect(() => {
    if (!projectId) {
      setIntake(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    void fetchDiscoveryIntakeByProject(projectId, { includeInternal: false })
      .then((row) => {
        if (active) setIntake(row);
      })
      .catch(() => {
        if (active) setIntake(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  return { intake, loading };
}
