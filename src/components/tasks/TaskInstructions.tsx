import {
  displayTaskInstructionText,
  hasTaskInstructionHeadings,
  parseTaskInstructionSections,
} from "@/data/productionTaskInstructions";

type TaskInstructionsProps = {
  title: string;
  description: string;
  className?: string;
};

export function TaskInstructions({ title, description, className }: TaskInstructionsProps) {
  const text = displayTaskInstructionText(title, description);
  if (!text) return null;

  if (!hasTaskInstructionHeadings(text)) {
    return <p className={className ?? "mt-4 whitespace-pre-line text-sm leading-relaxed text-[var(--admin-ink)]"}>{text}</p>;
  }

  const sections = parseTaskInstructionSections(text);
  return (
    <div className={className ?? "mt-4 space-y-4"}>
      {sections.map((section, index) => (
        <section key={`${section.heading ?? "intro"}-${index}`}>
          {section.heading ? (
            <h3 className="font-heading text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-muted)]">
              {section.heading}
            </h3>
          ) : null}
          {section.body ? (
            <p
              className={`whitespace-pre-line text-sm leading-relaxed text-[var(--admin-ink)] ${
                section.heading ? "mt-1.5" : ""
              }`}
            >
              {section.body}
            </p>
          ) : null}
        </section>
      ))}
    </div>
  );
}
