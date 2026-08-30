import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLeads } from "@/components/admin/leads/LeadsProvider";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission } from "@/auth/permissions";
import { leadIndustries, type LeadIndustry } from "@/data/leads";
import { AgencyDbError } from "@/lib/dbErrors";

const inputClass =
  "mt-1.5 h-10 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm font-normal outline-none focus:border-[rgb(0_80_240_/_0.45)]";

export function AdminClientNew() {
  const { addClient, notify } = useLeads();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [contactName, setContactName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [industry, setIndustry] = useState<LeadIndustry>("Other");
  const [website, setWebsite] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const client = await addClient({
        contactName,
        businessName,
        email,
        phone,
        industry,
        website,
        location,
      });
      if (!client) {
        setBusy(false);
        return;
      }
      navigate(`/admin/clients/${client.id}`);
    } catch (error) {
      notify(error instanceof AgencyDbError ? error.message : "Unable to create this client.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link to="/admin/clients" className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline">
        Clients
      </Link>
      <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight">Add client</h1>
      <p className="max-w-xl text-sm text-[var(--admin-muted)]">
        Create a client record. It is saved to the agency database.
      </p>
      {!hasPermission(profile, "clients.manage") ? (
        <p className="text-sm text-[var(--admin-muted)]">You don’t have permission to add clients.</p>
      ) : (
        <form
          className="w-full max-w-lg space-y-4 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5 md:p-6"
          onSubmit={onSubmit}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              Contact name
              <input
                required
                value={contactName}
                onChange={(event) => setContactName(event.target.value)}
                className={inputClass}
              />
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
            Website
            <input
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              placeholder="https://"
              className={inputClass}
            />
          </label>
          <label className="block text-sm font-semibold">
            Location
            <input value={location} onChange={(event) => setLocation(event.target.value)} className={inputClass} />
          </label>
          <p className="text-[12px] font-normal text-[var(--admin-muted)]">New clients start with status Active.</p>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Creating…" : "Add client"}
          </button>
        </form>
      )}
    </div>
  );
}
