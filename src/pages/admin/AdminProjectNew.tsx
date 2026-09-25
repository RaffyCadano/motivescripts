import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, ClipboardCheck, FolderKanban, Package, Users } from "lucide-react";
import { adminBlueBtn, adminGhostBtn, adminPrimaryBtn } from "@/components/admin/adminActionStyles";
import { AdminFormCard } from "@/components/admin/AdminFormCard";
import { AdminWizardSteps } from "@/components/admin/AdminWizardSteps";
import { NeedClientEmpty } from "@/components/admin/NeedClientEmpty";
import { ProjectScopeSummary } from "@/components/admin/projects/ProjectScopeSummary";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { formatProjectDay, projectTypes, type AgencyProjectType } from "@/data/agencyProjects";
import { projectPackageLabels, projectPackages, type ProjectPackage } from "@/data/projectPackages";
import { describePackageSuggestion, suggestProjectPackage } from "@/data/scopePackageHint";
import { projectDescriptionFromBrief, scopeStatus, suggestedProjectName, type ClientScopeBrief } from "@/data/scopeBriefs";
import { fetchClientScopeBrief } from "@/data/scopeBriefsRepository";
import { CARE_REQUEST_TYPE_LABELS } from "@/data/careRequests";
import { fetchCareRequestById, resolveCareRequest } from "@/data/careRequestsRepository";
import { AgencyDbError } from "@/lib/dbErrors";

const inputClass =
  "mt-1.5 h-10 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm font-normal outline-none focus:border-[rgb(0_80_240_/_0.45)]";

/** Shown only as a placeholder: never pre-filled, because nothing is "agreed" until the scope is in. */
const descriptionPlaceholder =
  "Describe what will be built, for example: Design and develop a professional website with a mobile-friendly layout and a clear way for visitors to get in touch.";

const WIZARD_STEPS = ["Client", "Package", "Details", "Review"] as const;

export function AdminProjectNew() {
  const { clients, addProject, notify } = useLeads();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetClient = searchParams.get("client") ?? "";
  /** Set when this project is being created for a billable Website Care request (a major redesign or
   * new feature outside the plan's scope) -- prefills name/description and links back afterward. */
  const presetCareRequest = searchParams.get("careRequest") ?? "";
  const lockedClient = clients.some((client) => client.id === presetClient);
  // A link that names a client we can't find gets a notice, never a silent fallback to some other client.
  const presetMissing = Boolean(presetClient) && !lockedClient;
  const [name, setName] = useState("");
  // Empty until a client is chosen (or the link names one). Never default to the first client in the list.
  const [clientId, setClientId] = useState(lockedClient ? presetClient : "");
  const [type, setType] = useState<AgencyProjectType>("Website");
  const [projectPackage, setProjectPackage] = useState<ProjectPackage | null>(null);
  // Once staff touch the Package dropdown, the client's requested package stops pre-filling it.
  const packageTouched = useRef(false);
  const [description, setDescription] = useState("");
  const [brief, setBrief] = useState<ClientScopeBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(Boolean(clientId));
  const [startDate, setStartDate] = useState("");
  const [targetLaunchDate, setTargetLaunchDate] = useState("");
  const [busy, setBusy] = useState(false);
  // A link that already names the client starts on the Package step; otherwise the first step is choosing the client.
  const [step, setStep] = useState(lockedClient ? 1 : 0);
  // Steps the person has tried to leave while incomplete, so their messages only show after that.
  const [attempted, setAttempted] = useState<number[]>([]);
  // What we last auto-suggested, so a suggestion is only replaced while the person has not edited it.
  const lastSuggestedName = useRef("");
  const lastSuggestedDescription = useRef("");
  const clientsRef = useRef(clients);
  clientsRef.current = clients;
  const selectedClient = clients.find((client) => client.id === clientId);
  const datesInvalid = Boolean(startDate && targetLaunchDate && targetLaunchDate < startDate);
  const briefDescription = useMemo(() => (brief ? projectDescriptionFromBrief(brief) : ""), [brief]);
  const fromBrief = briefDescription !== "" && description === briefDescription;
  // A package worked out from the pages and features they picked (a suggestion only; staff choose the package).
  const suggestion = useMemo(
    () => (brief && scopeStatus(brief) !== "not_started" ? suggestProjectPackage(brief.selectedPages, brief.features) : null),
    [brief],
  );

  // Pre-select the package the client asked for on their Website Scope, until staff choose one themselves.
  useEffect(() => {
    if (!packageTouched.current) setProjectPackage(brief?.requestedPackage ?? null);
  }, [brief]);

  // Runs when the chosen client changes, not on every background refresh of the client list.
  useEffect(() => {
    if (!clientId) {
      setBrief(null);
      setBriefLoading(false);
      return;
    }
    let active = true;

    // The name suggestion does not depend on the network, so apply it right away.
    const client = clientsRef.current.find((item) => item.id === clientId);
    const nextName = client ? suggestedProjectName(client.businessName) : "";
    // Capture the previous suggestion first: React runs the updater below later, after the ref has moved on.
    const previousName = lastSuggestedName.current;
    setName((current) => (current === "" || current === previousName ? nextName : current));
    lastSuggestedName.current = nextName;

    const applyDescription = (row: ClientScopeBrief | null) => {
      const next = row ? projectDescriptionFromBrief(row) : "";
      const previous = lastSuggestedDescription.current;
      setDescription((current) => (current === "" || current === previous ? next : current));
      lastSuggestedDescription.current = next;
    };

    setBriefLoading(true);
    void fetchClientScopeBrief(clientId)
      .then((row) => {
        if (!active) return;
        setBrief(row);
        applyDescription(row);
      })
      .catch(() => {
        if (!active) return;
        setBrief(null);
        applyDescription(null);
      })
      .finally(() => {
        if (active) setBriefLoading(false);
      });
    return () => {
      active = false;
    };
  }, [clientId]);

  // Prefill from the billable Website Care request this project is being created for, once (only
  // while the fields are still empty -- never overwrites something the admin already typed).
  useEffect(() => {
    if (!presetCareRequest) return;
    let active = true;
    void fetchCareRequestById(presetCareRequest)
      .then((request) => {
        if (!active || !request) return;
        setName((current) => current || `${CARE_REQUEST_TYPE_LABELS[request.requestType]} request`);
        setDescription((current) => current || request.message);
      })
      .catch(() => {
        /* best effort -- the admin can still fill this in by hand */
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetCareRequest]);

  async function create() {
    if (!clientId || busy) return;
    if (datesInvalid) {
      notify("The target launch date can't be before the start date.");
      return;
    }
    setBusy(true);
    try {
      const id = await addProject({
        name,
        clientId,
        type,
        package: projectPackage,
        description,
        // Always Planning: production statuses are reached through the workflow (proposal, contract,
        // payment, design approval), and "In Development" would unlock development without design approval.
        status: "Planning",
        startDate,
        targetLaunchDate,
      });
      if (!id) {
        notify("Unable to create this project.");
        setBusy(false);
        return;
      }
      if (presetCareRequest) {
        // Best effort -- the project itself already saved successfully; a failure here just means the
        // Website Care request won't show its "resulting project" link and can be linked manually later.
        await resolveCareRequest({
          requestId: presetCareRequest,
          billingDecision: "billable",
          resultingProjectId: id,
        }).catch(() => {});
      }
      navigate(`/admin/projects/${id}`);
    } catch (error) {
      notify(error instanceof AgencyDbError ? error.message : "Unable to create this project.");
      setBusy(false);
    }
  }

  /** What is still missing on a step. Empty when the step is complete. */
  function stepIssues(index: number): string[] {
    if (index === 0) return clientId ? [] : ["Choose a client to continue."];
    if (index === 2) {
      const issues: string[] = [];
      if (!name.trim()) issues.push("Enter a project name.");
      if (!description.trim()) issues.push("Add a description of what will be built.");
      if (datesInvalid) issues.push("The target launch date can't be before the start date.");
      return issues;
    }
    return [];
  }

  /** The earliest incomplete step before `target`, or null when the person may go there. */
  function blockedStep(target: number): number | null {
    for (let index = 0; index < target; index += 1) {
      if (stepIssues(index).length > 0) return index;
    }
    return null;
  }

  function goToStep(target: number) {
    const blocked = blockedStep(target);
    if (blocked !== null) {
      setAttempted((current) => (current.includes(blocked) ? current : [...current, blocked]));
      setStep(blocked);
    } else {
      setStep(target);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    // Enter inside a field on an earlier step means "next", not "create".
    if (step < WIZARD_STEPS.length - 1) {
      goToStep(step + 1);
      return;
    }
    if (blockedStep(step) !== null) {
      goToStep(step);
      return;
    }
    void create();
  }

  const shownIssues = attempted.includes(step) ? stepIssues(step) : [];
  const lastStep = step === WIZARD_STEPS.length - 1;
  const packageLine = projectPackage ? projectPackageLabels[projectPackage] : "Not set (no package restrictions)";

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
        <form className="grid w-full gap-4" onSubmit={onSubmit} noValidate>
          <AdminWizardSteps steps={WIZARD_STEPS} current={step} onGo={goToStep} hint="Takes about a minute" />

          {step === 0 ? (
            <>
              <AdminFormCard icon={Users} title="Which client is this for?" description="The project is created for this client, and their Website Scope is shown below.">
                <label className="block text-sm font-semibold">
                  Client
                  <select
                    disabled={lockedClient}
                    value={clientId}
                    onChange={(event) => setClientId(event.target.value)}
                    aria-invalid={shownIssues.length > 0 || undefined}
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
                  {presetMissing ? (
                    <span className="mt-1.5 block text-[12px] font-normal text-amber-800">
                      The client in that link could not be found. Choose a client below.
                    </span>
                  ) : null}
                </label>
              </AdminFormCard>
              {selectedClient ? <ProjectScopeSummary client={selectedClient} brief={brief} loading={briefLoading} /> : null}
            </>
          ) : null}

          {step === 1 ? (
            <>
              <AdminFormCard icon={Package} title="Type and package" description="What kind of project this is, and the package it was sold as.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-semibold">
                    Project type
                    <select value={type} onChange={(event) => setType(event.target.value as AgencyProjectType)} className={inputClass}>
                      {projectTypes.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="block text-sm font-semibold">
                    Status
                    <p className="mt-1.5 flex h-10 items-center rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] px-3 text-sm font-normal text-[var(--admin-ink)]">
                      Planning
                    </p>
                  </div>
                </div>
                <p className="-mt-1 text-[12px] leading-relaxed text-[var(--admin-muted)]">
                  New projects always start in Planning. Production starts later, after proposal, contract, and payment.
                </p>
                <label className="block text-sm font-semibold">
                  Package
                  <select
                    value={projectPackage ?? ""}
                    onChange={(event) => {
                      packageTouched.current = true;
                      setProjectPackage(event.target.value === "" ? null : (event.target.value as ProjectPackage));
                    }}
                    className={inputClass}
                  >
                    <option value="">Not set</option>
                    {projectPackages.map((item) => (
                      <option key={item} value={item}>
                        {projectPackageLabels[item]}
                      </option>
                    ))}
                  </select>
                  {suggestion ? (
                    <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] px-3 py-2 text-[12px] font-normal text-[var(--admin-ink)]">
                      <span>
                        {brief?.requestedPackage ? "Suggested from their scope: " : "The client wasn’t sure of a package. Suggested from their scope: "}
                        <strong className="font-semibold">{describePackageSuggestion(suggestion)}</strong>
                      </span>
                      {projectPackage !== suggestion.package ? (
                        <button
                          type="button"
                          className="font-heading font-semibold text-[var(--admin-blue)] hover:underline"
                          onClick={() => {
                            packageTouched.current = true;
                            setProjectPackage(suggestion.package);
                          }}
                        >
                          Use suggestion
                        </button>
                      ) : (
                        <span className="text-[var(--admin-muted)]">Selected</span>
                      )}
                    </span>
                  ) : null}
                  <span className="mt-1.5 block text-[12px] font-normal text-[var(--admin-muted)]">
                    {brief?.requestedPackage && !packageTouched.current ? `Pre-filled from what the client chose on their Website Scope (${projectPackageLabels[brief.requestedPackage]}). ` : ""}The package this project was sold as (see the Pricing page). It pre-fills new proposals, and a client whose projects are all Website doesn't get the Files library or live website status in their portal. Leave it unset for no restrictions.
                  </span>
                </label>
              </AdminFormCard>
              {selectedClient ? <ProjectScopeSummary client={selectedClient} brief={brief} loading={briefLoading} /> : null}
            </>
          ) : null}

          {step === 2 ? (
            <AdminFormCard icon={FolderKanban} title="Project details" description="The name, what will be built, and optional planning dates.">
              <label className="block text-sm font-semibold">
                Project name
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  aria-invalid={(shownIssues.length > 0 && !name.trim()) || undefined}
                  className={inputClass}
                />
              </label>
              <label className="block text-sm font-semibold">
                Description
                <textarea
                  rows={6}
                  value={description}
                  placeholder={descriptionPlaceholder}
                  onChange={(event) => setDescription(event.target.value)}
                  aria-invalid={(shownIssues.length > 0 && !description.trim()) || undefined}
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
                  <input
                    type="date"
                    value={startDate}
                    max={targetLaunchDate || undefined}
                    onChange={(event) => setStartDate(event.target.value)}
                    className={inputClass}
                  />
                  <span className="mt-1.5 block text-[12px] font-normal text-[var(--admin-muted)]">
                    Optional — set when you expect to begin work.
                  </span>
                </label>
                <label className="block text-sm font-semibold">
                  Target launch date
                  <input
                    type="date"
                    value={targetLaunchDate}
                    min={startDate || undefined}
                    onChange={(event) => setTargetLaunchDate(event.target.value)}
                    aria-invalid={datesInvalid || undefined}
                    className={inputClass}
                  />
                  {datesInvalid ? (
                    <span role="alert" className="mt-1.5 block text-[12px] font-normal text-[#b42318]">
                      The target launch date can&apos;t be before the start date.
                    </span>
                  ) : (
                    <span className="mt-1.5 block text-[12px] font-normal text-[var(--admin-muted)]">
                      Optional — set an estimated launch date for planning.
                    </span>
                  )}
                </label>
              </div>
            </AdminFormCard>
          ) : null}

          {step === 3 ? (
            <AdminFormCard icon={ClipboardCheck} title="Review and create" description="Check the details. Use Edit to change anything before the project is created.">
              <dl className="divide-y divide-[var(--admin-line)] rounded-lg border border-[var(--admin-line)]">
                {[
                  { label: "Client", value: selectedClient?.businessName ?? "—", go: 0 },
                  { label: "Project name", value: name, go: 2 },
                  { label: "Type", value: type, go: 1 },
                  { label: "Status", value: "Planning", go: null },
                  { label: "Package", value: packageLine, go: 1 },
                  { label: "Description", value: description, go: 2, long: true },
                  { label: "Start date", value: startDate ? formatProjectDay(startDate) : "Not set", go: 2 },
                  { label: "Target launch", value: targetLaunchDate ? formatProjectDay(targetLaunchDate) : "Not set", go: 2 },
                ].map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <dt className="text-[12px] text-[var(--admin-muted)]">{row.label}</dt>
                      <dd className={row.long ? "mt-0.5 line-clamp-6 whitespace-pre-wrap text-sm text-[var(--admin-ink)]" : "mt-0.5 text-sm font-semibold text-[var(--admin-ink)]"}>
                        {row.value}
                      </dd>
                    </div>
                    {row.go !== null ? (
                      <button
                        type="button"
                        className="shrink-0 font-heading text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
                        onClick={() => goToStep(row.go)}
                      >
                        Edit
                      </button>
                    ) : null}
                  </div>
                ))}
              </dl>
              <p className="text-[12px] leading-5 text-[var(--admin-muted)]">
                This creates the project workspace. Proposal, contract, invoice, and production steps can be completed afterward.
              </p>
            </AdminFormCard>
          ) : null}

          {shownIssues.length > 0 ? (
            <ul role="alert" className="space-y-1 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-[#b42318]">
              {shownIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {step > 0 ? (
                <button type="button" disabled={busy} className={adminGhostBtn} onClick={() => goToStep(step - 1)}>
                  <ArrowLeft size={15} aria-hidden="true" className="mr-1.5" />
                  Back
                </button>
              ) : (
                <Link to="/admin/projects" className={adminGhostBtn}>
                  Cancel
                </Link>
              )}
            </div>
            {lastStep ? (
              <button type="submit" disabled={busy || datesInvalid || !clientId} className={adminPrimaryBtn}>
                {busy ? "Creating…" : "Create Project"}
              </button>
            ) : (
              <button type="submit" className={adminBlueBtn}>
                Next
                <ArrowRight size={15} aria-hidden="true" className="ml-1.5" />
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
