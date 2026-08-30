import { useEffect } from "react";
import { useBlocker } from "react-router-dom";
import { adminGhostBtn, adminPrimaryBtn } from "@/components/admin/adminActionStyles";
import { AdminDialog } from "@/components/admin/leads/AdminDialog";

export function useUnsavedNavigation(dirty: boolean) {
  const blocker = useBlocker(dirty);

  useEffect(() => {
    if (!dirty) return;
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  return blocker;
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
