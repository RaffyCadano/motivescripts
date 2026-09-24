import { usePortalSession } from "@/components/admin/leads/LeadsProvider";
import { clientHasFullPortal } from "@/data/projectPackages";

/**
 * What the signed-in client gets in their portal, from the packages on their projects (see
 * clientHasFullPortal). `fullPortal` is false only for a client whose active projects are all the Website
 * package: they keep everything the delivery and payment flow needs (approvals, feedback, messages,
 * proposals, contracts, invoices) but not the Files library.
 */
export function useClientPortalAccess(): { fullPortal: boolean } {
  const { projects } = usePortalSession();
  return { fullPortal: clientHasFullPortal(projects) };
}
