import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { NeedClientEmpty } from "@/components/admin/NeedClientEmpty";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import {
  projectStatuses,
  projectTypes,
  type AgencyProjectStatus,
  type AgencyProjectType,
} from "@/data/agencyProjects";
import { projectDescriptionFromBrief, suggestedProjectName } from "@/data/scopeBriefs";
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
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [targetLaunchDate, setTargetLaunchDate] = useState("");
  const [busy, setBusy] = useState(false);
  const nameTouched = useRef(false);
  const descriptionTouched = useRef(false);

  useEffect(() => {
    if (!clientId) return;
    let active = true;
    void fetchClientScopeBrief(clientId)
      .then((brief) => {
        if (!active) return;
        const client = clients.find((item) => item.id === clientId);
        if (!nameTouched.current && client) {
          setName(suggestedProjectName(client.businessName));
        }
        if (!descriptionTouched.current) {
          if (brief) {
            setDescription(projectDescriptionFromBrief(brief));
            setFromBrief(true);
          } else {
            setDescription(defaultProjectDescription);
            setFromBrief(false);
          }
        }
      })
      .catch(() => {
        if (active && !descriptionTouched.current) {
          setDescription(defaultProjectDescription);
          setFromBrief(false);
        }
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
      <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight">New project</h1>
      {clients.length === 0 ? (
        <NeedClientEmpty document="project" />
      ) : (
        <div className="space-y-4">
        <p className="max-w-xl text-sm text-[var(--admin-muted)]">
          Create a project record. Progress is tracked from tasks after you add them.
        </p>
        <form
          className="w-full max-w-lg space-y-4 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5 md:p-6"
          onSubmit={onSubmit}
        >
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
            </label>
          </div>
          <label className="block text-sm font-semibold">
            Description
            <textarea
              required
              rows={3}
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
                Filled from their scope form. Edit anything that needs to change.
              </span>
            ) : null}
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
          <p className="text-[12px] font-normal text-[var(--admin-muted)]">
            New projects start in Planning unless you choose another status.
          </p>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Creating…" : "Create project"}
          </button>
        </form>
        </div>
      )}
    </div>
  );
}
