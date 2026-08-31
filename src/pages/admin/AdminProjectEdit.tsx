import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAgencyProject, useLeads } from "@/components/admin/leads/LeadsProvider";
import {
  projectStatuses,
  projectTypes,
  type AgencyProjectStatus,
  type AgencyProjectType,
} from "@/data/agencyProjects";
import { updateProjectRecord } from "@/data/agencyRepository";
import { AgencyDbError } from "@/lib/dbErrors";

const inputClass =
  "mt-1.5 h-10 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm font-normal outline-none focus:border-[rgb(0_80_240_/_0.45)]";

export function AdminProjectEdit() {
  const { id = "" } = useParams();
  const match = useAgencyProject(id);
  const { clients, notify, reload } = useLeads();
  const navigate = useNavigate();
  const project = match?.project;
  const [name, setName] = useState(project?.name ?? "");
  const [clientId, setClientId] = useState(project?.clientId ?? "");
  const [type, setType] = useState<AgencyProjectType>(project?.type ?? "Website");
  const [status, setStatus] = useState<AgencyProjectStatus>(project?.status ?? "Planning");
  const [description, setDescription] = useState(project?.description ?? "");
  const [startDate, setStartDate] = useState(project?.startDate ?? "");
  const [targetLaunchDate, setTargetLaunchDate] = useState(project?.targetLaunchDate ?? "");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!project || !clientId || busy) return;
    setBusy(true);
    try {
      await updateProjectRecord(project.id, {
        name,
        clientId,
        type,
        description,
        status,
        startDate,
        targetLaunchDate,
      });
      await reload();
      notify("Project updated.");
      navigate(`/admin/projects/${project.id}`);
    } catch (error) {
      notify(error instanceof AgencyDbError ? error.message : "Unable to update this project.");
      setBusy(false);
    }
  }

  if (!project) {
    return (
      <div className="space-y-6">
        <Link to="/admin/projects" className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline">
          Projects
        </Link>
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight">Project not found</h1>
        <p className="text-sm text-[var(--admin-muted)]">That project isn’t in the database.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to={`/admin/projects/${project.id}`}
        className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline"
      >
        {project.name}
      </Link>
      <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight">Edit project</h1>
      <p className="max-w-xl text-sm text-[var(--admin-muted)]">Update this project record.</p>
      <form
        className="w-full max-w-lg space-y-4 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5 md:p-6"
        onSubmit={onSubmit}
      >
        <label className="block text-sm font-semibold">
          Project name
          <input required value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
        </label>
        <label className="block text-sm font-semibold">
          Client
          <select
            required
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            className={inputClass}
          >
            <option value="" disabled>
              Select a client
            </option>
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
          </label>
        </div>
        <label className="block text-sm font-semibold">
          Description
          <textarea
            required
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 py-2 text-sm font-normal outline-none focus:border-[rgb(0_80_240_/_0.45)]"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold">
            Start date
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={inputClass} />
          </label>
          <label className="block text-sm font-semibold">
            Target launch date
            <input
              type="date"
              value={targetLaunchDate}
              onChange={(event) => setTargetLaunchDate(event.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
