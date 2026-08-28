import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission, isActiveAdmin } from "@/auth/permissions";
import { useTeamDirectory } from "@/components/admin/team/useTeamDirectory";
import { formatTeamDate, type StaffTemplateKey } from "@/data/team";
import { fetchMemberActivity, updateStaffMember } from "@/data/teamRepository";
import { AgencyDbError } from "@/lib/dbErrors";

export function AdminTeamDetails() {
  const { id = "" } = useParams();
  const { profile } = useAuth();
  const { data, status, reload } = useTeamDirectory();
  const [activity, setActivity] = useState<{ id: string; message: string; createdAt: string }[]>([]);
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [templateKey, setTemplateKey] = useState<StaffTemplateKey>("staff");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const canManage = isActiveAdmin(profile);
  const canView = hasPermission(profile, "team.view");

  const member = data?.members.find((item) => item.id === id) ?? null;
  const visiblePerms = (data?.catalog.permissions ?? []).filter(
    (item) => item.code !== "team.view" && item.code !== "team.manage",
  );

  useEffect(() => {
    if (!member) return;
    setFullName(member.fullName);
    setJobTitle(member.jobTitle);
    setTemplateKey(member.templateKey);
    setSelected(member.permissions);
    void fetchMemberActivity(member.id).then(setActivity);
  }, [member]);

  const permissionLabels = useMemo(() => {
    const map = new Map((data?.catalog.permissions ?? []).map((item) => [item.code, item.label]));
    return (member?.permissions ?? []).map((code) => map.get(code) ?? code);
  }, [data?.catalog.permissions, member?.permissions]);

  if (!canView) {
    return (
      <div>
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight">Team</h1>
        <p className="mt-2 text-sm text-[var(--admin-muted)]">You don’t have permission to perform this action.</p>
      </div>
    );
  }

  if (status === "loading" && !data) {
    return <p className="text-sm text-[var(--admin-muted)]">Loading team member…</p>;
  }

  if (!member) {
    return (
      <div>
        <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight">Team member not found</h1>
        <Link to="/admin/team" className="mt-4 inline-flex font-heading text-sm font-semibold text-[var(--admin-blue)] hover:underline">
          Back to team
        </Link>
      </div>
    );
  }

  async function save(next?: { isActive?: boolean; templateKey?: StaffTemplateKey; permissionCodes?: string[] }) {
    if (!member || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await updateStaffMember({
        userId: member.id,
        fullName,
        jobTitle,
        templateKey: member.id === profile?.id ? undefined : (next?.templateKey ?? templateKey),
        permissionCodes:
          member.id === profile?.id
            ? undefined
            : (next?.permissionCodes ?? (templateKey === "admin" ? null : selected)),
        isActive: next?.isActive,
      });
      await reload();
      setMessage("Saved.");
    } catch (caught) {
      setMessage(caught instanceof AgencyDbError ? caught.message : "This team member could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "mt-1.5 h-10 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm text-[var(--admin-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)]";

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/team" className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline">
          Team
        </Link>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight md:text-3xl">
              {member.fullName || member.email}
            </h1>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">
              {member.email} · {member.templateLabel} · {member.isActive ? "Active" : "Inactive"}
            </p>
          </div>
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              {member.isActive ? (
                <button
                  type="button"
                  disabled={busy}
                  className="inline-flex h-10 items-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-white px-4 font-heading text-sm font-semibold text-[var(--admin-ink)] disabled:opacity-60"
                  onClick={() => void save({ isActive: false })}
                >
                  Deactivate
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  className="inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white disabled:opacity-60"
                  onClick={() => void save({ isActive: true })}
                >
                  Activate
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
        <div className="space-y-6">
          <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
            <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Profile</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-[12px] text-[var(--admin-muted)]">Email</dt>
                <dd className="mt-1 text-sm text-[var(--admin-ink)]">{member.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-[var(--admin-muted)]">Last activity</dt>
                <dd className="mt-1 text-sm text-[var(--admin-ink)]">{formatTeamDate(member.lastActiveAt)}</dd>
              </div>
            </dl>
            {canManage ? (
              <form
                className="mt-5 space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void save();
                }}
              >
                <div>
                  <label className="block font-heading text-sm font-semibold" htmlFor="staff-name">
                    Full name
                  </label>
                  <input id="staff-name" value={fullName} onChange={(event) => setFullName(event.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block font-heading text-sm font-semibold" htmlFor="staff-title">
                    Job title
                  </label>
                  <input id="staff-title" value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block font-heading text-sm font-semibold" htmlFor="staff-role">
                    Role
                  </label>
                  <select
                    id="staff-role"
                    value={templateKey}
                    disabled={member.id === profile?.id}
                    onChange={(event) => setTemplateKey(event.target.value as StaffTemplateKey)}
                    className={inputClass}
                  >
                    {(data?.catalog.templates ?? []).map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  {member.id === profile?.id ? (
                    <p className="mt-1 text-[12px] text-[var(--admin-muted)]">You can’t change your own role.</p>
                  ) : null}
                </div>
                {templateKey !== "admin" && member.id !== profile?.id ? (
                  <fieldset>
                    <legend className="font-heading text-sm font-semibold">Permissions</legend>
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {visiblePerms.map((item) => (
                        <li key={item.code}>
                          <label className="flex items-start gap-2 text-sm">
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={selected.includes(item.code)}
                              onChange={(event) => {
                                setSelected((current) =>
                                  event.target.checked
                                    ? [...current, item.code]
                                    : current.filter((code) => code !== item.code),
                                );
                              }}
                            />
                            <span>{item.label}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </fieldset>
                ) : (
                  <p className="text-sm text-[var(--admin-muted)]">
                    {permissionLabels.length ? permissionLabels.join(", ") : "No extra permissions listed."}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white disabled:opacity-60"
                >
                  {busy ? "Saving…" : "Save changes"}
                </button>
              </form>
            ) : (
              <p className="mt-4 text-sm text-[var(--admin-muted)]">{member.jobTitle || "No job title"}</p>
            )}
            {message ? <p className="mt-3 text-sm text-[var(--admin-muted)]">{message}</p> : null}
          </section>

          <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
            <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Assigned clients</h2>
            {member.clientAssignments.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--admin-muted)]">No client assignments.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {member.clientAssignments.map((item) => (
                  <li key={item.id}>
                    <Link to={`/admin/clients/${item.entityId}`} className="text-sm font-medium text-[var(--admin-blue)] hover:underline">
                      {item.entityName}
                    </Link>
                    {item.label ? <span className="ml-2 text-[12px] text-[var(--admin-muted)]">{item.label}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
            <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Assigned projects</h2>
            {member.projectAssignments.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--admin-muted)]">No project assignments.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {member.projectAssignments.map((item) => (
                  <li key={item.id}>
                    <Link to={`/admin/projects/${item.entityId}`} className="text-sm font-medium text-[var(--admin-blue)] hover:underline">
                      {item.entityName}
                    </Link>
                    {item.label ? <span className="ml-2 text-[12px] text-[var(--admin-muted)]">{item.label}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
          <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Recent activity</h2>
          {activity.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--admin-muted)]">No recent project activity for this person.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {activity.map((item) => (
                <li key={item.id}>
                  <p className="text-sm text-[var(--admin-ink)]">{item.message}</p>
                  <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{formatTeamDate(item.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
