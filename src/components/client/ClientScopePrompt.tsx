import { Link } from "react-router-dom";
import { scopeStatus, type ClientScopeBrief } from "@/data/scopeBriefs";

type ClientScopePromptProps = {
  brief: ClientScopeBrief | null;
  hasProject: boolean;
};

export function ClientScopePrompt({ brief, hasProject }: ClientScopePromptProps) {
  if (hasProject) return null;

  const status = scopeStatus(brief);

  if (status === "submitted") {
    return (
      <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--client-muted)]">Website Scope</p>
        <h2 className="mt-2 font-heading text-lg font-semibold tracking-tight text-[var(--client-ink)]">
          Scope submitted ✓
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--client-muted)]">
          Your requirements have been received. MotiveScripts will review them and prepare your project and proposal.
        </p>
        <Link
          to="/client/scope"
          className="mt-5 inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--client-line)] bg-white px-5 font-heading text-sm font-semibold text-[var(--client-ink)] hover:bg-[var(--client-hover)]"
        >
          View Scope
        </Link>
      </section>
    );
  }

  if (status === "in_progress") {
    return (
      <section className="rounded-[var(--client-radius)] border border-[rgb(0_80_240_/_0.22)] bg-[var(--client-card)] p-5 md:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--client-muted)]">Website Scope</p>
        <h2 className="mt-2 font-heading text-lg font-semibold tracking-tight text-[var(--client-ink)]">In progress</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--client-muted)]">Your scope is saved as a draft.</p>
        <Link
          to="/client/scope"
          className="mt-5 inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-5 font-heading text-sm font-semibold text-white hover:bg-[var(--client-bright)]"
        >
          Continue Scope
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-[var(--client-radius)] border border-[rgb(0_80_240_/_0.22)] bg-[var(--client-card)] p-5 md:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--client-muted)]">Website Scope</p>
      <h2 className="mt-2 font-heading text-lg font-semibold tracking-tight text-[var(--client-ink)]">Not started</h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--client-muted)]">
        Tell us what you want your website to include.
      </p>
      <Link
        to="/client/scope"
        className="mt-5 inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-5 font-heading text-sm font-semibold text-white hover:bg-[var(--client-bright)]"
      >
        Complete Scope
      </Link>
    </section>
  );
}
