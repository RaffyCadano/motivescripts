import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminGhostBtn, adminPrimaryBtn } from "@/components/admin/adminActionStyles";
import { AdminDialog } from "@/components/admin/leads/AdminDialog";
import { routerBasename } from "@/lib/appUrl";

type PendingLeave = { href: string };

export function useUnsavedNavigation(dirty: boolean) {
  const navigate = useNavigate();
  const [pending, setPending] = useState<PendingLeave | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) {
      setPending(null);
      return;
    }
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const target = (event.target as HTMLElement | null)?.closest("a[href]");
      if (!(target instanceof HTMLAnchorElement)) return;
      if (target.target === "_blank" || target.hasAttribute("download")) return;
      const href = target.href;
      if (!href) return;
      const next = new URL(href, window.location.href);
      if (next.origin !== window.location.origin) return;
      if (next.pathname === window.location.pathname && next.search === window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      setPending({ href: `${next.pathname}${next.search}${next.hash}` });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [dirty]);

  return {
    state: pending ? ("blocked" as const) : ("unblocked" as const),
    reset() {
      setPending(null);
    },
    proceed() {
      if (!pending) return;
      const href = pending.href;
      setPending(null);
      const base = routerBasename();
      const path = base !== "/" && href.startsWith(base) ? href.slice(base.length) || "/" : href;
      navigate(path);
    },
  };
}

export function UnsavedChangesDialog({
  open,
  busy,
  description,
  onKeepEditing,
  onDiscard,
  onKeepChanges,
}: {
  open: boolean;
  busy?: boolean;
  description: string;
  onKeepEditing: () => void;
  onDiscard: () => void;
  onKeepChanges: () => void;
}) {
  return (
    <AdminDialog
      open={open}
      busy={busy}
      title="Keep these changes?"
      description={description}
      onClose={onKeepEditing}
    >
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" disabled={busy} className={`${adminGhostBtn} justify-center`} onClick={onKeepEditing}>
          Keep editing
        </button>
        <button type="button" disabled={busy} className={`${adminGhostBtn} justify-center`} onClick={onDiscard}>
          Don’t save
        </button>
        <button type="button" disabled={busy} className={`${adminPrimaryBtn} justify-center`} onClick={onKeepChanges}>
          {busy ? "Saving…" : "Keep changes"}
        </button>
      </div>
    </AdminDialog>
  );
}
