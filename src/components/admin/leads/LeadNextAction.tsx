import { Link } from "react-router-dom";
import { adminBlueBtn, adminPrimaryBtn } from "@/components/admin/adminActionStyles";
import type { Lead } from "@/data/leads";

type LeadNextActionProps = {
  lead: Lead;
  canConvert: boolean;
  onConvert: () => void;
};

export function LeadNextAction({ lead, canConvert, onConvert }: LeadNextActionProps) {
  if (lead.convertedClientId) {
    return (
      <section className="rounded-[var(--admin-radius)] border border-[rgb(0_80_240_/_0.22)] bg-[rgb(0_80_240_/_0.04)] p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">Next action</p>
        <h2 className="mt-1 font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">Open this client</h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--admin-muted)]">
          This lead has been converted. Continue the commercial workflow from the client record.
        </p>
        <Link to={`/admin/clients/${lead.convertedClientId}`} className={`${adminPrimaryBtn} mt-4 justify-center sm:inline-flex`}>
          Open Client
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-[var(--admin-radius)] border border-[rgb(0_80_240_/_0.22)] bg-[rgb(0_80_240_/_0.04)] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">Next action</p>
      <h2 className="mt-1 font-heading text-sm font-semibold tracking-tight text-[var(--admin-ink)]">
        Convert this lead to a client
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-[var(--admin-muted)]">
        Once you’re ready to move forward, convert this lead into a client and continue the commercial workflow.
      </p>
      {canConvert ? (
        <button type="button" className={`${adminBlueBtn} mt-4 justify-center sm:inline-flex`} onClick={onConvert}>
          Convert to Client
        </button>
      ) : null}
    </section>
  );
}
