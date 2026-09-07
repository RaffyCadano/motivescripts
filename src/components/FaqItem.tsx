type FaqItemProps = {
  question: string;
  answer: string;
};

export function FaqItem({ question, answer }: FaqItemProps) {
  return (
    <details className="group border-b border-[var(--color-line)] last:border-b-0">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-4 font-heading text-base font-semibold text-ink marker:content-none [&::-webkit-details-marker]:hidden md:text-lg">
        {question}
        <svg
          className="size-4 shrink-0 text-faint transition-transform duration-[var(--duration-base)] group-open:rotate-180"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        >
          <path d="m2.5 4.5 3.5 3.5 3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <p className="max-w-2xl pb-5 pt-1 text-sm leading-relaxed text-muted md:text-base">{answer}</p>
    </details>
  );
}
