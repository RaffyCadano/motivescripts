import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { ClientConfirmDialog } from "@/components/client/ClientConfirmDialog";
import { useLeads, usePortalIdentity } from "@/components/admin/leads/LeadsProvider";
import { describeUserAgent, formatSessionTime, type AuthSession } from "@/data/authSessions";
import { listMySessions, revokeMySession } from "@/data/authSessionsRepository";
import { AgencyDbError } from "@/lib/dbErrors";
import { cn } from "@/lib/cn";

const PREFS_KEY = "motivescripts.client.device-notification-prefs";

type DevicePrefs = {
  emailNotifications: boolean;
  projectUpdates: boolean;
};

function loadPrefs(): DevicePrefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return { emailNotifications: true, projectUpdates: true };
    const parsed = JSON.parse(raw) as Partial<DevicePrefs>;
    return {
      emailNotifications: parsed.emailNotifications !== false,
      projectUpdates: parsed.projectUpdates !== false,
    };
  } catch {
    return { emailNotifications: true, projectUpdates: true };
  }
}

export function ClientSettings() {
  const identity = usePortalIdentity();
  const { notify } = useLeads();
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [projectUpdates, setProjectUpdates] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const prefs = loadPrefs();
    setEmailNotifications(prefs.emailNotifications);
    setProjectUpdates(prefs.projectUpdates);
  }, []);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ emailNotifications, projectUpdates } satisfies DevicePrefs),
    );
    setSaved(true);
    notify("Preferences saved");
  }

  return (
    <div className="w-full space-y-6">
      <header>
        <h1 className="font-heading text-[1.75rem] font-semibold tracking-tight md:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-[var(--client-muted)]">
          Manage your profile information, notification preferences, and account security.
        </p>
      </header>

      <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6">
        <h2 className="font-heading text-lg font-semibold tracking-tight text-[var(--client-ink)]">Profile</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--client-muted)]">
          Profile information is managed through your MotiveScripts account.
        </p>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <ProfileItem label="Name" value={identity.name} />
          <ProfileItem label="Email" value={identity.email || "—"} />
          <ProfileItem label="Business name" value={identity.businessName} />
          <ProfileItem label="Phone" value={identity.phone || "—"} />
        </dl>
      </section>

      <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6">
        <h2 className="font-heading text-lg font-semibold tracking-tight text-[var(--client-ink)]">Notifications</h2>
        <p className="mt-1 text-sm font-semibold text-[var(--client-ink)]">Browser reminders</p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--client-muted)]">
          These preferences only control reminders shown on this device. They do not unsubscribe you from required
          account, document, payment, or security emails.
        </p>

        <form className="mt-5 space-y-5" onSubmit={onSubmit}>
          <div className="space-y-3">
            <Toggle
              id="email-notes"
              label="Show email reminders on this device"
              hint="Remembers this choice in this browser. MotiveScripts will still send required emails."
              checked={emailNotifications}
              onChange={(checked) => {
                setEmailNotifications(checked);
                setSaved(false);
              }}
            />
            <Toggle
              id="project-updates"
              label="Show project reminders on this device"
              hint="Remembers this choice in this browser. It does not change project email notifications."
              checked={projectUpdates}
              onChange={(checked) => {
                setProjectUpdates(checked);
                setSaved(false);
              }}
            />
          </div>

          <div className="rounded-[var(--client-radius)] border border-[var(--client-line)] px-4 py-3">
            <p className="text-sm font-semibold text-[var(--client-ink)]">Emails you will still receive</p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--client-muted)]">
              Proposal and contract review notices, invoices and payment confirmations, and account security messages
              are sent by MotiveScripts and cannot be turned off here.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-5 font-heading text-sm font-semibold text-white hover:bg-[var(--client-bright)]"
              >
                Save Preferences
              </button>
              {saved ? (
                <p className="text-sm font-medium text-[#0f7a56]" role="status">
                  Preferences saved
                </p>
              ) : null}
            </div>
            <p className="text-sm text-[var(--client-muted)]">Saved on this device.</p>
          </div>
        </form>
      </section>

      <AccountSecuritySection />
    </div>
  );
}

/** Log out of every device, and the list of places this account is signed in (each can be logged out). */
function AccountSecuritySection() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [sessions, setSessions] = useState<AuthSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setSessions(await listMySessions());
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to load your active sessions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function logOutDevice(id: string) {
    if (revoking) return;
    setRevoking(id);
    setError(null);
    try {
      await revokeMySession(id);
      setSessions((current) => current.filter((item) => item.id !== id));
    } catch (caught) {
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to log out that device.");
    } finally {
      setRevoking(null);
    }
  }

  async function logOutEverywhere() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut("global");
      navigate("/login");
    } catch {
      setSigningOut(false);
      setConfirmAll(false);
      setError("Unable to log you out of all devices. Please try again.");
    }
  }

  const others = sessions.filter((item) => !item.isCurrent).length;

  return (
    <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6">
      <h2 className="font-heading text-lg font-semibold tracking-tight text-[var(--client-ink)]">Account &amp; security</h2>

      <div className="mt-4 flex flex-col gap-3 rounded-[var(--client-radius)] border border-[var(--client-line)] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--client-ink)]">Log out of all devices</p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--client-muted)]">
            Signs you out everywhere you are logged in to your client portal, including this browser. You will need a new sign-in link to get
            back in.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setConfirmAll(true)}
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--client-line)] bg-white px-5 font-heading text-sm font-semibold text-[var(--client-ink)] hover:bg-[var(--client-hover)]"
        >
          Log out of all devices
        </button>
      </div>

      <div className="mt-6">
        <h3 className="font-heading text-sm font-semibold text-[var(--client-ink)]">Active sessions</h3>
        <p className="mt-1 text-sm leading-relaxed text-[var(--client-muted)]">
          The devices and browsers currently signed in to your account. If you don&rsquo;t recognise one, log it out and let us know.
        </p>

        {error ? (
          <p role="alert" className="mt-3 text-sm text-[#b42318]">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="mt-4 h-24 animate-pulse rounded-[var(--client-radius)] bg-[var(--client-bg)]" />
        ) : sessions.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--client-muted)]">No active sessions found.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-[var(--client-radius)] border border-[var(--client-line)]">
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <thead>
                <tr className="bg-[var(--client-bg)] text-left text-[12px] text-[var(--client-muted)]">
                  <th className="px-4 py-2.5 font-medium">Device</th>
                  <th className="px-4 py-2.5 font-medium">IP address</th>
                  <th className="px-4 py-2.5 font-medium">Signed in</th>
                  <th className="px-4 py-2.5 font-medium">Last active</th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--client-line)]">
                {sessions.map((item) => (
                  <tr key={item.id} className={cn(item.isCurrent && "bg-[rgb(0_80_240_/_0.03)]")}>
                    <td className="px-4 py-3 font-medium text-[var(--client-ink)]">
                      {describeUserAgent(item.userAgent)}
                      {item.isCurrent ? (
                        <span className="ml-2 inline-flex rounded-full bg-[rgb(0_80_240_/_0.08)] px-2 py-0.5 font-heading text-[11px] font-semibold text-[var(--client-blue)]">
                          Current
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-[var(--client-muted)]">{item.ip || "—"}</td>
                    <td className="px-4 py-3 text-[var(--client-muted)]">{formatSessionTime(item.createdAt)}</td>
                    <td className="px-4 py-3 text-[var(--client-muted)]">{formatSessionTime(item.lastActiveAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {item.isCurrent ? null : (
                        <button
                          type="button"
                          disabled={Boolean(revoking)}
                          onClick={() => void logOutDevice(item.id)}
                          className="font-heading text-[12px] font-semibold text-[var(--client-blue)] hover:underline disabled:opacity-50"
                        >
                          {revoking === item.id ? "Logging out…" : "Log out"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && others > 0 ? (
          <p className="mt-3 text-[12px] text-[var(--client-muted)]">
            A device you log out stays signed in for up to an hour at most, then has to sign in again.
          </p>
        ) : null}
      </div>

      <ClientConfirmDialog
        open={confirmAll}
        title="Log out of all devices?"
        body="You will be signed out everywhere, including this browser, and will need a new sign-in link to get back into your client portal."
        confirmLabel="Log out everywhere"
        busy={signingOut}
        busyLabel="Logging out…"
        onConfirm={() => void logOutEverywhere()}
        onCancel={() => {
          if (!signingOut) setConfirmAll(false);
        }}
      />
    </section>
  );
}

function ProfileItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--client-radius)] border border-[var(--client-line)] px-4 py-3">
      <dt className="text-[12px] text-[var(--client-muted)]">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-[var(--client-ink)]">{value}</dd>
    </div>
  );
}

function Toggle({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start justify-between gap-4 rounded-[var(--client-radius)] border border-[var(--client-line)] px-4 py-3"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[var(--client-ink)]">{label}</span>
        <span className="mt-1 block text-xs leading-relaxed text-[var(--client-muted)]">{hint}</span>
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          id={id}
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="h-6 w-10 rounded-full bg-[var(--client-line)] transition-colors peer-checked:bg-[var(--client-blue)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--client-blue)]" />
        <span className="pointer-events-none absolute top-0.5 left-0.5 size-5 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
      </span>
    </label>
  );
}
