import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { NeedClientEmpty } from "@/components/admin/NeedClientEmpty";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { createProposal } from "@/data/documentsRepository";
import { seedProposalDraftFromBrief } from "@/data/scopeBriefsRepository";
import { AgencyDbError } from "@/lib/dbErrors";

export function AdminProposalNew() {
  const { clients, projects, notify } = useLeads();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetClient = searchParams.get("client") ?? "";
  const presetProject = searchParams.get("project") ?? "";
  const lockedClient = clients.some((client) => client.id === presetClient);
  const [clientId, setClientId] = useState(lockedClient ? presetClient : (clients[0]?.id ?? ""));
  const clientProjects = useMemo(
    () => projects.filter((project) => project.clientId === clientId && !project.archived),
    [projects, clientId],
  );
  const defaultProject =
    (presetProject && clientProjects.some((project) => project.id === presetProject) ? presetProject : "") ||
    clientProjects[0]?.id ||
    "";
  const [projectId, setProjectId] = useState(defaultProject);
  const [title, setTitle] = useState("Website proposal");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!clientId || busy) return;
    setBusy(true);
    try {
      const id = await createProposal(clientId, projectId || null, title);
      await seedProposalDraftFromBrief(id, clientId).catch(() => undefined);
      notify("Proposal created.");
      navigate(`/admin/proposals/${id}`);
    } catch (error) {
      notify(error instanceof AgencyDbError ? error.message : "Unable to create this proposal.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link to="/admin/proposals" className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline">
        Proposals
      </Link>
      <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight">New proposal</h1>
      {clients.length === 0 ? (
        <NeedClientEmpty document="proposal" />
      ) : (
        <div className="space-y-4">
        <p className="max-w-xl text-sm text-[var(--admin-muted)]">
          Creates a draft for this client. If they submitted a scope form, those pages are copied in. You’ll still set
          investment and terms before sending.
        </p>
        <form
          className="w-full max-w-lg space-y-4 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5 md:p-6"
          onSubmit={onSubmit}
        >
          <label className="block text-sm font-semibold">
            Client
            <select
              required
              disabled={lockedClient}
              value={clientId}
              onChange={(event) => {
                const next = event.target.value;
                setClientId(next);
                const nextProjects = projects.filter((project) => project.clientId === next && !project.archived);
                setProjectId(nextProjects[0]?.id ?? "");
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
            disabled={busy}
            className="inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Creating…" : "Create draft"}
          </button>
        </form>
        </div>
      )}
    </div>
  );
}

const inputClass =
  "mt-1.5 h-10 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm font-normal outline-none focus:border-[rgb(0_80_240_/_0.45)]";
