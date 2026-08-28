import { useEffect, useState, type FormEvent } from "react";
import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import type { StaffTemplateKey, StaffTemplateOption, StaffPermissionOption } from "@/data/team";
import { sendStaffInvitation } from "@/data/teamRepository";
import { AgencyDbError } from "@/lib/dbErrors";
import { looksLikeInviteEmail } from "@/data/invitation";

type InviteTeamDialogProps = {
  open: boolean;
  templates: StaffTemplateOption[];
  permissions: StaffPermissionOption[];
  onClose: () => void;
  onSent: () => void;
};

export function InviteTeamDialog({ open, templates, permissions, onClose, onSent }: InviteTeamDialogProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [templateKey, setTemplateKey] = useState<StaffTemplateKey>("staff");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showCustom = templateKey !== "admin";
  const visiblePerms = permissions.filter((item) => item.code !== "team.view" && item.code !== "team.manage");

  useEffect(() => {
    if (!open) return;
    setFullName("");
    setEmail("");
    setJobTitle("");
    setTemplateKey("staff");
    setSelected(templates.find((item) => item.key === "staff")?.permissionCodes ?? []);
    setError(null);
    setBusy(false);
  }, [open, templates]);

  useEffect(() => {
    const match = templates.find((item) => item.key === templateKey);
    if (!match) return;
    setSelected(match.permissionCodes.filter((code) => code !== "team.view" && code !== "team.manage"));
  }, [templateKey, templates]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
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
      await sendStaffInvitation({
        email,
        fullName,
        jobTitle,
        templateKey,
        permissionCodes: templateKey === "admin" ? undefined : selected,
      });
      onSent();
      onClose();
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to send this invitation.");
      setBusy(false);
    }
  }

  const inputClass =
    "mt-1.5 h-10 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm text-[var(--admin-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)]";

  return (
    <AdminDialog
      open={open}
      busy={busy}
      size="lg"
      title="Invite Team Member"
      description="They’ll receive a secure email link and sign in with a magic link. Role and permissions are stored on the server."
      onClose={onClose}
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="block font-heading text-sm font-semibold text-[var(--admin-ink)]" htmlFor="team-invite-name">
            Full name
          </label>
          <input id="team-invite-name" required value={fullName} onChange={(event) => setFullName(event.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block font-heading text-sm font-semibold text-[var(--admin-ink)]" htmlFor="team-invite-email">
            Email
          </label>
          <input
            id="team-invite-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block font-heading text-sm font-semibold text-[var(--admin-ink)]" htmlFor="team-invite-title">
            Job title
          </label>
          <input
            id="team-invite-title"
            value={jobTitle}
            onChange={(event) => setJobTitle(event.target.value)}
            placeholder="Project manager"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block font-heading text-sm font-semibold text-[var(--admin-ink)]" htmlFor="team-invite-role">
            Role
          </label>
          <select
            id="team-invite-role"
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
        </div>
        {showCustom ? (
          <fieldset>
            <legend className="font-heading text-sm font-semibold text-[var(--admin-ink)]">Permissions</legend>
            <p className="mt-1 text-[12px] text-[var(--admin-muted)]">
              Admins keep full access. Team management stays with administrators.
            </p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {visiblePerms.map((item) => (
                <li key={item.code}>
                  <label className="flex items-start gap-2 text-sm text-[var(--admin-ink)]">
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
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={busy}
            className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius)] border border-[var(--admin-line)] px-4 font-heading text-sm font-semibold text-[var(--admin-ink)] hover:bg-[var(--admin-bg)] disabled:opacity-60"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-10 items-center justify-center rounded-[var(--admin-radius)] bg-[var(--admin-navy)] px-4 font-heading text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Sending…" : "Send invitation"}
          </button>
        </div>
      </form>
    </AdminDialog>
  );
}
