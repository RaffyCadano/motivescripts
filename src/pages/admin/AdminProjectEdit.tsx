import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { CalendarDays, CircleDollarSign, FolderKanban, GitBranch, Globe, PauseCircle, Server } from "lucide-react";
import { AdminFormCard } from "@/components/admin/AdminFormCard";
import { useAgencyProject, useLeads } from "@/components/admin/leads/LeadsProvider";
import {
  deploymentStatuses,
  emptyProjectDevelopment,
  projectBillingModes,
  projectStatuses,
  projectTypes,
  type AgencyProjectStatus,
  type AgencyProjectType,
  type DeploymentStatus,
  type ProjectBillingMode,
  type ProjectDevelopment,
} from "@/data/agencyProjects";
import { centsInputValue, parseDollarsToCents } from "@/data/money";
import { projectPackageLabels, projectPackages, type ProjectPackage } from "@/data/projectPackages";
import { checkVercelConnection } from "@/data/websitePauseRepository";
import { updateProjectRecord } from "@/data/agencyRepository";
import { AgencyDbError } from "@/lib/dbErrors";
import {
  domainHostingStatuses,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
  type DomainHostingStatus,
} from "@/data/projectDevelopment";
import { DomainHostingStatusBadge } from "@/components/admin/projects/ProjectDevelopmentSection";
import { canCoordinateAssignedWork } from "@/auth/permissions";
import { useAuth } from "@/auth/AuthProvider";

const inputClass =
  "mt-1.5 h-10 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm font-normal outline-none focus:border-[rgb(0_80_240_/_0.45)]";

type EditLocationState = {
  returnTo?: string;
  focus?: string;
};

export function AdminProjectEdit() {
  const { id = "" } = useParams();
  const match = useAgencyProject(id);
  const { profile } = useAuth();
  const canManageDomainHosting = canCoordinateAssignedWork(profile);
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
  const [projectPackage, setProjectPackage] = useState<ProjectPackage | null>(null);
  const [status, setStatus] = useState<AgencyProjectStatus>("Planning");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [targetLaunchDate, setTargetLaunchDate] = useState("");
  const [development, setDevelopment] = useState<ProjectDevelopment>(emptyProjectDevelopment());
  const [billingMode, setBillingMode] = useState<ProjectBillingMode>("fixed");
  const [hourlyRateInput, setHourlyRateInput] = useState("");
  const [budgetedHoursInput, setBudgetedHoursInput] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!project) return;
    setName(project.name);
    setClientId(project.clientId);
    setType(project.type);
    setProjectPackage(project.package);
    setStatus(project.status);
    setDescription(project.description);
    setStartDate(project.startDate);
    setTargetLaunchDate(project.targetLaunchDate);
    setBillingMode(project.billingMode);
    setHourlyRateInput(project.hourlyRateCents != null ? centsInputValue(project.hourlyRateCents) : "");
    setBudgetedHoursInput(project.budgetedHours != null ? String(project.budgetedHours) : "");
    setDevelopment(project.development);
  }, [project]);

  useEffect(() => {
    if (!project || locationState.focus !== "development") return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("project-development")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [locationState.focus, project]);

  const [checkingVercel, setCheckingVercel] = useState(false);
  const [vercelCheck, setVercelCheck] = useState<{ ok: boolean; message: string } | null>(null);

  async function onCheckVercel() {
    if (!project) return;
    setCheckingVercel(true);
    setVercelCheck(null);
    try {
      setVercelCheck(await checkVercelConnection(project.id, development.vercelProjectId, development.vercelTeamId));
    } catch (error) {
      setVercelCheck({ ok: false, message: error instanceof AgencyDbError ? error.message : "Couldn't run the check." });
    } finally {
      setCheckingVercel(false);
    }
  }

  function patchDevelopment<K extends keyof ProjectDevelopment>(key: K, value: ProjectDevelopment[K]) {
    setDevelopment((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!project || !clientId || busy) return;

    const hourlyRateCents = hourlyRateInput.trim() ? parseDollarsToCents(hourlyRateInput) : null;
    if (hourlyRateInput.trim() && hourlyRateCents === null) {
      notify("Enter a valid hourly rate.");
      return;
    }
    const budgetedHours = budgetedHoursInput.trim() ? Number(budgetedHoursInput) : null;
    if (budgetedHoursInput.trim() && (budgetedHours === null || Number.isNaN(budgetedHours) || budgetedHours < 0)) {
      notify("Enter a valid number of budgeted hours.");
      return;
    }

    setBusy(true);
    try {
      await updateProjectRecord(project.id, {
        name,
        clientId,
        type,
        package: projectPackage,
        description,
        status,
        startDate,
        targetLaunchDate,
        development,
        billingMode,
        hourlyRateCents,
        budgetedHours,
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
      <div>
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight">Edit project</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--admin-muted)]">
          {project.name}
          {" · "}
          Update this project record.
        </p>
      </div>
      <form className="w-full max-w-3xl space-y-4" onSubmit={onSubmit}>
        <AdminFormCard icon={FolderKanban} title="Basics" description="What this project is, who it is for, and where it stands.">
          <label className="block text-sm font-semibold">
            Project name
            <input required value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
          </label>
          <label className="block text-sm font-semibold">
            Client
            <select required value={clientId} onChange={(event) => setClientId(event.target.value)} className={inputClass}>
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
            Package
            <select
              value={projectPackage ?? ""}
              onChange={(event) => setProjectPackage(event.target.value === "" ? null : (event.target.value as ProjectPackage))}
              className={inputClass}
            >
              <option value="">Not set</option>
              {projectPackages.map((item) => (
                <option key={item} value={item}>
                  {projectPackageLabels[item]}
                </option>
              ))}
            </select>
            <span className="mt-1.5 block text-[12px] font-normal leading-relaxed text-[var(--admin-muted)]">
              The package this project was sold as (see the Pricing page). It pre-fills new proposals, and a client whose projects are all Website doesn't get the Files library or live website status in their portal. Leave it unset for no restrictions.
            </span>
          </label>
          <label className="block text-sm font-semibold">
            Description
            <textarea
              required
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 py-2 text-sm font-normal outline-none focus:border-[rgb(0_80_240_/_0.45)]"
            />
          </label>
        </AdminFormCard>

        <AdminFormCard icon={CalendarDays} title="Timeline">
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
        </AdminFormCard>

        <AdminFormCard
          icon={CircleDollarSign}
          title="Billing"
          description="Fixed projects can carry an optional hours budget to compare against logged time. Hourly projects use a rate to generate invoice line items from logged time."
        >
          <fieldset>
            <legend className="text-sm font-semibold">Billing mode</legend>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
              {projectBillingModes.map((mode) => (
                <label
                  key={mode}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-[var(--admin-line)] bg-white px-3 py-2.5 text-sm font-medium has-[:checked]:border-[var(--admin-blue)] has-[:checked]:bg-[rgb(0_80_240_/_0.05)]"
                >
                  <input
                    type="radio"
                    name="billing-mode"
                    value={mode}
                    checked={billingMode === mode}
                    onChange={() => setBillingMode(mode)}
                    className="size-4 accent-[var(--admin-blue)]"
                  />
                  {mode === "fixed" ? "Fixed fee" : "Hourly"}
                </label>
              ))}
            </div>
          </fieldset>
          {billingMode === "hourly" ? (
            <label className="block text-sm font-semibold">
              Hourly rate (USD)
              <input
                inputMode="decimal"
                value={hourlyRateInput}
                onChange={(event) => setHourlyRateInput(event.target.value)}
                className={inputClass}
                placeholder="0.00"
              />
            </label>
          ) : (
            <label className="block text-sm font-semibold">
              Budgeted hours <span className="font-normal text-[var(--admin-muted)]">(optional)</span>
              <input
                type="number"
                min="0"
                step="0.5"
                value={budgetedHoursInput}
                onChange={(event) => setBudgetedHoursInput(event.target.value)}
                className={inputClass}
                placeholder="Optional"
              />
            </label>
          )}
        </AdminFormCard>

        <AdminFormCard
          id="project-development"
          icon={GitBranch}
          title="Code & deployment"
          description="Manual links to GitHub and hosting. This does not change project status."
        >
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
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              Branch
              <input
                value={development.repositoryBranch}
                onChange={(event) => patchDevelopment("repositoryBranch", event.target.value)}
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
        </AdminFormCard>

        <AdminFormCard icon={Globe} title="Website" description="Where the site lives, and who hosts it.">
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
          <label className="block text-sm font-semibold">
            Hosting provider
            <input
              value={development.hostingProvider}
              onChange={(event) => patchDevelopment("hostingProvider", event.target.value)}
              className={inputClass}
            />
          </label>
        </AdminFormCard>

        <AdminFormCard
          icon={PauseCircle}
          title="Automatic pause on Vercel"
          description="Pause this site on Vercel when its free launch period ends with no Care plan, and unpause it when a plan starts or you press Unpause. Off by default: nothing goes offline unless you turn this on."
        >
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-[var(--admin-line)] bg-white px-4 py-3">
            <span className="text-sm font-semibold">
              {development.autoPauseOnVercel ? "On for this project" : "Off for this project"}
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={development.autoPauseOnVercel}
              onChange={(event) => patchDevelopment("autoPauseOnVercel", event.target.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="relative h-6 w-11 shrink-0 rounded-full bg-[var(--admin-line)] transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-[var(--admin-blue)] peer-checked:after:translate-x-5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--admin-blue)]"
            />
          </label>
          {development.autoPauseOnVercel ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold">
                  Vercel project name or ID
                  <input
                    value={development.vercelProjectId}
                    onChange={(event) => patchDevelopment("vercelProjectId", event.target.value.trim())}
                    className={inputClass}
                    placeholder="unlistedgarage"
                    required
                    autoComplete="off"
                    pattern="[A-Za-z0-9._\-]{1,100}"
                    title="Letters, digits, dot, dash and underscore only"
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Vercel team ID or slug <span className="font-normal text-[var(--admin-muted)]">(if any)</span>
                  <input
                    value={development.vercelTeamId}
                    onChange={(event) => patchDevelopment("vercelTeamId", event.target.value.trim())}
                    className={inputClass}
                    placeholder="team_… or my-team"
                    autoComplete="off"
                    pattern="[A-Za-z0-9._\-]{1,100}"
                    title="Letters, digits, dot, dash and underscore only"
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={checkingVercel || !development.vercelProjectId.trim()}
                  onClick={() => void onCheckVercel()}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--admin-line)] bg-white px-4 text-sm font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)] disabled:opacity-60"
                >
                  {checkingVercel ? "Checking…" : "Check Vercel connection"}
                </button>
                <span className="text-[12px] text-[var(--admin-muted)]">Looks the project up on Vercel. Pauses nothing.</span>
              </div>
              {vercelCheck ? (
                <p
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${
                    vercelCheck.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
                  }`}
                  role="status"
                >
                  {vercelCheck.message}
                </p>
              ) : null}
            </>
          ) : null}
        </AdminFormCard>

        <AdminFormCard
          icon={Server}
          title="Domain & hosting delivery"
          description="The agency's own tracking of domain and hosting setup for this project. Domains and hosting are handled externally: nothing here purchases or configures anything."
        >
          {canManageDomainHosting ? (
            <>
              <label className="block text-sm font-semibold">
                Domain name
                <input
                  type="text"
                  autoComplete="off"
                  placeholder="example.com"
                  value={development.domainName}
                  onChange={(event) => patchDevelopment("domainName", event.target.value)}
                  className={inputClass}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold">
                  Domain status
                  <select
                    value={development.domainStatus}
                    onChange={(event) => patchDevelopment("domainStatus", event.target.value as DomainHostingStatus)}
                    className={inputClass}
                  >
                    {domainHostingStatuses.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-semibold">
                  Hosting status
                  <select
                    value={development.hostingStatus}
                    onChange={(event) => patchDevelopment("hostingStatus", event.target.value as DomainHostingStatus)}
                    className={inputClass}
                  >
                    {domainHostingStatuses.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[12px] text-[var(--admin-muted)]">Domain</p>
                <p className="mt-1 text-sm font-medium text-[var(--admin-ink)]">
                  {development.domainName.trim() || "Not configured"}
                </p>
                <div className="mt-1.5">
                  <DomainHostingStatusBadge status={development.domainStatus} />
                </div>
              </div>
              <div>
                <p className="text-[12px] text-[var(--admin-muted)]">Hosting</p>
                <p className="mt-1 text-sm font-medium text-[var(--admin-ink)]">
                  {development.hostingProvider.trim() || "Not configured"}
                </p>
                <div className="mt-1.5">
                  <DomainHostingStatusBadge status={development.hostingStatus} />
                </div>
              </div>
              <p className="text-[12px] text-[var(--admin-muted)] sm:col-span-2">
                Only an admin or the assigned project manager can update domain and hosting status.
              </p>
            </div>
          )}
        </AdminFormCard>

        <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-end gap-3 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)]/95 px-4 py-3 shadow-[0_-6px_18px_rgb(0_16_48_/_0.06)] backdrop-blur">
          <Link to={returnTo} className="inline-flex h-10 items-center px-3 text-sm font-semibold text-[var(--admin-muted)] hover:text-[var(--admin-ink)]">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-5 font-heading text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
