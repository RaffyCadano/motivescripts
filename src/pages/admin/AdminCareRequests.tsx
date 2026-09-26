import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { TaskPriorityBadge } from "@/components/admin/projects/TaskPriorityBadge";
import { AdminPageHeader } from "@/components/admin/list/AdminPageHeader";
import { adminFilterControlState } from "@/components/admin/list/adminListStyles";
import {
  CARE_REQUEST_CATEGORY_LABELS,
  CARE_REQUEST_TYPE_LABELS,
  CARE_REQUEST_STATUS_LABELS,
  careRequestCategories,
  careRequestPriorities,
  careRequestStatuses,
  filterCareRequests,
  sortCareRequests,
  type CareRequest,
  type CareRequestBillingDecision,
  type CareRequestCategory,
  type CareRequestFile,
  type CareRequestPriority,
  type CareRequestStatus,
} from "@/data/careRequests";
import {
  convertCareRequestToTask,
  fetchCareRequestFiles,
  listCareRequests,
  resolveCareRequest,
  setCareRequestPriority,
  setCareRequestStatus,
} from "@/data/careRequestsRepository";
import { signedUrlForPath } from "@/data/fileStorage";
import { AgencyDbError } from "@/lib/dbErrors";
import type { AgencyTaskPriority } from "@/data/agencyProjects";

function formatRequestDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function AdminCareRequests() {
  const { clients, projects } = useLeads();
  const [requests, setRequests] = useState<CareRequest[]>([]);
  const [filesByRequest, setFilesByRequest] = useState<Record<string, CareRequestFile[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<CareRequestStatus | "All">("New");
  const [priority, setPriority] = useState<CareRequestPriority | "All">("All");
  const [clientId, setClientId] = useState<string | "All">("All");
  const [category, setCategory] = useState<CareRequestCategory | "All">("All");
  const [billingFilter, setBillingFilter] = useState<CareRequestBillingDecision | "All" | "Undecided">("All");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Map<string, string>>(new Map());

  async function reload() {
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await listCareRequests();
      setRequests(rows);
      setFilesByRequest(await fetchCareRequestFiles(rows.map((row) => row.id)));
    } catch (caught) {
      setLoadError(caught instanceof AgencyDbError ? caught.message : "Unable to load care requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function onBillingDecision(request: CareRequest, decision: CareRequestBillingDecision) {
    setBusyId(request.id);
    setRowError((current) => {
      const next = new Map(current);
      next.delete(request.id);
      return next;
    });
    try {
      await resolveCareRequest({ requestId: request.id, billingDecision: decision });
      setRequests((current) => current.map((row) => (row.id === request.id ? { ...row, billingDecision: decision } : row)));
    } catch (caught) {
      setRowError((current) => new Map(current).set(request.id, caught instanceof AgencyDbError ? caught.message : "Unable to save this."));
    } finally {
      setBusyId(null);
    }
  }

  async function onConvertToTask(request: CareRequest) {
    setBusyId(request.id);
    setRowError((current) => {
      const next = new Map(current);
      next.delete(request.id);
      return next;
    });
    try {
      const taskId = await convertCareRequestToTask(request);
      setRequests((current) =>
        current.map((row) => (row.id === request.id ? { ...row, billingDecision: "included", resultingTaskId: taskId } : row)),
      );
    } catch (caught) {
      setRowError((current) => new Map(current).set(request.id, caught instanceof AgencyDbError ? caught.message : "Unable to create a task."));
    } finally {
      setBusyId(null);
    }
  }

  const clientsById = useMemo(() => new Map(clients.map((client) => [client.id, client.businessName])), [clients]);
  const projectsById = useMemo(() => new Map(projects.map((project) => [project.id, project.name])), [projects]);
  const clientOptions = useMemo(() => {
    const ids = new Set(requests.map((request) => request.clientId));
    return clients.filter((client) => ids.has(client.id));
  }, [clients, requests]);

  const searchTerm = search.trim().toLowerCase();
  const visible = useMemo(() => {
    const filtered = filterCareRequests(requests, { status, priority, clientId, category, billingDecision: billingFilter });
    // The search looks at the request text, the client and project names, and the request type and category.
    const matching = searchTerm
      ? filtered.filter((request) =>
          [
            request.message,
            clientsById.get(request.clientId),
            projectsById.get(request.projectId),
            CARE_REQUEST_TYPE_LABELS[request.requestType],
            CARE_REQUEST_CATEGORY_LABELS[request.category],
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(searchTerm)),
        )
      : filtered;
    return sortCareRequests(matching);
  }, [requests, status, priority, clientId, category, billingFilter, searchTerm, clientsById, projectsById]);
  const openCount = useMemo(() => requests.filter((request) => request.status !== "Done").length, [requests]);
  const newAdditionOpenCount = useMemo(
    () => requests.filter((request) => request.status !== "Done" && request.category === "new_addition").length,
    [requests],
  );

  async function onPriorityChange(id: string, next: CareRequestPriority) {
    setBusyId(id);
    setRowError((current) => {
      const nextMap = new Map(current);
      nextMap.delete(id);
      return nextMap;
    });
    try {
      await setCareRequestPriority(id, next);
      setRequests((current) => current.map((request) => (request.id === id ? { ...request, priority: next } : request)));
    } catch (caught) {
      setRowError((current) => new Map(current).set(id, caught instanceof AgencyDbError ? caught.message : "Unable to update this."));
    } finally {
      setBusyId(null);
    }
  }

  async function onStatusChange(id: string, next: CareRequestStatus) {
    setBusyId(id);
    setRowError((current) => {
      const nextMap = new Map(current);
      nextMap.delete(id);
      return nextMap;
    });
    try {
      await setCareRequestStatus(id, next);
      setRequests((current) => current.map((request) => (request.id === id ? { ...request, status: next } : request)));
    } catch (caught) {
      setRowError((current) => new Map(current).set(id, caught instanceof AgencyDbError ? caught.message : "Unable to update this."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="Care requests"
        description={`Website Care asks from clients, oldest and most urgent first. ${openCount} open${newAdditionOpenCount > 0 ? `, ${newAdditionOpenCount} of those a new addition that may need a quote` : ""}.`}
      />

      <label className="mt-6 block">
        <span className="sr-only">Search care requests</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search requests, clients, or projects"
          className={adminFilterControlState(Boolean(searchTerm))}
        />
      </label>

      <div className="mt-3 grid gap-3 sm:grid-cols-5">
        <label className="block">
          <span className="sr-only">Filter by status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as CareRequestStatus | "All")}
            className={adminFilterControlState(status !== "All")}
          >
            <option value="All">All statuses</option>
            {careRequestStatuses.map((item) => (
              <option key={item} value={item}>
                {CARE_REQUEST_STATUS_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="sr-only">Filter by priority</span>
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value as CareRequestPriority | "All")}
            className={adminFilterControlState(priority !== "All")}
          >
            <option value="All">All priorities</option>
            {careRequestPriorities.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="sr-only">Filter by client</span>
          <select
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            className={adminFilterControlState(clientId !== "All")}
          >
            <option value="All">All clients</option>
            {clientOptions.map((client) => (
              <option key={client.id} value={client.id}>
                {client.businessName}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="sr-only">Filter by category</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as CareRequestCategory | "All")}
            className={adminFilterControlState(category !== "All")}
          >
            <option value="All">All categories</option>
            {careRequestCategories.map((item) => (
              <option key={item} value={item}>
                {CARE_REQUEST_CATEGORY_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="sr-only">Filter by billing decision</span>
          <select
            value={billingFilter}
            onChange={(event) => setBillingFilter(event.target.value as CareRequestBillingDecision | "All" | "Undecided")}
            className={adminFilterControlState(billingFilter !== "All")}
          >
            <option value="All">Any billing decision</option>
            <option value="Undecided">Not decided yet</option>
            <option value="included">Included in plan</option>
            <option value="billable">Billable</option>
          </select>
        </label>
      </div>

      {loading ? (
        <div className="mt-6 h-40 animate-pulse rounded-[var(--admin-radius)] bg-[var(--admin-bg)]" />
      ) : loadError ? (
        <p className="mt-6 text-sm text-[#b45309]">{loadError}</p>
      ) : visible.length === 0 ? (
        <div className="mt-8 rounded-[var(--admin-radius)] border border-dashed border-[var(--admin-line)] bg-[var(--admin-card)] px-5 py-10 text-center text-sm text-[var(--admin-muted)]">
          {searchTerm ? "Nothing matches your search and filters." : "Nothing matches these filters."}
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {visible.map((request) => {
            const busy = busyId === request.id;
            const error = rowError.get(request.id);
            return (
              <li
                key={request.id}
                className={`rounded-[var(--admin-radius)] border bg-[var(--admin-card)] p-4 ${
                  request.category === "new_addition"
                    ? "border-[rgb(124_58_237_/_0.35)] border-l-4 border-l-[#7c3aed]"
                    : "border-[var(--admin-line)]"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    {request.category === "new_addition" ? (
                      <span className="mb-1.5 inline-flex items-center rounded-full bg-[rgb(124_58_237_/_0.1)] px-2.5 py-1 text-xs font-semibold text-[#6d28d9]">
                        New addition — may need a quote
                      </span>
                    ) : null}
                    <p className="text-sm font-semibold text-[var(--admin-ink)]">
                      {clientsById.get(request.clientId) ?? "Unknown client"}
                      <span className="mx-1.5 text-[var(--admin-muted)]">·</span>
                      <Link to={`/admin/projects/${request.projectId}`} className="font-normal text-[var(--admin-blue)] hover:underline">
                        {projectsById.get(request.projectId) ?? "Project"}
                      </Link>
                    </p>
                    <p className="mt-1.5 max-w-2xl text-sm text-[var(--admin-ink)]">{request.message}</p>
                    <p className="mt-1.5 text-[12px] text-[var(--admin-muted)]">
                      {CARE_REQUEST_TYPE_LABELS[request.requestType]} · Sent {formatRequestDate(request.createdAt)}
                      {request.hasActiveCarePlan ? null : request.inLaunchTrial ? (
                        <span className="ml-2 rounded-full border border-[rgb(0_80_240_/_0.35)] bg-[rgb(0_80_240_/_0.06)] px-2 py-0.5 font-semibold text-[var(--admin-blue)]">
                          Launch trial
                        </span>
                      ) : (
                        <span className="ml-2 rounded-full border border-[rgb(217_119_6_/_0.4)] bg-[rgb(217_119_6_/_0.06)] px-2 py-0.5 font-semibold text-[#92610a]">
                          No active Care plan
                        </span>
                      )}
                    </p>
                    {(filesByRequest[request.id] ?? []).length > 0 ? (
                      <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                        {(filesByRequest[request.id] ?? []).map((file) => (
                          <li key={file.id}>
                            <button
                              type="button"
                              className="text-[12px] text-[var(--admin-blue)] hover:underline"
                              onClick={() => void signedUrlForPath(file.storagePath).then((url) => window.open(url, "_blank"))}
                            >
                              📎 {file.fileName}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1.5">
                      <span className="sr-only">Priority for this request</span>
                      <TaskPriorityBadge priority={request.priority as AgencyTaskPriority} />
                      <select
                        value={request.priority}
                        disabled={busy}
                        onChange={(event) => void onPriorityChange(request.id, event.target.value as CareRequestPriority)}
                        aria-label={`Change priority for this request`}
                        className="h-8 rounded-lg border border-[var(--admin-line)] bg-white px-1.5 text-xs outline-none focus:border-[rgb(0_80_240_/_0.45)]"
                      >
                        {careRequestPriorities.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </label>
                    <select
                      value={request.status}
                      disabled={busy}
                      onChange={(event) => void onStatusChange(request.id, event.target.value as CareRequestStatus)}
                      aria-label="Change status for this request"
                      className="h-8 rounded-lg border border-[var(--admin-line)] bg-white px-1.5 text-xs font-semibold outline-none focus:border-[rgb(0_80_240_/_0.45)]"
                    >
                      {careRequestStatuses.map((item) => (
                        <option key={item} value={item}>
                          {CARE_REQUEST_STATUS_LABELS[item]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--admin-line)] pt-3">
                  {request.billingDecision ? (
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                        request.billingDecision === "billable"
                          ? "bg-[rgb(217_119_6_/_0.1)] text-[#92610a]"
                          : "bg-[rgb(16_185_129_/_0.1)] text-emerald-800"
                      }`}
                    >
                      {request.billingDecision === "billable" ? "Billable" : "Included"}
                    </span>
                  ) : (
                    <>
                      <span className="text-[12px] font-semibold text-[var(--admin-muted)]">Billing:</span>
                      <button
                        type="button"
                        disabled={busy}
                        className="h-8 rounded-lg border border-[var(--admin-line)] px-2.5 text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)] disabled:opacity-50"
                        onClick={() => void onConvertToTask(request)}
                      >
                        Included → Convert to task
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="h-8 rounded-lg border border-[var(--admin-line)] px-2.5 text-[12px] font-semibold text-[#92610a] hover:bg-[var(--admin-bg)] disabled:opacity-50"
                        onClick={() => void onBillingDecision(request, "billable")}
                      >
                        Mark billable
                      </button>
                    </>
                  )}
                  {request.billingDecision === "billable" && !request.resultingInvoiceId && !request.resultingProjectId ? (
                    <>
                      <Link
                        to={`/admin/invoices/new?client=${request.clientId}&project=${request.projectId}&careRequest=${request.id}`}
                        className="inline-flex h-8 items-center rounded-lg border border-[var(--admin-line)] px-2.5 text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
                      >
                        Create invoice
                      </Link>
                      <Link
                        to={`/admin/projects/new?client=${request.clientId}&careRequest=${request.id}`}
                        className="inline-flex h-8 items-center rounded-lg border border-[var(--admin-line)] px-2.5 text-[12px] font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)]"
                      >
                        Create project
                      </Link>
                    </>
                  ) : null}
                  {request.resultingTaskId ? (
                    <Link
                      to={`/admin/projects/${request.projectId}?tab=tasks`}
                      className="text-[12px] font-semibold text-[var(--admin-blue)] hover:underline"
                    >
                      View task →
                    </Link>
                  ) : null}
                  {request.resultingInvoiceId ? (
                    <Link to={`/admin/invoices/${request.resultingInvoiceId}`} className="text-[12px] font-semibold text-[var(--admin-blue)] hover:underline">
                      View invoice →
                    </Link>
                  ) : null}
                  {request.resultingProjectId ? (
                    <Link to={`/admin/projects/${request.resultingProjectId}`} className="text-[12px] font-semibold text-[var(--admin-blue)] hover:underline">
                      View project →
                    </Link>
                  ) : null}
                </div>
                {error ? <p className="mt-2 text-[12px] text-[#b45309]">{error}</p> : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
