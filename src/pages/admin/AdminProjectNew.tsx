import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { adminPrimaryBtn } from "@/components/admin/adminActionStyles";
import { NeedClientEmpty } from "@/components/admin/NeedClientEmpty";
import { ProjectScopeSummary } from "@/components/admin/projects/ProjectScopeSummary";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import {
  projectStatuses,
  projectTypes,
  type AgencyProjectStatus,
  type AgencyProjectType,
} from "@/data/agencyProjects";
import { projectDescriptionFromBrief, suggestedProjectName, type ClientScopeBrief } from "@/data/scopeBriefs";
import { fetchClientScopeBrief } from "@/data/scopeBriefsRepository";
import { AgencyDbError } from "@/lib/dbErrors";

const inputClass =
  "mt-1.5 h-10 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm font-normal outline-none focus:border-[rgb(0_80_240_/_0.45)]";

const defaultProjectDescription =
  "Design and develop a professional website for this business, including the agreed pages, a mobile-friendly layout, and a clear way for visitors to get in touch.";

export function AdminProjectNew() {
  const { clients, addProject, notify } = useLeads();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetClient = searchParams.get("client") ?? "";
  const lockedClient = clients.some((client) => client.id === presetClient);
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState(lockedClient ? presetClient : (clients[0]?.id ?? ""));
  const [type, setType] = useState<AgencyProjectType>("Website");
  const [status, setStatus] = useState<AgencyProjectStatus>("Planning");
  const [description, setDescription] = useState(defaultProjectDescription);
  const [fromBrief, setFromBrief] = useState(false);
  const [brief, setBrief] = useState<ClientScopeBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(Boolean(clientId));
  const [startDate, setStartDate] = useState("");
  const [targetLaunchDate, setTargetLaunchDate] = useState("");
  const [busy, setBusy] = useState(false);
  const nameTouched = useRef(false);
  const descriptionTouched = useRef(false);
  const selectedClient = clients.find((client) => client.id === clientId);

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
        if (!active) return;
        setBrief(row);
        const client = clients.find((item) => item.id === clientId);
        if (!nameTouched.current && client) {
          setName(suggestedProjectName(client.businessName));
        }
        if (!descriptionTouched.current) {
          if (row) {
            setDescription(projectDescriptionFromBrief(row));
            setFromBrief(true);
          } else {
            setDescription(defaultProjectDescription);
            setFromBrief(false);
          }
        }
      })
      .catch(() => {
        if (!active) return;
        setBrief(null);
        if (!descriptionTouched.current) {
          setDescription(defaultProjectDescription);
          setFromBrief(false);
        }
      })
      .finally(() => {
        if (active) setBriefLoading(false);
      });
    return () => {
      active = false;
    };
  }, [clientId, clients]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!clientId || busy) return;
    setBusy(true);
    try {
      const id = await addProject({
        name,
        clientId,
        type,
        description,
        status,
        startDate,
        targetLaunchDate,
      });
      if (!id) {
        notify("Unable to create this project.");
        setBusy(false);
        return;
      }
      navigate(`/admin/projects/${id}`);
    } catch (error) {
      notify(error instanceof AgencyDbError ? error.message : "Unable to create this project.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link to="/admin/projects" className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline">
        Projects
      </Link>
      <div>
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight">Create Project</h1>
        {selectedClient ? (
          <>
            <p className="mt-2 font-heading text-lg font-semibold text-[var(--admin-ink)]">{selectedClient.businessName}</p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--admin-muted)]">
              Review the client's scope and set up the project workspace.
            </p>
          </>
        ) : (
          <p className="mt-1 max-w-2xl text-sm text-[var(--admin-muted)]">
            Create a project record. Progress is tracked from tasks after you add them.
          </p>
        )}
      </div>
      {clients.length === 0 ? (
        <NeedClientEmpty document="project" />
      ) : (
        <div className="grid max-w-2xl gap-6">
          <ProjectScopeSummary client={selectedClient} brief={brief} loading={briefLoading} />
          <form
            className="space-y-4 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5 md:p-6"
            onSubmit={onSubmit}
          >
            <div>
              <p className="font-heading text-sm font-semibold text-[var(--admin-ink)]">Project Setup</p>
              <p className="mt-1 text-sm text-[var(--admin-muted)]">Information used to create the project workspace.</p>
            </div>
            <label className="block text-sm font-semibold">
              Project name
              <input
                required
                value={name}
                onChange={(event) => {
                  nameTouched.current = true;
                  setName(event.target.value);
                }}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-semibold">
              Client
              <select
                required
                disabled={lockedClient}
                value={clientId}
                onChange={(event) => {
                  nameTouched.current = false;
                  descriptionTouched.current = false;
                  setClientId(event.target.value);
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
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold">
                Project type
                <select
                  required
                  value={type}
                  onChange={(event) => setType(event.target.value as AgencyProjectType)}
                  className={inputClass}
                >
                  {projectTypes.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold">
                Status
                <select
                  required
                  value={status}
                  onChange={(event) => setStatus(event.target.value as AgencyProjectStatus)}
                  className={inputClass}
                >
                  {projectStatuses.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <span className="mt-1.5 block text-[12px] font-normal text-[var(--admin-muted)]">
                  New projects start in Planning. Production starts later, after proposal, contract, and payment.
                </span>
              </label>
            </div>
            <label className="block text-sm font-semibold">
              Description
              <textarea
                required
                rows={6}
                value={description}
                onChange={(event) => {
                  descriptionTouched.current = true;
                  setFromBrief(false);
                  setDescription(event.target.value);
                }}
                className="mt-1.5 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 py-2 text-sm font-normal outline-none focus:border-[rgb(0_80_240_/_0.45)]"
              />
              {fromBrief ? (
                <span className="mt-1.5 block text-[12px] font-normal text-[var(--admin-muted)]">
                  This description was generated from the client's scope. Review and edit it before creating the project.
                </span>
              ) : null}
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold">
                Start date
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={inputClass} />
                <span className="mt-1.5 block text-[12px] font-normal text-[var(--admin-muted)]">
                  Optional — set when you expect to begin work.
                </span>
              </label>
              <label className="block text-sm font-semibold">
                Target launch date
                <input
                  type="date"
                  value={targetLaunchDate}
                  onChange={(event) => setTargetLaunchDate(event.target.value)}
                  className={inputClass}
                />
                <span className="mt-1.5 block text-[12px] font-normal text-[var(--admin-muted)]">
                  Optional — set an estimated launch date for planning.
                </span>
              </label>
            </div>
            <div className="space-y-2 pt-1">
              <button type="submit" disabled={busy} className={adminPrimaryBtn}>
                {busy ? "Creating…" : "Create Project"}
              </button>
              <p className="text-[12px] font-normal leading-5 text-[var(--admin-muted)]">
                This creates the project workspace. Proposal, contract, invoice, and production steps can be completed
                afterward.
              </p>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
