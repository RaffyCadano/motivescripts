import { formatCalendarDate } from "@/data/documents";
import { site } from "@/data/site";
import type { ContractRevisionRow } from "@/types/database";

type ContractViewModel = {
  number: string;
  revisionNumber: number;
  companyName: string;
  contactName?: string;
  acceptedAt?: string | null;
  acceptedEmail?: string | null;
  revision: Pick<
    ContractRevisionRow,
    | "title"
    | "parties"
    | "scope"
    | "responsibilities"
    | "timeline"
    | "compensation"
    | "payment_terms"
    | "confidentiality"
    | "intellectual_property"
    | "revisions_policy"
    | "termination"
    | "general_terms"
    | "effective_date"
    | "expires_at"
  >;
};

function formatAcceptedAt(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function SignatureParty({
  label,
  partyName,
  partyDetail,
  acceptedAt,
  acceptedEmail,
  unsignedHint,
  ink,
  muted,
  line,
}: {
  label: string;
  partyName: string;
  partyDetail?: string;
  acceptedAt?: string | null;
  acceptedEmail?: string | null;
  unsignedHint: string;
  ink: string;
  muted: string;
  line: string;
}) {
  const accepted = Boolean(acceptedAt || acceptedEmail);
  return (
    <div>
      <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${muted}`}>{label}</p>
      <div className={`mt-8 flex min-h-[44px] items-end border-b ${line}`}>
        {accepted ? <p className={`pb-2 font-heading text-sm font-semibold ${ink}`}>Accepted in portal</p> : null}
      </div>
      <p className={`mt-2 text-sm font-medium ${ink}`}>{partyName}</p>
      {partyDetail ? <p className={`mt-0.5 text-[12px] ${muted}`}>{partyDetail}</p> : null}
      <p className={`mt-3 text-[12px] leading-relaxed ${muted}`}>
        {accepted
          ? [acceptedEmail, acceptedAt ? formatAcceptedAt(acceptedAt) : null].filter(Boolean).join(" · ")
          : unsignedHint}
      </p>
    </div>
  );
}

function Block({ title, body, ink, muted }: { title: string; body: string; ink: string; muted: string }) {
  if (!body.trim()) return null;
  return (
    <section>
      <h2 className={`font-heading text-sm font-semibold tracking-tight ${ink}`}>{title}</h2>
      <p className={`mt-2 whitespace-pre-wrap text-sm leading-relaxed ${muted}`}>{body}</p>
    </section>
  );
}

export function ContractDocumentView({
  document: doc,
  tone = "admin",
}: {
  document: ContractViewModel;
  tone?: "admin" | "client";
}) {
  const ink = tone === "client" ? "text-[var(--client-ink)]" : "text-[var(--admin-ink)]";
  const muted = tone === "client" ? "text-[var(--client-muted)]" : "text-[var(--admin-muted)]";
  const line = tone === "client" ? "border-[var(--client-line)]" : "border-[var(--admin-line)]";
  const card = tone === "client" ? "bg-[var(--client-card)]" : "bg-[var(--admin-card)]";
  const radius = tone === "client" ? "rounded-[var(--client-radius)]" : "rounded-[var(--admin-radius)]";
  const rev = doc.revision;

  return (
    <article className={`${radius} border ${line} ${card} p-5 md:p-8 ${ink}`}>
      <p className={`font-heading text-xs font-bold uppercase tracking-[0.16em] ${muted}`}>{site.name}</p>
      <p className={`mt-1 text-sm ${muted}`}>{site.supportEmail}</p>
      <p className={`mt-2 text-sm ${muted}`}>
        {doc.number} · Revision {doc.revisionNumber}
      </p>
      <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight">{rev.title || "Agreement"}</h1>
      <p className={`mt-2 text-sm ${muted}`}>Prepared for {doc.companyName}</p>
      <p className={`mt-4 text-[12px] leading-relaxed ${muted}`}>
        This is a workflow agreement in the MotiveScripts portal. It is not legal advice and is not a qualified digital
        signature.
      </p>
      <div className="mt-8 space-y-6">
        <Block title="Parties" body={rev.parties} ink={ink} muted={muted} />
        <Block title="Scope" body={rev.scope} ink={ink} muted={muted} />
        <Block title="Responsibilities" body={rev.responsibilities} ink={ink} muted={muted} />
        <Block title="Timeline" body={rev.timeline} ink={ink} muted={muted} />
        <Block title="Compensation" body={rev.compensation} ink={ink} muted={muted} />
        <Block title="Payment terms" body={rev.payment_terms} ink={ink} muted={muted} />
        <Block title="Confidentiality" body={rev.confidentiality} ink={ink} muted={muted} />
        <Block title="Intellectual property" body={rev.intellectual_property} ink={ink} muted={muted} />
        <Block title="Revisions" body={rev.revisions_policy} ink={ink} muted={muted} />
        <Block title="Termination" body={rev.termination} ink={ink} muted={muted} />
        <Block title="General terms" body={rev.general_terms} ink={ink} muted={muted} />
        {rev.effective_date || rev.expires_at ? (
          <p className={`text-sm ${muted}`}>
            {[
              rev.effective_date ? `Effective ${formatCalendarDate(rev.effective_date)}` : null,
              rev.expires_at ? `Valid until ${formatCalendarDate(rev.expires_at)}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
        <section className={`border-t ${line} pt-6`}>
          <h2 className={`font-heading text-sm font-semibold tracking-tight ${ink}`}>Signatures</h2>
          <p className={`mt-2 text-[12px] leading-relaxed ${muted}`}>
            The Client signs this agreement by accepting it while signed in to the MotiveScripts portal. That records
            their agreement to these terms. It is not a qualified digital signature.
          </p>
          <div className="mt-6 grid gap-8 sm:grid-cols-2">
            <SignatureParty
              label="Client"
              partyName={doc.companyName}
              partyDetail={doc.contactName && doc.contactName !== doc.companyName ? doc.contactName : undefined}
              acceptedAt={doc.acceptedAt}
              acceptedEmail={doc.acceptedEmail}
              unsignedHint="Signed in the client portal"
              ink={ink}
              muted={muted}
              line={line}
            />
            <SignatureParty
              label="Agency"
              partyName={site.name}
              partyDetail="Authorized representative"
              unsignedHint={site.supportEmail}
              ink={ink}
              muted={muted}
              line={line}
            />
          </div>
        </section>
      </div>
    </article>
  );
}
