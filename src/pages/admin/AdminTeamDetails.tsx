import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, ShieldCheck } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { hasPermission, isActiveAdmin } from "@/auth/permissions";
import { initialsFromName } from "@/auth/userDisplay";
import { adminDangerBtn, adminPrimaryBtn } from "@/components/admin/adminActionStyles";
import { OnboardingPendingPill, OnboardingStatusProvider } from "@/components/admin/team/OnboardingStatus";
import { StaffEmailLogSection } from "@/components/admin/team/StaffEmailLogSection";
import { StaffOnboardingSection } from "@/components/admin/team/StaffOnboardingSection";
import { StaffPayrollCard } from "@/components/admin/team/StaffPayrollCard";
import { useTeamDirectory } from "@/components/admin/team/useTeamDirectory";
import { formatTeamDate, type StaffTemplateKey } from "@/data/team";
import { fetchMemberActivity, updateStaffMember } from "@/data/teamRepository";
import { groupPermissions } from "@/data/teamPermissions";
import { AgencyDbError } from "@/lib/dbErrors";
import { cn } from "@/lib/cn";

type DetailTab = "overview" | "payroll" | "onboarding" | "emails";
const DETAIL_TABS: DetailTab[] = ["overview", "payroll", "onboarding", "emails"];

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
  const [tab, setTab] = useState<DetailTab>(() => {
    const fromHash = typeof window === "undefined" ? "" : window.location.hash.slice(1);
    return DETAIL_TABS.find((item) => item === fromHash) ?? "overview";
  });
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

  const permissionGroups = useMemo(() => groupPermissions(visiblePerms), [visiblePerms]);

  function selectTab(next: DetailTab) {
    setTab(next);
    window.history.replaceState(null, "", `#${next}`);
  }

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
    "mt-1.5 h-10 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm text-[var(--admin-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)] disabled:bg-[var(--admin-bg)] disabled:text-[var(--admin-muted)]";

  const isStaff = member.role === "staff";
  const editingSelf = member.id === profile?.id;
  const showPermissionEditor = templateKey !== "admin" && !editingSelf;
  const tabs: { id: DetailTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    ...(canManage ? [{ id: "payroll" as const, label: "Pay & hours" }] : []),
    ...(canManage && isStaff ? [{ id: "onboarding" as const, label: "Onboarding" }] : []),
    ...(canManage ? [{ id: "emails" as const, label: "Alert emails" }] : []),
  ];
  const activeTab = tabs.some((item) => item.id === tab) ? tab : "overview";
  const stats = [
    { label: "Active tasks", value: member.activeTaskCount },
    { label: "Completed", value: member.completedTaskCount },
    { label: "Projects", value: member.projectAssignments.length },
    { label: "Clients", value: member.clientAssignments.length },
  ];

  return (
    <div className="space-y-6">
      <nav className="text-[12px] font-medium text-[var(--admin-muted)]" aria-label="Breadcrumb">
        <Link to="/admin/team" className="text-[var(--admin-blue)] hover:underline">
          Team
        </Link>
        <span className="mx-1.5" aria-hidden="true">/</span>
        {member.fullName || member.email}
      </nav>

      <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5 md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span
              aria-hidden="true"
              className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[var(--admin-navy)] font-heading text-lg font-semibold text-white"
            >
              {initialsFromName(member.fullName || member.email)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate font-heading text-[1.5rem] font-semibold tracking-tight md:text-[1.75rem]">
                  {member.fullName || member.email}
                </h1>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-heading text-xs font-semibold ring-1",
                    member.isActive ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-[var(--admin-bg)] text-[var(--admin-muted)] ring-[var(--admin-line)]",
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", member.isActive ? "bg-emerald-500" : "bg-[var(--admin-muted)]")} aria-hidden="true" />
                  {member.isActive ? "Active" : "Inactive"}
                </span>
                <OnboardingStatusProvider>
                  <OnboardingPendingPill userId={member.id} role={member.role} />
                </OnboardingStatusProvider>
              </div>
              <p className="mt-1 truncate text-sm text-[var(--admin-muted)]">
                {[member.jobTitle, member.templateLabel]
                  .filter((part, index, all) => part && all.indexOf(part) === index)
                  .join(" · ")}
              </p>
              <p className="mt-0.5 truncate text-[13px] text-[var(--admin-muted)]">
                {member.email || "No email"} · Last active {formatTeamDate(member.lastActiveAt)}
              </p>
            </div>
          </div>
          {canManage && !editingSelf ? (
            <div className="flex flex-wrap gap-2">
              {member.isActive ? (
                <button type="button" disabled={busy} className={adminDangerBtn} onClick={() => void save({ isActive: false })}>
                  Deactivate
                </button>
              ) : (
                <button type="button" disabled={busy} className={adminPrimaryBtn} onClick={() => void save({ isActive: true })}>
                  Activate
                </button>
              )}
            </div>
          ) : null}
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {stats.map((item) => (
            <div key={item.label} className="rounded-lg bg-[var(--admin-bg)] px-3.5 py-2.5">
              <dd className="font-heading text-xl font-semibold leading-tight text-[var(--admin-ink)]">{item.value}</dd>
              <dt className="text-[12px] text-[var(--admin-muted)]">{item.label}</dt>
            </div>
          ))}
        </dl>
      </section>

      {tabs.length > 1 ? (
        <div role="tablist" aria-label="Team member sections" className="flex gap-1 overflow-x-auto border-b border-[var(--admin-line)]">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={activeTab === item.id}
              onClick={() => selectTab(item.id)}
              className={cn(
                "-mb-px shrink-0 border-b-2 px-3.5 py-2.5 font-heading text-sm font-semibold transition-colors",
                activeTab === item.id
                  ? "border-[var(--admin-blue)] text-[var(--admin-blue)]"
                  : "border-transparent text-[var(--admin-muted)] hover:text-[var(--admin-ink)]",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      {activeTab === "payroll" && canManage ? <StaffPayrollCard staffId={member.id} /> : null}
      {activeTab === "onboarding" && canManage ? <StaffOnboardingSection userId={member.id} isStaff={isStaff} /> : null}
      {activeTab === "emails" && canManage ? <StaffEmailLogSection userId={member.id} /> : null}

      {activeTab === "overview" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
          <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5 md:p-6">
            <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Profile &amp; access</h2>
            {canManage ? (
              <form
                className="mt-4 space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  void save();
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-[13px] font-semibold" htmlFor="staff-name">
                      Full name
                    </label>
                    <input id="staff-name" value={fullName} onChange={(event) => setFullName(event.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold" htmlFor="staff-title">
                      Job title
                    </label>
                    <input id="staff-title" value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} className={inputClass} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[13px] font-semibold" htmlFor="staff-role">
                      Role
                    </label>
                    <select
                      id="staff-role"
                      value={templateKey}
                      disabled={editingSelf}
                      onChange={(event) => setTemplateKey(event.target.value as StaffTemplateKey)}
                      className={inputClass}
                    >
                      {(data?.catalog.templates ?? []).map((item) => (
                        <option key={item.key} value={item.key}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    {editingSelf ? (
                      <p className="mt-1.5 text-[12px] text-[var(--admin-muted)]">You can’t change your own role.</p>
                    ) : null}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={15} strokeWidth={2} className="text-[var(--admin-blue)]" aria-hidden="true" />
                    <h3 className="text-[13px] font-semibold">Permissions</h3>
                  </div>
                  {showPermissionEditor ? (
                    <div className="mt-3 divide-y divide-[var(--admin-line)] rounded-lg border border-[var(--admin-line)]">
                      {permissionGroups.map((group) => (
                        <div key={group.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3.5 py-2.5">
                          <p className="text-sm font-medium text-[var(--admin-ink)]">{group.title}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {group.actions.map((action) => {
                              const on = selected.includes(action.code);
                              return (
                                <label
                                  key={action.code}
                                  className={cn(
                                    "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold ring-1 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--admin-blue)]",
                                    on
                                      ? "bg-[rgb(0_80_240_/_0.08)] text-[var(--admin-blue)] ring-[rgb(0_80_240_/_0.3)]"
                                      : "bg-white text-[var(--admin-muted)] ring-[var(--admin-line)] hover:text-[var(--admin-ink)]",
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={on}
                                    onChange={(event) =>
                                      setSelected((current) =>
                                        event.target.checked ? [...current, action.code] : current.filter((code) => code !== action.code),
                                      )
                                    }
                                  />
                                  {on ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : null}
                                  {action.label}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-[var(--admin-muted)]">
                      {templateKey === "admin"
                        ? "Admins can do everything."
                        : permissionLabels.length
                          ? permissionLabels.join(", ")
                          : "No extra permissions listed."}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button type="submit" disabled={busy} className={adminPrimaryBtn}>
                    {busy ? "Saving…" : "Save changes"}
                  </button>
                  {message ? (
                    <p role="status" className={cn("text-sm font-medium", message === "Saved." ? "text-emerald-700" : "text-[#b45309]")}>
                      {message}
                    </p>
                  ) : null}
                </div>
              </form>
            ) : (
              <p className="mt-4 text-sm text-[var(--admin-muted)]">{member.jobTitle || "No job title"}</p>
            )}
          </section>

          <div className="space-y-6">
            <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
              <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Assigned work</h2>
              {member.clientAssignments.length === 0 && member.projectAssignments.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--admin-muted)]">No client or project assignments yet.</p>
              ) : (
                <div className="mt-3 space-y-4">
                  {member.projectAssignments.length > 0 ? (
                    <div>
                      <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--admin-muted)]">Projects</p>
                      <ul className="mt-1.5 divide-y divide-[var(--admin-line)]">
                        {member.projectAssignments.map((item) => (
                          <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                            <Link to={`/admin/projects/${item.entityId}`} className="min-w-0 truncate text-sm font-medium text-[var(--admin-blue)] hover:underline">
                              {item.entityName}
                            </Link>
                            {item.label ? <span className="shrink-0 text-[12px] text-[var(--admin-muted)]">{item.label}</span> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {member.clientAssignments.length > 0 ? (
                    <div>
                      <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--admin-muted)]">Clients</p>
                      <ul className="mt-1.5 divide-y divide-[var(--admin-line)]">
                        {member.clientAssignments.map((item) => (
                          <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                            <Link to={`/admin/clients/${item.entityId}`} className="min-w-0 truncate text-sm font-medium text-[var(--admin-blue)] hover:underline">
                              {item.entityName}
                            </Link>
                            {item.label ? <span className="shrink-0 text-[12px] text-[var(--admin-muted)]">{item.label}</span> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )}
            </section>

            <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5">
              <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Recent activity</h2>
              {activity.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--admin-muted)]">No recent project activity for this person.</p>
              ) : (
                <ul className="mt-3 space-y-3.5">
                  {activity.map((item) => (
                    <li key={item.id} className="flex gap-3">
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--admin-blue)]" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-sm text-[var(--admin-ink)]">{item.message}</p>
                        <p className="mt-0.5 text-[12px] text-[var(--admin-muted)]">{formatTeamDate(item.createdAt)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
