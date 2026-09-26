import { useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import {
  defaultEmailAlertPreferences,
  emailAlertCategories,
  type EmailAlertCategory,
  type EmailAlertPreferenceMap,
} from "@/data/emailAlertPreferences";
import { fetchMyEmailAlertPreferences, setMyEmailAlertPreference } from "@/data/emailAlertPreferencesRepository";
import { AgencyDbError } from "@/lib/dbErrors";
import { cn } from "@/lib/cn";

/**
 * Personal email switches for the staff alerts (the same alerts that appear under the bell). Each change saves
 * immediately; every group is on by default. Pass `categories` to show only the groups that can reach this person.
 */
export function EmailAlertPreferences({ categories }: { categories?: EmailAlertCategory[] } = {}) {
  const { profile } = useAuth();
  const userId = profile?.id ?? "";
  const [prefs, setPrefs] = useState<EmailAlertPreferenceMap>(defaultEmailAlertPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<EmailAlertCategory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shown = categories ? emailAlertCategories.filter((item) => categories.includes(item.key)) : emailAlertCategories;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchMyEmailAlertPreferences()
      .then((loaded) => {
        if (!cancelled) setPrefs(loaded);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof AgencyDbError ? caught.message : "Unable to load your email settings.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle(category: EmailAlertCategory) {
    if (!userId || saving) return;
    const next = !prefs[category];
    setError(null);
    setSaving(category);
    setPrefs((current) => ({ ...current, [category]: next })); // optimistic
    try {
      await setMyEmailAlertPreference(userId, category, next);
    } catch (caught) {
      setPrefs((current) => ({ ...current, [category]: !next })); // put it back
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
        {shown.map((item) => {
          const on = prefs[item.key];
          const labelId = `email-alert-${item.key}-label`;
          const hintId = `email-alert-${item.key}-hint`;
          return (
            <li key={item.key} className="flex items-center justify-between gap-4 rounded-lg border border-[var(--admin-line)] px-3 py-2.5">
              <div className="min-w-0">
                <p id={labelId} className="text-sm font-medium text-[var(--admin-ink)]">
                  {item.label}
                </p>
                <p id={hintId} className="mt-0.5 text-[12px] text-[var(--admin-muted)]">
                  {item.description}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-labelledby={labelId}
                aria-describedby={hintId}
                disabled={loading || saving === item.key}
                onClick={() => void toggle(item.key)}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-blue)] disabled:opacity-60",
                  on ? "border-[var(--admin-blue)] bg-[var(--admin-blue)]" : "border-[var(--admin-line)] bg-[#cfd6e0]",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn("inline-block size-4 rounded-full bg-white shadow transition-transform", on ? "translate-x-6" : "translate-x-1")}
                />
                <span className="sr-only">{on ? "On" : "Off"}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-[12px] text-[var(--admin-muted)]">
        These emails go to the address on your profile and only cover alerts you would also see under the bell. Repeating reminders (an
        overdue task, an expired domain or SSL certificate) email once a week per item.
      </p>
    </div>
  );
}
