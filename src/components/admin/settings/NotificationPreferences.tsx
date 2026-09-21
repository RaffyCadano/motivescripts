import { useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import {
  defaultNotificationPreferences,
  notificationEvents,
  type NotificationPreferenceMap,
} from "@/data/notificationPreferences";
import { fetchMyNotificationPreferences, setMyNotificationPreference } from "@/data/notificationPreferencesRepository";
import { AgencyDbError } from "@/lib/dbErrors";
import type { NotificationEvent } from "@/types/database";
import { cn } from "@/lib/cn";

/** Personal in-app notification switches. Each change saves immediately; the default for every event is on. */
export function NotificationPreferences() {
  const { profile } = useAuth();
  const userId = profile?.id ?? "";
  const [prefs, setPrefs] = useState<NotificationPreferenceMap>(defaultNotificationPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<NotificationEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchMyNotificationPreferences()
      .then((loaded) => {
        if (!cancelled) setPrefs(loaded);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof AgencyDbError ? caught.message : "Unable to load your notification settings.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle(event: NotificationEvent) {
    if (!userId || saving) return;
    const next = !prefs[event];
    setError(null);
    setSaving(event);
    setPrefs((current) => ({ ...current, [event]: next })); // optimistic
    try {
      await setMyNotificationPreference(userId, event, next);
    } catch (caught) {
      setPrefs((current) => ({ ...current, [event]: !next })); // put it back
      setError(caught instanceof AgencyDbError ? caught.message : "Unable to save that setting.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      {error ? (
        <p role="alert" className="mb-3 rounded-lg border border-[rgb(220_38_38_/_0.25)] bg-[rgb(220_38_38_/_0.05)] px-3 py-2 text-sm text-[#b42318]">
          {error}
        </p>
      ) : null}
      <ul className="space-y-2">
        {notificationEvents.map((event) => {
          const on = prefs[event.key];
          const labelId = `notif-${event.key}-label`;
          const hintId = `notif-${event.key}-hint`;
          return (
            <li
              key={event.key}
              className="flex items-center justify-between gap-4 rounded-lg border border-[var(--admin-line)] px-3 py-2.5"
            >
              <div className="min-w-0">
                <p id={labelId} className="text-sm font-medium text-[var(--admin-ink)]">
                  {event.label}
                </p>
                <p id={hintId} className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                  {event.description}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-labelledby={labelId}
                aria-describedby={hintId}
                disabled={loading || saving === event.key}
                onClick={() => void toggle(event.key)}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-blue)] disabled:opacity-60",
                  on ? "border-[var(--admin-blue)] bg-[var(--admin-blue)]" : "border-[var(--admin-line)] bg-[#cfd6e0]",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-block size-4 rounded-full bg-white shadow transition-transform",
                    on ? "translate-x-6" : "translate-x-1",
                  )}
                />
                <span className="sr-only">{on ? "On" : "Off"}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-[12px] text-[var(--admin-muted)]">
        These switches only affect you, and only in-app notifications. Email notifications aren&apos;t included.
        Notifications for tasks, deadlines, payroll, domains, and project updates are always delivered.
      </p>
    </div>
  );
}
