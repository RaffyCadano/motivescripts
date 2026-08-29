import { formatUsdFromCents } from "@/data/money";
import type { SnapshotItem } from "@/data/documents";
import { site } from "@/data/site";

export type ProposalViewModel = {
  number: string;
  title: string;
  revisionNumber: number;
  companyName: string;
  introduction: string;
  overview: string;
  scope: string;
  deliverables: string;
  timeline: string;
  paymentTerms: string;
  terms: string;
  notes: string;
  validUntil: string | null;
  items: SnapshotItem[];
  investmentCents: number;
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

function NumberedBlock({ title, body, ink, muted }: { title: string; body: string; ink: string; muted: string }) {
  const lines = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;
  return (
    <section>
      <h2 className={`font-heading text-sm font-semibold tracking-tight ${ink}`}>{title}</h2>
      <ol className={`mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed ${muted}`}>
        {lines.map((line, index) => (
          <li key={`${index}-${line}`}>{line}</li>
        ))}
      </ol>
    </section>
  );
}

export function ProposalDocumentView({
  document: doc,
  tone = "admin",
}: {
  document: ProposalViewModel;
  tone?: "admin" | "client";
}) {
  const ink = tone === "client" ? "text-[var(--client-ink)]" : "text-[var(--admin-ink)]";
  const muted = tone === "client" ? "text-[var(--client-muted)]" : "text-[var(--admin-muted)]";
  const line = tone === "client" ? "border-[var(--client-line)]" : "border-[var(--admin-line)]";
  const card = tone === "client" ? "bg-[var(--client-card)]" : "bg-[var(--admin-card)]";
  const radius = tone === "client" ? "rounded-[var(--client-radius)]" : "rounded-[var(--admin-radius)]";

  return (
    <article className={`${radius} border ${line} ${card} p-5 md:p-8 ${ink}`}>
      <p className={`font-heading text-xs font-bold uppercase tracking-[0.16em] ${muted}`}>{site.name}</p>
      <p className={`mt-1 text-sm ${muted}`}>{site.supportEmail}</p>
      <p className={`mt-2 text-sm ${muted}`}>
        {doc.number} · Revision {doc.revisionNumber}
      </p>
      <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight">{doc.title || "Untitled proposal"}</h1>
      <p className={`mt-2 text-sm ${muted}`}>Prepared for {doc.companyName}</p>
      <div className="mt-8 space-y-6">
        <Block title="Overview" body={doc.introduction || doc.overview} ink={ink} muted={muted} />
        {doc.introduction && doc.overview && doc.introduction.trim() !== doc.overview.trim() ? (
          <Block title="Project overview" body={doc.overview} ink={ink} muted={muted} />
        ) : null}
        <Block title="Scope of work" body={doc.scope} ink={ink} muted={muted} />
        <NumberedBlock title="Deliverables" body={doc.deliverables} ink={ink} muted={muted} />
        <Block title="Timeline" body={doc.timeline} ink={ink} muted={muted} />

        <section>
          <h2 className={`font-heading text-sm font-semibold tracking-tight ${ink}`}>Investment</h2>
          <ul className="mt-3 divide-y divide-[rgb(7_17_31_/_0.08)]">
            {doc.items.map((item, index) => (
              <li key={item.id ?? `${item.name}-${index}`} className="flex flex-wrap items-start justify-between gap-2 py-3">
                <div>
                  <p className={`font-heading text-sm font-semibold ${ink}`}>{item.name}</p>
                  {item.description ? <p className={`mt-1 text-sm ${muted}`}>{item.description}</p> : null}
                  <p className={`mt-1 text-[12px] ${muted}`}>
                    {item.quantity} × {formatUsdFromCents(item.unit_price_cents)}
                  </p>
                </div>
                <p className={`font-heading text-sm font-semibold ${ink}`}>{formatUsdFromCents(item.total_cents)}</p>
              </li>
            ))}
          </ul>
          <p className={`mt-4 font-heading text-lg font-semibold ${ink}`}>Total {formatUsdFromCents(doc.investmentCents)}</p>
        </section>

        <Block title="Payment terms" body={doc.paymentTerms} ink={ink} muted={muted} />
        <Block title="Terms & conditions" body={doc.terms} ink={ink} muted={muted} />
        <Block title="Notes" body={doc.notes} ink={ink} muted={muted} />
        {doc.validUntil ? (
          <p className={`text-sm ${muted}`}>
            Valid until{" "}
            {new Date(`${doc.validUntil}T00:00:00`).toLocaleDateString("en-US", {
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
