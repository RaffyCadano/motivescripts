import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAgencyProject, useLeads } from "@/components/admin/leads/LeadsProvider";
import {
  deploymentStatuses,
  emptyProjectDevelopment,
  projectStatuses,
  projectTypes,
  type AgencyProjectStatus,
  type AgencyProjectType,
  type DeploymentStatus,
  type ProjectDevelopment,
} from "@/data/agencyProjects";
import { updateProjectRecord } from "@/data/agencyRepository";
import { AgencyDbError } from "@/lib/dbErrors";
import { toDatetimeLocalValue, fromDatetimeLocalValue } from "@/data/projectDevelopment";

const inputClass =
  "mt-1.5 h-10 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm font-normal outline-none focus:border-[rgb(0_80_240_/_0.45)]";

type EditLocationState = {
  returnTo?: string;
  focus?: string;
};

export function AdminProjectEdit() {
  const { id = "" } = useParams();
  const match = useAgencyProject(id);
  const { clients, notify, reload } = useLeads();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = (location.state as EditLocationState | null) ?? {};
  const project = match?.project;
  const client = match?.client;
  const returnTo = locationState.returnTo ?? (project ? `/admin/projects/${project.id}` : "/admin/projects");
  const backLabel = returnTo.includes("/admin/clients/") ? (client?.businessName ?? "Client") : (project?.name ?? "Project");
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [type, setType] = useState<AgencyProjectType>("Website");
  const [status, setStatus] = useState<AgencyProjectStatus>("Planning");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [targetLaunchDate, setTargetLaunchDate] = useState("");
  const [development, setDevelopment] = useState<ProjectDevelopment>(emptyProjectDevelopment());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!project) return;
    setName(project.name);
    setClientId(project.clientId);
    setType(project.type);
    setStatus(project.status);
    setDescription(project.description);
    setStartDate(project.startDate);
    setTargetLaunchDate(project.targetLaunchDate);
    setDevelopment(project.development);
  }, [project]);

  useEffect(() => {
    if (!project || locationState.focus !== "development") return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("project-development")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [locationState.focus, project]);

  function patchDevelopment<K extends keyof ProjectDevelopment>(key: K, value: ProjectDevelopment[K]) {
    setDevelopment((current) => ({ ...current, [key]: value }));
  }

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
        development,
      });
      await reload();
      notify("Project updated.");
      navigate(returnTo);
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
      <Link to={returnTo} className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline">
        {backLabel}
      </Link>
      <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight">Edit project</h1>
      <p className="max-w-2xl text-sm text-[var(--admin-muted)]">Update this project record.</p>
      <form
        className="w-full max-w-2xl space-y-4 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5 md:p-6"
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
            {clients.map((item) => (
              <option key={item.id} value={item.id}>
                {item.businessName}
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
        <fieldset id="project-development" className="scroll-mt-6 space-y-4 border-t border-[var(--admin-line)] pt-4">
          <legend className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">
            Development
          </legend>
          <p className="text-sm text-[var(--admin-muted)]">
            Manual links to GitHub and hosting. This does not change project status.
          </p>
          <label className="block text-sm font-semibold">
            Repository URL
            <input
              type="text"
              inputMode="url"
              autoComplete="off"
              value={development.repositoryUrl}
              onChange={(event) => patchDevelopment("repositoryUrl", event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block text-sm font-semibold">
            Branch
            <input
              value={development.repositoryBranch}
              onChange={(event) => patchDevelopment("repositoryBranch", event.target.value)}
              className={inputClass}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              Staging URL
              <input
                type="text"
                inputMode="url"
                autoComplete="off"
                value={development.stagingUrl}
                onChange={(event) => patchDevelopment("stagingUrl", event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-semibold">
              Production URL
              <input
                type="text"
                inputMode="url"
                autoComplete="off"
                value={development.productionUrl}
                onChange={(event) => patchDevelopment("productionUrl", event.target.value)}
                className={inputClass}
              />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              Hosting provider
              <input
                value={development.hostingProvider}
                onChange={(event) => patchDevelopment("hostingProvider", event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-semibold">
              Deployment status
              <select
                value={development.deploymentStatus}
                onChange={(event) => patchDevelopment("deploymentStatus", event.target.value as DeploymentStatus)}
                className={inputClass}
              >
                {deploymentStatuses.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-sm font-semibold">
            Last deployment
            <input
              type="datetime-local"
              value={toDatetimeLocalValue(development.lastDeployedAt)}
              onChange={(event) => patchDevelopment("lastDeployedAt", fromDatetimeLocalValue(event.target.value))}
              className={inputClass}
            />
          </label>
        </fieldset>
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
