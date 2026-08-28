import { Check } from "lucide-react";
import type { ClientTask } from "@/data/clientPortal";
import { cn } from "@/lib/cn";

type ClientTasksProps = {
  tasks: ClientTask[];
};

export function ClientTasks({ tasks }: ClientTasksProps) {
  return (
    <section className="rounded-[var(--client-radius)] border border-[var(--client-line)] bg-[var(--client-card)] p-5 md:p-6">
      <h2 className="font-heading text-sm font-semibold tracking-tight text-[var(--client-ink)]">Your Actions</h2>
      <ul className="mt-4 space-y-3">
        {tasks.map((task) => {
          const done = task.status === "done";
          return (
            <li key={task.id} className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border",
                  done
                    ? "border-[var(--client-blue)] bg-[var(--client-blue)] text-white"
                    : "border-[var(--client-line)] bg-white",
                )}
                aria-hidden="true"
              >
                {done ? <Check size={11} strokeWidth={2.6} /> : null}
              </span>
              <span
                className={cn(
                  "text-sm",
                  done ? "text-[var(--client-muted)] line-through" : "text-[var(--client-ink)]",
                )}
              >
                {task.label}
                <span className="sr-only">{done ? ", completed" : ", open"}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
