/**
 * A tiny signal that the list of leads changed. The public "Start a Project" form fires it after a successful
 * submit; the admin's LeadsProvider (when it is mounted) listens and refreshes. It exists so the public page
 * does not have to import the provider, which would pull all the admin data code into the public site's download.
 */
export const LEADS_CHANGED_EVENT = "motivescripts:leads-changed";

export function announceLeadsChanged(): void {
  window.dispatchEvent(new Event(LEADS_CHANGED_EVENT));
}
