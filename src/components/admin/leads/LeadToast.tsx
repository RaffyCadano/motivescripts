import { useEffect } from "react";
import { useLeads } from "@/components/admin/leads/LeadsProvider";

export function LeadToast() {
  const { toast, dismissToast } = useLeads();

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(dismissToast, 4200);
    return () => window.clearTimeout(timer);
  }, [dismissToast, toast]);

  if (!toast) return null;

  return (
    <div
      role="status"
      className="fixed bottom-5 right-5 z-[90] max-w-sm rounded-xl border border-[#e5eaf0] bg-white px-4 py-3 text-sm text-[#07111f] shadow-[0_12px_32px_rgb(7_17_31_/_0.12)]"
    >
      {toast.message}
    </div>
  );
}
