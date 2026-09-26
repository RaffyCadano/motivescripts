import type { ReactNode } from "react";
import { Plus } from "lucide-react";

type FaqItemProps = {
  question: string;
  answer: string;
  /** Items that share a name open one at a time (where the browser supports it). */
  group?: string;
};

/** The rounded panel a list of FaqItems sits in; the rows draw their own dividers. */
export function FaqPanel({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--ms-white)] shadow-[var(--shadow-card)]">
      {children}
    </div>
  );
}

export function FaqItem({ question, answer, group }: FaqItemProps) {
  return (
    <details name={group} className="group border-b border-[var(--color-line)] transition-colors duration-[var(--duration-base)] last:border-b-0 open:bg-[var(--ms-bg-card)]">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-heading text-base font-semibold text-ink marker:content-none hover:text-blue focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-blue)] md:px-7 md:py-5 md:text-lg [&::-webkit-details-marker]:hidden">
        {question}
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-line-strong)] bg-white text-muted transition-all duration-[var(--duration-base)] group-open:rotate-45 group-open:border-transparent group-open:bg-blue group-open:text-white"
        >
          <Plus size={16} strokeWidth={2.2} />
        </span>
      </summary>
      <p className="max-w-2xl px-5 pb-6 text-sm leading-relaxed text-muted md:px-7 md:text-base">{answer}</p>
    </details>
  );
}
