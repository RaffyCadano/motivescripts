import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission } from "@/auth/permissions";
import { adminPrimaryBtn } from "@/components/admin/adminActionStyles";
import { NeedClientEmpty } from "@/components/admin/NeedClientEmpty";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { createProposal } from "@/data/documentsRepository";
import { suggestedProposalTitle } from "@/data/proposalPresets";
import { requestedScopeFromBrief, scopeStatus, type ClientScopeBrief } from "@/data/scopeBriefs";
import { fetchClientScopeBrief, seedProposalDraftFromBrief } from "@/data/scopeBriefsRepository";
import { AgencyDbError } from "@/lib/dbErrors";

const inputClass =
  "mt-1.5 h-10 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm font-normal outline-none focus:border-[rgb(0_80_240_/_0.45)]";

function scopeStatusCopy(brief: ClientScopeBrief | null) {
  const status = scopeStatus(brief);
  if (status === "submitted") return "Submitted ✓";
  if (status === "in_progress") return "Scope In Progress";
  return "No Website Scope submitted";
}

export function AdminProposalNew() {
  const { clients, projects, notify } = useLeads();
  const { profile } = useAuth();
  const canManage = hasPermission(profile, "proposals.manage");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetClient = searchParams.get("client") ?? "";
  const presetProject = searchParams.get("project") ?? "";
  const lockedClient = clients.some((client) => client.id === presetClient);
  const lockedProject = projects.some(
    (project) => project.id === presetProject && (!lockedClient || project.clientId === presetClient),
  );
  const [clientId, setClientId] = useState(
    lockedClient ? presetClient : lockedProject
      ? (projects.find((project) => project.id === presetProject)?.clientId ?? clients[0]?.id ?? "")
      : (clients[0]?.id ?? ""),
  );
  const clientProjects = useMemo(
    () => projects.filter((project) => project.clientId === clientId && !project.archived),
    [projects, clientId],
  );
  const defaultProject = lockedProject
    ? presetProject
    : (presetProject && clientProjects.some((project) => project.id === presetProject) ? presetProject : "") ||
      clientProjects[0]?.id ||
      "";
  const [projectId, setProjectId] = useState(defaultProject);
  const selectedClient = clients.find((client) => client.id === clientId);
  const selectedProject = projects.find((project) => project.id === projectId);
  const fromProject = lockedProject;
  const [title, setTitle] = useState(() =>
    suggestedProposalTitle(selectedProject?.name, selectedClient?.businessName),
  );
  const titleTouched = useRef(false);
  const [busy, setBusy] = useState(false);
  const [brief, setBrief] = useState<ClientScopeBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(Boolean(clientId));

  useEffect(() => {
    if (titleTouched.current) return;
    setTitle(suggestedProposalTitle(selectedProject?.name, selectedClient?.businessName));
  }, [selectedProject?.name, selectedClient?.businessName]);

  useEffect(() => {
    if (!clientId) {
      setBrief(null);
      setBriefLoading(false);
      return;
    }
    let active = true;
    setBriefLoading(true);
    void fetchClientScopeBrief(clientId)
      .then((row) => {
        if (active) setBrief(row);
      })
      .catch(() => {
        if (active) setBrief(null);
      })
      .finally(() => {
        if (active) setBriefLoading(false);
      });
    return () => {
      active = false;
    };
  }, [clientId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!clientId || busy) return;
    if (lockedProject && projectId !== presetProject) return;
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

  const requested = brief ? requestedScopeFromBrief(brief) : { pages: [] as string[], features: [] as string[] };
  const styles = brief
    ? [...brief.designStyles.filter((item) => item !== "Other"), brief.otherStyle.trim()].filter(Boolean)
    : [];
  const submitted = scopeStatus(brief) === "submitted";
  const inProgress = scopeStatus(brief) === "in_progress";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Link to="/admin/proposals" className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline">
          Proposals
        </Link>
        {fromProject && selectedProject ? (
          <Link
            to={`/admin/projects/${selectedProject.id}`}
            className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline"
          >
            Project
          </Link>
        ) : null}
      </div>
      <div>
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight">
          {fromProject ? "Proposal Setup" : "New Proposal"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--admin-muted)]">
          {fromProject
            ? "Review the client's scope, confirm what you're proposing, then build the investment and terms before sending."
            : "Creates a draft for this client. If they submitted a Website Scope, those pages are copied in. You'll still set investment and terms before sending."}
        </p>
      </div>
      {!canManage ? (
        <p className="text-sm text-[var(--admin-muted)]">You don’t have permission to create proposals.</p>
      ) : clients.length === 0 ? (
        <NeedClientEmpty document="proposal" />
      ) : (
        <div className="grid max-w-2xl gap-6">
          {selectedClient ? (
            <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">Project & Scope Summary</p>
                <Link
                  to={`/admin/clients/${selectedClient.id}`}
                  className="text-xs font-semibold text-[var(--admin-navy)] hover:underline"
                >
                  View Full Scope
                </Link>
              </div>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-[12px] text-[var(--admin-muted)]">Project</dt>
                  <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">
                    {selectedProject ? selectedProject.name : "No project yet"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[12px] text-[var(--admin-muted)]">Client</dt>
                  <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">{selectedClient.businessName}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-[12px] text-[var(--admin-muted)]">Scope</dt>
                  <dd
                    className={`mt-1 text-sm font-semibold ${
                      submitted ? "text-emerald-800" : inProgress ? "text-amber-800" : "text-[var(--admin-muted)]"
                    }`}
                  >
                    {briefLoading ? "Loading scope…" : scopeStatusCopy(brief)}
                  </dd>
                </div>
                {!briefLoading && brief ? (
                  <>
                    <div className="sm:col-span-2">
                      <dt className="text-[12px] text-[var(--admin-muted)]">Pages</dt>
                      <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">
                        {requested.pages.length ? requested.pages.join(" · ") : "None listed"}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-[12px] text-[var(--admin-muted)]">Features</dt>
                      <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">
                        {requested.features.length ? requested.features.join(" · ") : "None listed"}
                      </dd>
                    </div>
                    {styles.length > 0 ? (
                      <div className="sm:col-span-2">
                        <dt className="text-[12px] text-[var(--admin-muted)]">Design</dt>
                        <dd className="mt-1 text-sm font-medium text-[var(--admin-ink)]">{styles.join(" · ")}</dd>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </dl>
            </section>
          ) : null}
          <form
            className="space-y-4 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5 md:p-6"
            onSubmit={onSubmit}
          >
            {fromProject ? null : (
              <h2 className="font-heading text-sm font-semibold text-[var(--admin-ink)]">Proposal Setup</h2>
            )}
            <label className="block text-sm font-semibold">
              Client
              <select
                required
                disabled={lockedClient || lockedProject}
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
              Project{" "}
              {lockedProject ? null : <span className="font-medium text-[var(--admin-muted)]">(optional)</span>}
              <select
                required={lockedProject}
                disabled={lockedProject}
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                className={inputClass}
              >
                {lockedProject ? null : <option value="">No project yet</option>}
                {(lockedProject ? projects.filter((project) => project.id === presetProject) : clientProjects).map(
                  (project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Proposal title
              <input
                value={title}
                onChange={(event) => {
                  titleTouched.current = true;
                  setTitle(event.target.value);
                }}
                required
                className={inputClass}
              />
            </label>
            <div className="space-y-2 pt-1">
              <button type="submit" disabled={busy} className={adminPrimaryBtn}>
                {busy ? "Creating…" : "Create Draft"}
              </button>
              <p className="text-[12px] font-normal leading-5 text-[var(--admin-muted)]">
                Creating this draft does not send anything to the client.
              </p>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
