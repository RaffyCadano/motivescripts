import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { isActiveAdmin } from "@/auth/permissions";
import { useTeamDirectory } from "@/components/admin/team/useTeamDirectory";
import { looksLikeInviteEmail } from "@/data/invitation";
import { sendStaffInvitation } from "@/data/teamRepository";
import type { StaffTemplateKey } from "@/data/team";
import { AgencyDbError } from "@/lib/dbErrors";

const inputClass =
  "mt-1.5 h-10 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm font-normal outline-none focus:border-[rgb(0_80_240_/_0.45)]";

export function AdminTeamInviteNew() {
  const { profile } = useAuth();
  const { data, status, error: loadError, reload } = useTeamDirectory();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [templateKey, setTemplateKey] = useState<StaffTemplateKey>("staff");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const templates = data?.catalog.templates ?? [];
  const permissions = data?.catalog.permissions ?? [];
  const showCustom = templateKey !== "admin";
  const visiblePerms = permissions.filter((item) => item.code !== "team.view" && item.code !== "team.manage");

  useEffect(() => {
    const match = templates.find((item) => item.key === templateKey);
    if (!match) return;
    setSelected(match.permissionCodes.filter((code) => code !== "team.view" && code !== "team.manage"));
  }, [templateKey, templates]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!looksLikeInviteEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!fullName.trim()) {
      setError("Enter the team member’s full name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const invitationId = await sendStaffInvitation({
        email,
        fullName,
        jobTitle,
        templateKey,
        permissionCodes: templateKey === "admin" ? undefined : selected,
      });
      await reload();
      navigate(invitationId ? `/admin/team/invite/${invitationId}` : "/admin/team");
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to send this invitation.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link to="/admin/team" className="text-[12px] font-medium text-[var(--admin-blue)] hover:underline">
        Team
      </Link>
      <h1 className="font-heading text-[1.65rem] font-semibold tracking-tight">Invite team member</h1>
      <p className="max-w-xl text-sm text-[var(--admin-muted)]">
        They’ll receive a secure email link and sign in with a magic link. Role and permissions are stored on the
        server.
      </p>
      {!isActiveAdmin(profile) ? (
        <p className="text-sm text-[var(--admin-muted)]">You don’t have permission to invite team members.</p>
      ) : status === "error" && !data ? (
        <p className="text-sm text-[var(--admin-muted)]">{loadError}</p>
      ) : status === "loading" && !data ? (
        <p className="text-sm text-[var(--admin-muted)]">Loading roles…</p>
      ) : (
        <form
          className="w-full max-w-2xl space-y-4 rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5 md:p-6"
          onSubmit={onSubmit}
        >
          <label className="block text-sm font-semibold">
            Full name
            <input required value={fullName} onChange={(event) => setFullName(event.target.value)} className={inputClass} />
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
            Job title
            <input
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
              placeholder="Project manager"
              className={inputClass}
            />
          </label>
          <label className="block text-sm font-semibold">
            Role
            <select
              required
              value={templateKey}
              onChange={(event) => setTemplateKey(event.target.value as StaffTemplateKey)}
              className={inputClass}
            >
              {templates.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          {showCustom ? (
            <fieldset>
              <legend className="text-sm font-semibold">Permissions</legend>
              <p className="mt-1 text-[12px] font-normal text-[var(--admin-muted)]">
                Admins keep full access. Team management stays with administrators.
              </p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {visiblePerms.map((item) => (
                  <li key={item.code}>
                    <label className="flex items-start gap-2 text-sm font-normal text-[var(--admin-ink)]">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={selected.includes(item.code)}
                        onChange={(event) => {
                          setSelected((current) =>
                            event.target.checked ? [...current, item.code] : current.filter((code) => code !== item.code),
                          );
                        }}
                      />
                      <span>{item.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          ) : null}
          {error ? <p className="text-sm text-[var(--admin-muted)]">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-10 items-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Sending…" : "Send invitation"}
          </button>
        </form>
      )}
    </div>
  );
}
