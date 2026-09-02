import { useEffect, useState } from "react";
import { fetchTaskClientRequestsForProject } from "@/data/taskClientRequestsRepository";

export function useClientTaskRequests(projectId: string | undefined) {
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(Boolean(projectId));

  useEffect(() => {
    if (!projectId) {
      setPendingCount(0);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    void fetchTaskClientRequestsForProject(projectId)
      .then((rows) => {
        if (active) setPendingCount(rows.filter((row) => row.status === "awaiting_client").length);
      })
      .catch(() => {
        if (active) setPendingCount(0);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  return { pendingCount, loading };
}
