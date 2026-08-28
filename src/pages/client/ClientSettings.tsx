import { useEffect, useState, type FormEvent } from "react";
import { usePortalIdentity } from "@/components/admin/leads/LeadsProvider";

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
  }

  return (
    <div className="w-full space-y-6">
      <header>
        <h1 className="font-heading text-[1.75rem] font-semibold tracking-tight md:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-[var(--client-muted)]">
          Profile details come from your MotiveScripts account. The toggles below only remember a preference on this
          device. They do not change which emails MotiveScripts sends.
        </p>
      </header>

      <form
        className="space-y-8 rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6"
        onSubmit={onSubmit}
      >
        <fieldset>
          <legend className="font-heading text-sm font-semibold text-[var(--client-ink)]">Profile</legend>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <ReadOnlyField id="name" label="Name" value={identity.name} />
            <ReadOnlyField id="email" label="Email" value={identity.email} />
            <ReadOnlyField id="business" label="Business name" value={identity.businessName} />
            <ReadOnlyField id="phone" label="Phone" value={identity.phone || "—"} />
          </div>
        </fieldset>

        <fieldset>
          <legend className="font-heading text-sm font-semibold text-[var(--client-ink)]">This device</legend>
          <div className="mt-4 space-y-3">
            <Toggle
              id="email-notes"
              label="Remember that I want email reminders on this browser"
              checked={emailNotifications}
              onChange={(checked) => {
                setEmailNotifications(checked);
                setSaved(false);
              }}
            />
            <Toggle
              id="project-updates"
              label="Remember that I want project-update reminders on this browser"
              checked={projectUpdates}
              onChange={(checked) => {
                setProjectUpdates(checked);
                setSaved(false);
              }}
            />
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-5 font-heading text-sm font-semibold text-white hover:bg-[var(--client-bright)]"
          >
            Save on this device
          </button>
          {saved ? (
            <p className="text-sm text-[var(--client-muted)]" role="status">
              Saved on this device only.
            </p>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function ReadOnlyField({ id, label, value }: { id: string; label: string; value: string }) {
  return (
    <div>
      <label htmlFor={id} className="text-[13px] font-medium text-[var(--client-ink)]">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        readOnly
        className="mt-1.5 h-11 w-full rounded-[var(--radius-md)] border border-[var(--client-line)] bg-[var(--client-bg)] px-3 text-sm text-[var(--client-ink)]"
      />
    </div>
  );
}

function Toggle({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-4 rounded-xl bg-[var(--client-bg)] px-4 py-3">
      <span className="text-sm text-[var(--client-ink)]">{label}</span>
      <span className="relative inline-flex">
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
