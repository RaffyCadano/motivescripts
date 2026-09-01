import { cn } from "@/lib/cn";

export const adminFilterControlClass =
  "h-10 w-full rounded-[var(--admin-radius)] border bg-white px-3 text-sm text-[var(--admin-ink)] outline-none placeholder:text-[var(--admin-muted)] focus:border-[rgb(0_80_240_/_0.45)]";

export function adminFilterControlState(active: boolean) {
  return cn(adminFilterControlClass, active ? "border-[rgb(0_80_240_/_0.35)]" : "border-[var(--admin-line)]");
}

export function adminStatusChipClass(active: boolean) {
  return cn(
    "shrink-0 rounded-full px-3 py-1.5 font-heading text-[12px] font-semibold",
    active
      ? "bg-[var(--admin-navy)] text-white"
      : "bg-white text-[var(--admin-ink)] ring-1 ring-[var(--admin-line)] hover:bg-[var(--admin-hover)]",
  );
}
