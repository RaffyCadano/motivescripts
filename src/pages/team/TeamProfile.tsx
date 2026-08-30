import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { initialsFromName, userDisplay } from "@/auth/userDisplay";
import { useTeamWork } from "@/components/team/useTeamWork";
import { updateOwnProfile } from "@/data/settingsRepository";
import { AgencyDbError } from "@/lib/dbErrors";

export function TeamProfile() {
  const { user, profile, refreshProfile } = useAuth();
  const { myProjects, stats } = useTeamWork();
  const display = user && profile ? userDisplay(user, profile) : null;
  const [fullName, setFullName] = useState(profile?.fullName ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFullName(profile?.fullName ?? "");
  }, [profile?.fullName]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await updateOwnProfile({ fullName: fullName.trim() });
      await refreshProfile();
      setMessage("Saved.");
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to update your profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">Profile</h1>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">Your account details and current workload.</p>
      </div>

      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5 md:p-6">
        <div className="flex items-center gap-4">
          <span className="inline-flex size-14 items-center justify-center rounded-full bg-[var(--admin-navy)] font-heading text-lg font-semibold text-white">
            {display?.initials || initialsFromName(fullName || "A")}
          </span>
          <div>
            <p className="font-heading text-lg font-semibold text-[var(--admin-ink)]">{profile?.fullName || "Team member"}</p>
            <p className="text-sm text-[var(--admin-muted)]">{profile?.jobTitle || display?.role || "Staff"}</p>
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
            <ReadOnlyField label="Email" value={profile?.email || "—"} />
            <ReadOnlyField label="Role" value={profile?.jobTitle || display?.role || "Staff"} />
            <ReadOnlyField label="Workspace role" value={profile?.role === "admin" ? "Admin" : "Staff"} />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-blue)] px-4 font-heading text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save name"}
          </button>
          {message ? <p className="text-sm text-[var(--admin-muted)]">{message}</p> : null}
          {error ? <p className="text-sm text-[#b45309]">{error}</p> : null}
        </form>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Assigned projects" value={myProjects.length} />
        <Stat label="Current workload" value={stats.inProgress + stats.dueToday + stats.overdue} />
        <Stat label="Completed tasks" value={stats.completed} />
      </section>

      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
        <h2 className="font-heading text-sm font-semibold">Assigned projects</h2>
        {myProjects.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--admin-muted)]">You haven’t been assigned to any projects.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {myProjects.map((project) => (
              <li key={project.id}>
                <Link
                  to={`/admin/projects/${project.id}`}
                  className="text-sm font-medium text-[var(--admin-blue)] hover:underline"
                >
                  {project.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] px-4 py-4">
      <p className="text-[12px] text-[var(--admin-muted)]">{label}</p>
      <p className="mt-1 font-heading text-2xl font-semibold">{value}</p>
    </article>
  );
}
