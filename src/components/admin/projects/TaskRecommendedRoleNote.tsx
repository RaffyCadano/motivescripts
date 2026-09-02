import { recommendedRoleLabel, type TaskRecommendedRoleId } from "@/data/taskRecommendedRoles";

export function TaskRecommendedRoleNote({ role }: { role: TaskRecommendedRoleId | null }) {
  const label = recommendedRoleLabel(role);
  if (!label) return null;
  return (
    <span className="text-[12px] text-[var(--admin-muted)]">Recommended: {label}</span>
  );
}
