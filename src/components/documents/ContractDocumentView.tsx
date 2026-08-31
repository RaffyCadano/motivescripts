import { formatCalendarDate } from "@/data/documents";
import { formatUsdFromCents } from "@/data/money";
import { partitionScopeLines } from "@/data/proposalPresets";
import { site } from "@/data/site";
import type { ContractRevisionRow } from "@/types/database";

export type ContractViewModel = {
  number: string;
  revisionNumber: number;
  companyName: string;
  contactName?: string;
  projectName?: string | null;
  proposalNumber?: string | null;
  investmentCents?: number | null;
  acceptedAt?: string | null;
  acceptedEmail?: string | null;
  agencySignedAt?: string | null;
  agencySignedName?: string | null;
  agencySignedEmail?: string | null;
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

export function fiftyFiftySplit(cents: number): { depositCents: number; remainderCents: number } {
  const depositCents = Math.floor(cents / 2);
  return { depositCents, remainderCents: cents - depositCents };
}

function parseResponsibilityParts(text: string): { agency: string[]; client: string[]; other: string[] } {
  const agency: string[] = [];
  const client: string[] = [];
  const other: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^(agency|motivescripts)\s*:/i.test(line)) {
      agency.push(line.replace(/^(agency|motivescripts)\s*:\s*/i, ""));
    } else if (/^client\s*:/i.test(line)) {
      client.push(line.replace(/^client\s*:\s*/i, ""));
    } else {
      other.push(line);
    }
  }
  return { agency, client, other };
}

function CheckList({
  title,
  lines,
  ink,
}: {
  title: string;
  lines: string[];
  ink: string;
}) {
  if (lines.length === 0) return null;
  return (
    <div>
      {title ? <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[inherit] opacity-80">{title}</p> : null}
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

function SignatureParty({
  label,
  partyName,
  partyDetail,
  recordedAt,
  recordedEmail,
  recordedName,
  signedLabel,
  unsignedHint,
  ink,
  muted,
  line,
}: {
  label: string;
  partyName: string;
  partyDetail?: string;
  recordedAt?: string | null;
  recordedEmail?: string | null;
  recordedName?: string | null;
  signedLabel: string;
  unsignedHint: string;
  ink: string;
  muted: string;
  line: string;
}) {
  const signed = Boolean(recordedAt || recordedEmail || recordedName);
  return (
    <div>
      <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${muted}`}>{label}</p>
      <div className={`mt-8 flex min-h-[44px] items-end border-b ${line}`}>
        {signed ? <p className={`pb-2 font-heading text-sm font-semibold ${ink}`}>{signedLabel}</p> : null}
      </div>
      <p className={`mt-2 text-sm font-medium ${ink}`}>{partyName}</p>
      {partyDetail ? <p className={`mt-0.5 text-[12px] ${muted}`}>{partyDetail}</p> : null}
      <p className={`mt-3 text-[12px] leading-relaxed ${muted}`}>
        {signed
          ? [recordedName, recordedEmail, recordedAt ? formatAcceptedAt(recordedAt) : null].filter(Boolean).join(" · ")
          : unsignedHint}
      </p>
    </div>
  );
}

function Block({ title, body, ink, muted }: { title: string; body: string; ink: string; muted: string }) {
  if (!body?.trim()) return null;
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
  const scope = partitionScopeLines(rev.scope);
  const structuredScope = scope.pages.length + scope.features.length + scope.other.length > 1 || scope.pages.length > 0;
  const duties = parseResponsibilityParts(rev.responsibilities);
  const splitDuties = duties.agency.length > 0 || duties.client.length > 0;
  const investment = doc.investmentCents && doc.investmentCents > 0 ? doc.investmentCents : null;
  const schedule = investment != null ? fiftyFiftySplit(investment) : null;
  const compensationIsInvestmentLabel = /^(total project investment|investment)\s*:/i.test(rev.compensation.trim());

  return (
    <article className={`${radius} border ${line} ${card} p-5 md:p-8 ${ink}`}>
      <p className={`font-heading text-xs font-bold uppercase tracking-[0.18em] ${muted}`}>{site.name}</p>
      <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight">
        {rev.title.trim() || "Website Development Agreement"}
      </h1>
      <p className={`mt-2 font-heading text-base font-semibold ${ink}`}>Prepared for {doc.companyName}</p>
      <dl className={`mt-4 grid gap-2 text-sm ${muted}`}>
        {doc.projectName ? (
          <div>
            <dt className="inline font-semibold text-[inherit]">Project: </dt>
            <dd className="inline">{doc.projectName}</dd>
          </div>
        ) : null}
        {doc.proposalNumber ? (
          <div>
            <dt className="inline font-semibold text-[inherit]">Proposal: </dt>
            <dd className="inline">{doc.proposalNumber}</dd>
          </div>
        ) : null}
        {investment != null ? (
          <div>
            <dt className="inline font-semibold text-[inherit]">Investment: </dt>
            <dd className="inline">{formatUsdFromCents(investment)}</dd>
          </div>
        ) : null}
      </dl>
      <p className={`mt-3 text-[12px] ${muted}`}>
        {doc.number} · Revision {doc.revisionNumber}
      </p>
      <p className={`mt-4 text-[12px] leading-relaxed ${muted}`}>
        This is a workflow agreement in the MotiveScripts portal. It is not legal advice and is not a qualified digital
        signature.
      </p>
      <div className={`mt-8 space-y-8 border-t ${line} pt-8`}>
        <Block title="Parties" body={rev.parties} ink={ink} muted={muted} />

        {structuredScope ? (
          <section>
            <h2 className={`font-heading text-sm font-semibold tracking-tight ${ink}`}>Scope</h2>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <CheckList title="Pages & Design" lines={[...scope.pages, ...scope.other]} ink={ink} />
              <CheckList title="Functionality" lines={scope.features} ink={ink} />
            </div>
          </section>
        ) : (
          <Block title="Scope" body={rev.scope} ink={ink} muted={muted} />
        )}

        {splitDuties ? (
          <section>
            <h2 className={`font-heading text-sm font-semibold tracking-tight ${ink}`}>Responsibilities</h2>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <div>
                <p className={`text-[12px] font-semibold uppercase tracking-[0.12em] ${muted}`}>{site.name}</p>
                <ul className={`mt-2 space-y-1.5 text-sm leading-relaxed ${ink}`}>
                  {(duties.agency.length ? duties.agency : ["Complete the agreed website work."]).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className={`text-[12px] font-semibold uppercase tracking-[0.12em] ${muted}`}>Client</p>
                <ul className={`mt-2 space-y-1.5 text-sm leading-relaxed ${ink}`}>
                  {(duties.client.length ? duties.client : ["Provide content, feedback, and approvals."]).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            </div>
            {duties.other.length ? (
              <p className={`mt-4 whitespace-pre-wrap text-sm leading-relaxed ${muted}`}>{duties.other.join("\n")}</p>
            ) : null}
          </section>
        ) : (
          <Block title="Responsibilities" body={rev.responsibilities} ink={ink} muted={muted} />
        )}

        <Block title="Timeline" body={rev.timeline} ink={ink} muted={muted} />

        <section>
          <h2 className={`font-heading text-sm font-semibold tracking-tight ${ink}`}>Compensation</h2>
          {investment != null ? (
            <div className="mt-3">
              <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${muted}`}>Total Project Investment</p>
              <p className={`mt-1 font-heading text-2xl font-semibold ${ink}`}>{formatUsdFromCents(investment)}</p>
              {schedule ? (
                <ul className={`mt-3 space-y-1 text-sm ${muted}`}>
                  <li>50% deposit — {formatUsdFromCents(schedule.depositCents)}</li>
                  <li>50% final payment — {formatUsdFromCents(schedule.remainderCents)}</li>
                </ul>
              ) : null}
            </div>
          ) : null}
          {rev.compensation.trim() && !compensationIsInvestmentLabel ? (
            <p className={`mt-3 whitespace-pre-wrap text-sm leading-relaxed ${muted}`}>{rev.compensation}</p>
          ) : null}
          {rev.payment_terms.trim() ? (
            <div className="mt-4">
              <p className={`font-heading text-sm font-semibold ${ink}`}>Payment Terms</p>
              <p className={`mt-2 whitespace-pre-wrap text-sm leading-relaxed ${muted}`}>{rev.payment_terms}</p>
            </div>
          ) : null}
        </section>

        <Block title="Confidentiality" body={rev.confidentiality} ink={ink} muted={muted} />
        <Block title="Intellectual Property" body={rev.intellectual_property} ink={ink} muted={muted} />
        <Block title="Revisions" body={rev.revisions_policy} ink={ink} muted={muted} />
        <Block title="Termination" body={rev.termination} ink={ink} muted={muted} />
        <Block title="General Terms" body={rev.general_terms} ink={ink} muted={muted} />

        {rev.effective_date ? (
          <section>
            <h2 className={`font-heading text-sm font-semibold tracking-tight ${ink}`}>Effective Date</h2>
            <p className={`mt-2 font-heading text-base font-semibold ${ink}`}>{formatCalendarDate(rev.effective_date)}</p>
            <p className={`mt-1 text-sm ${muted}`}>The date this agreement becomes effective after acceptance.</p>
          </section>
        ) : null}
        {rev.expires_at ? (
          <section>
            <h2 className={`font-heading text-sm font-semibold tracking-tight ${ink}`}>Valid Until</h2>
            <p className={`mt-2 font-heading text-base font-semibold ${ink}`}>{formatCalendarDate(rev.expires_at)}</p>
            <p className={`mt-1 text-sm ${muted}`}>The date through which this contract may be accepted.</p>
          </section>
        ) : null}

        <section className={`border-t ${line} pt-6`}>
          <h2 className={`font-heading text-sm font-semibold tracking-tight ${ink}`}>Acceptance</h2>
          <p className={`mt-2 text-sm leading-relaxed ${muted}`}>
            The client accepts this agreement by signing in to the MotiveScripts client portal and choosing Accept
            Contract. That records the authenticated user’s agreement to these terms. It is not a qualified digital
            signature and is not legal advice.
          </p>
          <div className="mt-6 grid gap-8 sm:grid-cols-2">
            <SignatureParty
              label="Client"
              partyName={doc.companyName}
              partyDetail={doc.contactName && doc.contactName !== doc.companyName ? doc.contactName : undefined}
              recordedAt={doc.acceptedAt}
              recordedEmail={doc.acceptedEmail}
              signedLabel="Accepted in portal"
              unsignedHint="Signed in the client portal"
              ink={ink}
              muted={muted}
              line={line}
            />
            <SignatureParty
              label="Agency"
              partyName={site.name}
              partyDetail={doc.agencySignedName || "Authorized representative"}
              recordedAt={doc.agencySignedAt}
              recordedEmail={doc.agencySignedEmail}
              signedLabel="Signed"
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
