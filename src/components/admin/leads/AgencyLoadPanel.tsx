type AgencyLoadPanelProps = {
  status: "loading" | "ready" | "error";
  error: string | null;
  onRetry: () => void;
  loadingTitle?: string;
};

export function AgencyLoadPanel({
  status,
  error,
  onRetry,
  loadingTitle = "Loading projects…",
}: AgencyLoadPanelProps) {
  if (status === "ready") return null;

  return (
    <div className="rounded-[var(--admin-radius,1rem)] border border-[var(--admin-line,#e5eaf0)] bg-white px-5 py-10 text-center">
      {status === "loading" ? (
        <>
          <p className="font-heading text-sm font-semibold text-[var(--admin-ink,#07111f)]">{loadingTitle}</p>
          <p className="mt-1 text-sm text-[var(--admin-muted,#667085)]">Fetching the latest agency records.</p>
        </>
      ) : (
        <>
          <p className="font-heading text-sm font-semibold text-[var(--admin-ink,#07111f)]">Unable to load projects.</p>
          <p className="mt-1 text-sm text-[var(--admin-muted,#667085)]">
            {error ?? "Check the database connection and try again."}
          </p>
          <button
            type="button"
            className="mt-4 inline-flex h-10 items-center rounded-lg bg-[#001030] px-4 font-heading text-sm font-semibold text-white"
            onClick={onRetry}
          >
            Try again
          </button>
        </>
      )}
    </div>
  );
}
