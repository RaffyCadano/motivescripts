import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BadgeCheck,
  CheckSquare,
  Clock,
  Flag,
  LayoutDashboard,
  MessageSquare,
  Paperclip,
} from "lucide-react";

export const projectSectionTabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "milestones", label: "Milestones", icon: Flag },
  { id: "files", label: "Files", icon: Paperclip },
  { id: "time", label: "Time", icon: Clock },
  { id: "feedback", label: "Feedback", icon: MessageSquare },
  { id: "approvals", label: "Approvals", icon: BadgeCheck },
  { id: "activity", label: "Activity", icon: Activity },
] as const;

export type ProjectSectionTabId = (typeof projectSectionTabs)[number]["id"];

export type ProjectSectionTab = {
  id: ProjectSectionTabId;
  label: string;
  icon: LucideIcon;
};

export type ProjectSectionNavGroup = {
  label: string;
  items: ProjectSectionTab[];
};

const tabById = new Map(projectSectionTabs.map((item) => [item.id, item]));

export const projectSectionNavGroups: ProjectSectionNavGroup[] = [
  {
    label: "Main",
    items: [tabById.get("overview")!, tabById.get("tasks")!, tabById.get("activity")!],
  },
  {
    label: "Delivery",
    items: [tabById.get("milestones")!, tabById.get("files")!, tabById.get("time")!],
  },
  {
    label: "Communication",
    items: [tabById.get("feedback")!, tabById.get("approvals")!],
  },
];

export function isProjectSectionTabId(value: string | null): value is ProjectSectionTabId {
  return projectSectionTabs.some((item) => item.id === value);
}

export function projectOpenTaskCount(tasks: { status: string }[]): number {
  return tasks.filter((task) => task.status !== "Completed").length;
}
