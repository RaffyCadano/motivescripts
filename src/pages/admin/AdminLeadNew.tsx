import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission } from "@/auth/permissions";
import { leadIndustries, type LeadIndustry } from "@/data/leads";
import { AgencyDbError } from "@/lib/dbErrors";

const inputClass =
  "mt-1.5 h-10 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm font-normal outline-none focus:border-[rgb(0_80_240_/_0.45)]";

export function AdminLeadNew() {
  const { addLead, notify } = useLeads();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [industry, setIndustry] = useState<LeadIndustry>("Other");
  const [request, setRequest] = useState("");
  const [projectDetails, setProjectDetails] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const lead = await addLead({
        name,
        businessName,
        email,
        phone,
        industry,
        request,
        projectDetails,
      });
      if (!lead) {
        setBusy(false);
        return;
      }
      navigate(`/admin/leads/${lead.id}`);
    } catch (error) {
      notify(error instanceof AgencyDbError ? error.message : "Unable to create this lead.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link to="/admin/leads" className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline">
        Leads
      </Link>
      <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight">Add lead</h1>
      <p className="max-w-xl text-sm text-[var(--admin-muted)]">
        Create a lead. It is saved to the agency database.
      </p>
      {!hasPermission(profile, "leads.manage") ? (
        <p className="text-sm text-[var(--admin-muted)]">You don’t have permission to add leads.</p>
      ) : (
        <form
          className="w-full max-w-lg space-y-4 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5 md:p-6"
          onSubmit={onSubmit}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              Name
              <input required value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
            </label>
            <label className="block text-sm font-semibold">
              Business name
              <input
                required
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-semibold">
              Email
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-semibold">
              Phone
              <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className={inputClass} />
            </label>
          </div>
          <label className="block text-sm font-semibold">
            Industry
            <select
              required
              value={industry}
              onChange={(event) => setIndustry(event.target.value as LeadIndustry)}
              className={inputClass}
            >
              {leadIndustries.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold">
            What do you need?
            <input required value={request} onChange={(event) => setRequest(event.target.value)} className={inputClass} />
          </label>
          <label className="block text-sm font-semibold">
            Project details
            <textarea
              required
              rows={3}
              value={projectDetails}
              onChange={(event) => setProjectDetails(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 py-2 text-sm font-normal outline-none focus:border-[rgb(0_80_240_/_0.45)]"
            />
          </label>
          <p className="text-[12px] font-normal text-[var(--admin-muted)]">New leads start with status New.</p>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Creating…" : "Add lead"}
          </button>
        </form>
      )}
    </div>
  );
}
