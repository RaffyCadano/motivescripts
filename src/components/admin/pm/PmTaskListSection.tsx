import type { LucideIcon } from "lucide-react";
import { CircleCheck } from "lucide-react";
import { MyTaskMobileList, MyTaskTable } from "@/components/admin/MyTaskList";
import { OverviewCard, OverviewEmpty } from "@/components/admin/overview/kit";
import type { TeamWorkTask } from "@/data/teamWorkspace";

type PmTaskListSectionProps = {
  id?: string;
  title: string;
  tasks: TeamWorkTask[];
  emptyTitle: string;
  emptyBody: string;
  onOpen: (task: TeamWorkTask) => void;
  viewAllHref?: string;
  viewAllLabel?: string;
  icon?: LucideIcon;
};

/** Shared "task queue" card for the PM dashboard -- Today's Work, Due This Week, Overdue all reuse this. */
export function PmTaskListSection({
  id,
  title,
  tasks,
  emptyTitle,
  emptyBody,
  onOpen,
  viewAllHref,
  viewAllLabel = "View all",
  icon,
}: PmTaskListSectionProps) {
  return (
    <OverviewCard
      id={id}
      icon={icon}
      title={title}
      count={tasks.length}
      action={viewAllHref ? { label: viewAllLabel, to: viewAllHref } : undefined}
    >
      {tasks.length === 0 ? (
        <OverviewEmpty compact icon={CircleCheck} title={emptyTitle} body={emptyBody} />
      ) : (
        <div>
          <MyTaskTable tasks={tasks} onOpen={onOpen} />
          <MyTaskMobileList tasks={tasks} onOpen={onOpen} />
        </div>
      )}
    </OverviewCard>
  );
}
