import { formatUsdFromCents } from "@/data/money";
import type { SnapshotItem } from "@/data/documents";
import { displayLineItemName, newlineList, partitionScopeLines } from "@/data/proposalPresets";
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

function formatValidUntil(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
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

function CheckList({
  title,
  lines,
  ink,
  muted,
}: {
  title: string;
  lines: string[];
  ink: string;
  muted: string;
}) {
  if (lines.length === 0) return null;
  return (
    <div>
      {title ? <p className={`text-[12px] font-semibold uppercase tracking-[0.12em] ${muted}`}>{title}</p> : null}
      <ul className={`mt-2 space-y-1.5 text-sm leading-relaxed ${ink}`}>
        {lines.map((line) => (
          <li key={line} className="flex gap-2">
            <span className="mt-0.5 text-emerald-700" aria-hidden>
              ✓
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
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
  const scope = partitionScopeLines(doc.scope);
  const deliverables = newlineList(doc.deliverables);
  const namedItems = doc.items.filter((item) => item.name.trim());

  return (
    <article className={`${radius} border ${line} ${card} p-5 md:p-8 ${ink}`}>
      <p className={`font-heading text-xs font-bold uppercase tracking-[0.18em] ${muted}`}>{site.name}</p>
      <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight">Website Proposal</h1>
      <p className={`mt-2 font-heading text-base font-semibold ${ink}`}>Prepared for {doc.companyName}</p>
      {doc.title.trim() && doc.title.trim().toLowerCase() !== "website proposal" ? (
        <p className={`mt-1 text-sm ${muted}`}>{doc.title}</p>
      ) : null}
      <p className={`mt-3 text-[12px] ${muted}`}>
        {doc.number} · Revision {doc.revisionNumber}
      </p>
      <div className={`mt-6 border-t ${line} pt-8 space-y-8`}>
        <Block title="Overview" body={doc.introduction} ink={ink} muted={muted} />
        <Block title="Project Overview" body={doc.overview} ink={ink} muted={muted} />

        {scope.pages.length || scope.features.length || scope.other.length ? (
          <section>
            <h2 className={`font-heading text-sm font-semibold tracking-tight ${ink}`}>Scope of Work</h2>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <CheckList title="Pages & Design" lines={[...scope.pages, ...scope.other]} ink={ink} muted={muted} />
              <CheckList title="Functionality" lines={scope.features} ink={ink} muted={muted} />
            </div>
          </section>
        ) : null}

        {deliverables.length > 0 ? (
          <section>
            <h2 className={`font-heading text-sm font-semibold tracking-tight ${ink}`}>Deliverables</h2>
            <div className="mt-3">
              <CheckList title="" lines={deliverables} ink={ink} muted={muted} />
            </div>
          </section>
        ) : null}

        <Block title="Timeline" body={doc.timeline} ink={ink} muted={muted} />

        <section>
          <h2 className={`font-heading text-sm font-semibold tracking-tight ${ink}`}>Investment</h2>
          <ul className="mt-3 divide-y divide-[rgb(7_17_31_/_0.08)]">
            {namedItems.map((item, index) => (
              <li key={item.id ?? `${item.name}-${index}`} className="flex flex-wrap items-start justify-between gap-2 py-3">
                <div>
                  <p className={`font-heading text-sm font-semibold ${ink}`}>{displayLineItemName(item.name)}</p>
                  {item.description ? <p className={`mt-1 text-sm ${muted}`}>{item.description}</p> : null}
                </div>
                <p className={`font-heading text-sm font-semibold ${ink}`}>{formatUsdFromCents(item.total_cents)}</p>
              </li>
            ))}
          </ul>
          <div className={`mt-5 border-t ${line} pt-4`}>
            <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${muted}`}>Total Investment</p>
            <p className={`mt-1 font-heading text-2xl font-semibold ${ink}`}>{formatUsdFromCents(doc.investmentCents)}</p>
          </div>
        </section>

        <Block title="Payment Terms" body={doc.paymentTerms} ink={ink} muted={muted} />
        <Block title="Terms & Conditions" body={doc.terms} ink={ink} muted={muted} />
        <Block title="Notes" body={doc.notes} ink={ink} muted={muted} />
        {doc.validUntil ? (
          <section>
            <h2 className={`font-heading text-sm font-semibold tracking-tight ${ink}`}>Valid Until</h2>
            <p className={`mt-2 font-heading text-base font-semibold ${ink}`}>{formatValidUntil(doc.validUntil)}</p>
            <p className={`mt-1 text-sm ${muted}`}>The date through which the client can accept this proposal.</p>
          </section>
        ) : null}
      </div>
    </article>
  );
}
