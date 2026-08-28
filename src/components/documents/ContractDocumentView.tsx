import { site } from "@/data/site";
import type { ContractRevisionRow } from "@/types/database";

type ContractViewModel = {
  number: string;
  revisionNumber: number;
  companyName: string;
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
        {rev.effective_date ? (
          <p className={`text-sm ${muted}`}>
            Effective{" "}
            {new Date(`${rev.effective_date}T00:00:00`).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        ) : null}
      </div>
    </article>
  );
}
