import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { createContract, fetchProposalSummaries } from "@/data/documentsRepository";
import { AgencyDbError } from "@/lib/dbErrors";

export function AdminContractNew() {
  const { clients, projects, notify } = useLeads();
  const navigate = useNavigate();
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [projectId, setProjectId] = useState("");
  const [proposalId, setProposalId] = useState("");
  const [title, setTitle] = useState("Website Development Agreement");
  const [accepted, setAccepted] = useState<{ id: string; number: string; clientId: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchProposalSummaries().then((rows) => {
      setAccepted(rows.filter((row) => row.effectiveStatus === "accepted").map((row) => ({
        id: row.id,
        number: row.number,
        clientId: row.clientId,
      })));
    });
  }, []);

  const clientProjects = projects.filter((project) => project.clientId === clientId && !project.archived);
  const clientProposals = useMemo(
    () => accepted.filter((row) => row.clientId === clientId),
    [accepted, clientId],
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!clientId || busy) return;
    setBusy(true);
    try {
      const id = await createContract({
        clientId,
        projectId: projectId || null,
        proposalId: proposalId || null,
        title,
      });
      notify("Contract created.");
      navigate(`/admin/contracts/${id}`);
    } catch (error) {
      notify(error instanceof AgencyDbError ? error.message : "Unable to create this contract.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link to="/admin/contracts" className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline">
        Contracts
      </Link>
      <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight">New contract</h1>
      <p className="max-w-xl text-sm text-[var(--admin-muted)]">
        Prefer creating this from an accepted proposal so the scope and investment stay connected.
      </p>
      <form className="max-w-lg space-y-4" onSubmit={onSubmit}>
        <label className="block text-sm font-semibold">
          Client
          <select
            required
            value={clientId}
            onChange={(event) => {
              setClientId(event.target.value);
              setProjectId("");
              setProposalId("");
            }}
            className={inputClass}
          >
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.businessName}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold">
          Accepted proposal
          <select value={proposalId} onChange={(event) => setProposalId(event.target.value)} className={inputClass}>
            <option value="">None</option>
            {clientProposals.map((row) => (
              <option key={row.id} value={row.id}>
                {row.number}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold">
          Project <span className="font-medium text-[var(--admin-muted)]">(optional)</span>
          <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className={inputClass}>
            <option value="">No project yet</option>
            {clientProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold">
          Title
          <input value={title} onChange={(event) => setTitle(event.target.value)} required className={inputClass} />
        </label>
        <button
          type="submit"
          disabled={busy || !clientId}
          className="inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Creating…" : "Create draft"}
        </button>
      </form>
    </div>
  );
}

const inputClass =
  "mt-1.5 h-10 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm font-normal outline-none focus:border-[rgb(0_80_240_/_0.45)]";
