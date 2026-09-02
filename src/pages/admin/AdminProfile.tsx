import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { displayRoleLabel } from "@/auth/roles";
import { initialsFromName, userDisplay } from "@/auth/userDisplay";
import { useTeamDirectory } from "@/components/admin/team/useTeamDirectory";
import { updateOwnProfile } from "@/data/settingsRepository";
import { AgencyDbError } from "@/lib/dbErrors";

export function AdminProfile() {
  const { user, profile, refreshProfile } = useAuth();
  const team = useTeamDirectory();
  const display = user && profile ? userDisplay(user, profile) : null;
  const self = team.data?.members.find((member) => member.id === profile?.id);
  const [fullName, setFullName] = useState(profile?.fullName ?? "");
  const [jobTitle, setJobTitle] = useState(profile?.jobTitle ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFullName(profile?.fullName ?? "");
    setJobTitle(profile?.jobTitle ?? "");
  }, [profile?.fullName, profile?.jobTitle]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await updateOwnProfile({ fullName: fullName.trim(), jobTitle: jobTitle.trim() });
      await refreshProfile();
      await team.reload();
      setMessage("Saved.");
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to update your profile.");
    } finally {
      setBusy(false);
    }
  }

  const roleLabel = profile?.jobTitle.trim() || self?.templateLabel || displayRoleLabel(profile?.role);
  const clients = self?.clientAssignments ?? [];
  const projects = self?.projectAssignments ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">Profile</h1>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">Your account details. Agency settings stay under Settings.</p>
      </div>

      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5 md:p-6">
        <div className="flex items-center gap-4">
          <span className="inline-flex size-14 items-center justify-center rounded-full bg-[var(--admin-navy)] font-heading text-lg font-semibold text-white">
            {display?.initials || initialsFromName(fullName || "A")}
          </span>
          <div>
            <p className="font-heading text-lg font-semibold text-[var(--admin-ink)]">{profile?.fullName || "Account"}</p>
            <p className="text-sm text-[var(--admin-muted)]">{roleLabel}</p>
          </div>
        </div>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
              Name
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="mt-1.5 h-10 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
              />
            </label>
            <label className="block text-[13px] font-medium text-[var(--admin-ink)]">
              Job title
              <input
                value={jobTitle}
                onChange={(event) => setJobTitle(event.target.value)}
                className="mt-1.5 h-10 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm outline-none focus:border-[rgb(0_80_240_/_0.45)]"
              />
            </label>
            <ReadOnlyField label="Email" value={profile?.email || "—"} />
            <ReadOnlyField label="Workspace role" value={profile?.role === "admin" ? "Admin" : "Staff"} />
          </div>
          <p className="text-[12px] text-[var(--admin-muted)]">
            Email changes are not supported here. Magic-link sign-in uses the address on this account.
          </p>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-blue)] px-4 font-heading text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save profile"}
          </button>
          {message ? <p className="text-sm text-[var(--admin-muted)]">{message}</p> : null}
          {error ? <p className="text-sm text-[#b42318]">{error}</p> : null}
        </form>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <AssignmentList
          title="Assigned clients"
          empty="You aren’t assigned to any clients yet."
          items={clients.map((item) => ({ id: item.id, name: item.entityName, href: `/admin/clients/${item.entityId}` }))}
        />
        <AssignmentList
          title="Assigned projects"
          empty="You aren’t assigned to any projects yet."
          items={projects.map((item) => ({ id: item.id, name: item.entityName, href: `/admin/projects/${item.entityId}` }))}
        />
      </section>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[13px] font-medium text-[var(--admin-ink)]">{label}</p>
      <p className="mt-1.5 flex h-10 items-center rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] px-3 text-sm text-[var(--admin-muted)]">
        {value}
      </p>
    </div>
  );
}

function AssignmentList({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: { id: string; name: string; href: string }[];
}) {
  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
      <h2 className="font-heading text-sm font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--admin-muted)]">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link to={item.href} className="text-sm font-medium text-[var(--admin-blue)] hover:underline">
                {item.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
