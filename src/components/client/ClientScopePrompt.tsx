import { Link } from "react-router-dom";
import type { ClientScopeBrief } from "@/data/scopeBriefs";

type ClientScopePromptProps = {
  brief: ClientScopeBrief | null;
  hasProject: boolean;
};

export function ClientScopePrompt({ brief, hasProject }: ClientScopePromptProps) {
  if (hasProject) return null;

  if (brief) {
    return (
      <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--client-muted)]">Next step</p>
        <h2 className="mt-2 font-heading text-lg font-semibold tracking-tight text-[var(--client-ink)]">
          We have your scope
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--client-muted)]">
          MotiveScripts will set up your project from what you sent. You can still update the form if something
          changes.
        </p>
        <Link
          to="/client/scope"
          className="mt-5 inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--client-line)] bg-white px-5 font-heading text-sm font-semibold text-[var(--client-ink)] hover:bg-[var(--client-hover)]"
        >
          Review your answers
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-[var(--client-radius)] border border-[rgb(0_80_240_/_0.22)] bg-[var(--client-card)] p-5 md:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--client-muted)]">Get started</p>
      <h2 className="mt-2 font-heading text-lg font-semibold tracking-tight text-[var(--client-ink)]">
        Tell us what you need
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--client-muted)]">
        Pick the pages you want and describe the site. We’ll use this to create your project and proposal.
      </p>
      <Link
        to="/client/scope"
        className="mt-5 inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--client-blue)] px-5 font-heading text-sm font-semibold text-white hover:bg-[var(--client-bright)]"
      >
        Open the scope form
      </Link>
    </section>
  );
}
