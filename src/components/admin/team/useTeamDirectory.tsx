import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchTeamDirectory, type TeamDirectory } from "@/data/teamRepository";
import { AgencyDbError } from "@/lib/dbErrors";

type TeamDirectoryValue = {
  data: TeamDirectory | null;
  status: "loading" | "ready" | "error";
  error: string | null;
  reload: () => Promise<void>;
};

const TeamDirectoryContext = createContext<TeamDirectoryValue | null>(null);

export function TeamDirectoryProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<TeamDirectory | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setStatus("loading");
    try {
      const next = await fetchTeamDirectory();
      setData(next);
      setError(null);
      setStatus("ready");
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to load the team.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo<TeamDirectoryValue>(() => ({ data, status, error, reload }), [data, error, reload, status]);

  return <TeamDirectoryContext.Provider value={value}>{children}</TeamDirectoryContext.Provider>;
}

export function useTeamDirectory() {
  const value = useContext(TeamDirectoryContext);
  if (!value) {
    throw new Error("useTeamDirectory must be used within TeamDirectoryProvider");
  }
  return value;
}
