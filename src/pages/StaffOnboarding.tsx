import { useState, type FormEvent, type ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { agencyHomePath } from "@/auth/roles";
import { useStaffOnboardingGate } from "@/auth/StaffOnboardingGate";
import { Logo } from "@/components/Logo";
import {
  AGREEMENT_TEXT,
  validateOnboarding,
  type OnboardingFieldErrors,
  type StaffOnboardingInput,
} from "@/data/staffOnboarding";
import { submitStaffOnboarding } from "@/data/staffOnboardingRepository";
import { AgencyDbError } from "@/lib/dbErrors";
import { cn } from "@/lib/cn";
import { usePrivatePageTitle } from "@/lib/usePrivatePageTitle";
import "@/styles/admin.css";

const inputClass =
  "mt-1.5 h-10 w-full rounded-lg border border-[var(--admin-line)] bg-white px-3 text-sm text-[var(--admin-ink)] outline-none focus:border-[rgb(0_80_240_/_0.45)]";

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-[var(--admin-ink)]">
      {label}
      {children}
      {error ? (
        <span className="mt-1.5 block text-[12px] font-medium text-[#b42318]">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-[12px] font-normal text-[var(--admin-muted)]">{hint}</span>
      ) : null}
    </label>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <section className="rounded-[var(--admin-radius)] border border-[var(--admin-line)] bg-[var(--admin-card)] p-5 md:p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-7 items-center justify-center rounded-full bg-[var(--admin-navy)] font-heading text-[13px] font-semibold text-white">
          {number}
        </span>
        <h2 className="font-heading text-base font-semibold tracking-tight text-[var(--admin-ink)]">{title}</h2>
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

/** The first thing a new team member sees: their details, how to pay them, and the working agreement. */
export function StaffOnboarding() {
  usePrivatePageTitle("Welcome — MotiveScripts Team");
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { markComplete } = useStaffOnboardingGate();
  const [form, setForm] = useState<StaffOnboardingInput>({
    legalName: profile?.fullName ?? "",
    phone: "",
    emergencyName: "",
    emergencyPhone: "",
    zelleContact: "",
    paypalEmail: "",
    signedName: "",
    acknowledged: false,
  });
  const [errors, setErrors] = useState<OnboardingFieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (profile?.role !== "staff") return <Navigate to={agencyHomePath(profile)} replace />;

  function set<K extends keyof StaffOnboardingInput>(key: K, value: StaffOnboardingInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const found = validateOnboarding(form);
    setErrors(found);
    setSubmitError(null);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      await submitStaffOnboarding(form);
      markComplete();
      navigate(agencyHomePath(profile), { replace: true });
    } catch (caught) {
      setSubmitError(caught instanceof AgencyDbError ? caught.message : "We couldn’t save that. Try again in a moment.");
      setBusy(false);
    }
  }

  const firstName = (profile.fullName || "").trim().split(/\s+/)[0];

  return (
    <main className="admin-theme min-h-svh bg-[var(--admin-bg)] px-4 py-8 md:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center justify-between gap-3">
          <Logo />
          <button
            type="button"
            onClick={() => void signOut().then(() => navigate("/login", { replace: true }))}
            className="text-[13px] font-medium text-[var(--admin-muted)] hover:text-[var(--admin-ink)]"
          >
            Sign out
          </button>
        </div>

        <h1 className="mt-8 font-heading text-[1.75rem] font-semibold tracking-tight text-[var(--admin-ink)]">
          {firstName ? `Welcome, ${firstName}` : "Welcome to MotiveScripts"}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--admin-muted)]">
          Before you start, we need a few details and your OK on the working agreement. It takes about two minutes, and
          you only do it once.
        </p>

        <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
          <Step number={1} title="About you">
            <Field label="Full legal name" error={errors.legalName} hint="As it appears on your ID. We use it on the agreement and for payments.">
              <input value={form.legalName} onChange={(event) => set("legalName", event.target.value)} autoComplete="name" className={inputClass} />
            </Field>
            <Field label="Phone number" error={errors.phone} hint="Only used if we can’t reach you any other way.">
              <input type="tel" value={form.phone} onChange={(event) => set("phone", event.target.value)} autoComplete="tel" className={inputClass} />
            </Field>
          </Step>

          <Step number={2} title="How we pay you">
            <p className="text-sm text-[var(--admin-muted)]">
              Add at least one. Your pay rate is set by MotiveScripts, and you can see it on your profile.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Zelle phone or email" error={errors.zelleContact}>
                <input value={form.zelleContact} onChange={(event) => set("zelleContact", event.target.value)} className={inputClass} />
              </Field>
              <Field label="PayPal email" error={errors.paypalEmail}>
                <input type="email" value={form.paypalEmail} onChange={(event) => set("paypalEmail", event.target.value)} className={inputClass} />
              </Field>
            </div>
            <p className="text-[12px] text-[var(--admin-muted)]">
              We never ask for bank account numbers or tax IDs here.
            </p>
          </Step>

          <Step number={3} title="Emergency contact (optional)">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" error={errors.emergencyName}>
                <input value={form.emergencyName} onChange={(event) => set("emergencyName", event.target.value)} className={inputClass} />
              </Field>
              <Field label="Phone" error={errors.emergencyPhone}>
                <input type="tel" value={form.emergencyPhone} onChange={(event) => set("emergencyPhone", event.target.value)} className={inputClass} />
              </Field>
            </div>
          </Step>

          <Step number={4} title="Working agreement">
            <div
              tabIndex={0}
              role="region"
              aria-label="Working agreement"
              className="max-h-64 overflow-y-auto whitespace-pre-line rounded-lg border border-[var(--admin-line)] bg-[var(--admin-bg)] p-4 text-[13px] leading-relaxed text-[var(--admin-ink)]"
            >
              {AGREEMENT_TEXT}
            </div>
            <label className="flex items-start gap-2.5 text-sm text-[var(--admin-ink)]">
              <input
                type="checkbox"
                checked={form.acknowledged}
                onChange={(event) => set("acknowledged", event.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--admin-blue)]"
              />
              <span>I have read the agreement and I accept it.</span>
            </label>
            {errors.acknowledged ? <p className="text-[12px] font-medium text-[#b42318]">{errors.acknowledged}</p> : null}
            <Field label="Sign by typing your full legal name" error={errors.signedName}>
              <input value={form.signedName} onChange={(event) => set("signedName", event.target.value)} autoComplete="off" className={inputClass} />
            </Field>
          </Step>

          {submitError ? <p className="text-sm font-medium text-[#b42318]">{submitError}</p> : null}

          <button
            type="submit"
            disabled={busy}
            className={cn(
              "inline-flex h-11 w-full items-center justify-center rounded-lg bg-[var(--admin-blue)] px-5 font-heading text-sm font-semibold text-white transition-opacity hover:opacity-90",
              busy && "opacity-60",
            )}
          >
            {busy ? "Saving…" : "Finish and open my workspace"}
          </button>
        </form>
      </div>
    </main>
  );
}
