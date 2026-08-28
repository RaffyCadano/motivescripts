import { cn } from "@/lib/cn";
import type { ElementType } from "react";

type ProcessStepProps = {
  number?: string;
  title: string;
  body: string;
  className?: string;
  headingLevel?: "h2" | "h3";
};

export function ProcessStep({
  number,
  title,
  body,
  className,
  headingLevel = "h3",
}: ProcessStepProps) {
  const Heading = headingLevel as ElementType;

  return (
    <article className={cn("relative min-w-0", className)}>
      {number ? (
        <p className="font-heading text-sm font-bold tracking-[0.16em] text-cyan">{number}</p>
      ) : null}
      <Heading className={cn("text-xl", number && "mt-3")}>{title}</Heading>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
    </article>
  );
}
