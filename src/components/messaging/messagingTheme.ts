import { cn } from "@/lib/cn";
import type { MessagingTone } from "@/data/messaging";

export function messagingClasses(tone: MessagingTone) {
  const admin = tone === "admin";
  return {
    ink: admin ? "text-[var(--admin-ink)]" : "text-[var(--client-ink)]",
    muted: admin ? "text-[var(--admin-muted)]" : "text-[var(--client-muted)]",
    line: admin ? "border-[var(--admin-line)]" : "border-[var(--client-line)]",
    card: admin ? "bg-[var(--admin-card)]" : "bg-[var(--client-card)]",
    bg: admin ? "bg-[var(--admin-bg)]" : "bg-[var(--client-bg)]",
    hover: admin ? "hover:bg-[var(--admin-bg)]" : "hover:bg-[var(--client-bg)]",
    active: admin ? "bg-[var(--admin-hover)]" : "bg-[var(--client-hover)]",
    navy: admin ? "bg-[var(--admin-navy)]" : "bg-[var(--client-navy)]",
    blueBtn: admin ? "bg-[var(--admin-blue)] hover:bg-[var(--admin-navy)]" : "bg-[var(--client-blue)] hover:bg-[var(--client-bright)]",
    radius: admin ? "rounded-[var(--admin-radius)]" : "rounded-[var(--client-radius)]",
    control:
      "w-full rounded-[var(--radius-md)] border bg-white px-3 py-2.5 text-sm outline-none focus-visible:border-[rgb(0_80_240_/_0.45)] focus-visible:ring-2 focus-visible:ring-[rgb(0_80_240_/_0.18)]",
    controlBorder: admin ? "border-[var(--admin-line)]" : "border-[var(--client-line)]",
  };
}

export function unreadDotClass(tone: MessagingTone) {
  return cn("size-2 shrink-0 rounded-full", tone === "admin" ? "bg-[var(--admin-blue)]" : "bg-[var(--client-blue)]");
}
