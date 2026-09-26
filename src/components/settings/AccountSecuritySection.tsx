import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { ClientConfirmDialog } from "@/components/client/ClientConfirmDialog";
import { describeUserAgent, formatSessionTime, type AuthSession } from "@/data/authSessions";
import { listMySessions, revokeMySession } from "@/data/authSessionsRepository";
import { AgencyDbError } from "@/lib/dbErrors";
import { cn } from "@/lib/cn";

/** Log out of every device, and the list of places this account is signed in (each can be logged out). */
export function AccountSecuritySection({ audience = "client" }: { audience?: "client" | "staff" } = {}) {
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
            {audience === "client"
              ? "Signs you out everywhere you are logged in to your client portal, including this browser. You will need a new sign-in link to get back in."
              : "Signs you out everywhere you are logged in to MotiveScripts, including this browser. You will need to sign in again."}
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
          The devices and browsers currently signed in to your account. If you don&rsquo;t recognise one, log it out{audience === "client" ? " and let us know" : " and change your password"}.
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
            <table className="w-full min-w-[40rem] border-collapse text-sm">
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
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--client-muted)]">{formatSessionTime(item.createdAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--client-muted)]">{formatSessionTime(item.lastActiveAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {item.isCurrent ? null : (
                        <button
                          type="button"
                          disabled={Boolean(revoking)}
                          onClick={() => void logOutDevice(item.id)}
                          className="whitespace-nowrap font-heading text-[12px] font-semibold text-[var(--client-blue)] hover:underline disabled:opacity-50"
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

      <div className="mt-6 rounded-[var(--client-radius)] border border-[var(--client-line)] px-4 py-3.5">
        <p className="text-sm font-semibold text-[var(--client-ink)]">Delete your account</p>
        {audience === "client" ? (
          <p className="mt-1 text-sm leading-relaxed text-[var(--client-muted)]">
            To delete your account, please cancel your MotiveScripts subscription first, or{" "}
            <Link to="/client/messages" className="font-semibold text-[var(--client-blue)] underline-offset-2 hover:underline">
              contact MotiveScripts
            </Link>{" "}
            to delete your account.
          </p>
        ) : (
          <p className="mt-1 text-sm leading-relaxed text-[var(--client-muted)]">
            To delete your account, please contact a MotiveScripts administrator. Only an administrator can delete accounts.
          </p>
        )}
      </div>

      <ClientConfirmDialog
        open={confirmAll}
        title="Log out of all devices?"
        body={
          audience === "client"
            ? "You will be signed out everywhere, including this browser, and will need a new sign-in link to get back into your client portal."
            : "You will be signed out everywhere, including this browser, and will need to sign in again."
        }
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
