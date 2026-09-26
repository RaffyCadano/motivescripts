import type { CSSProperties } from "react";

/**
 * Some shared pieces (the Website Scope form, the Account & security section) are written with the client
 * portal's colour variables. Wrap them in an element with this style and they use the admin colours instead, so
 * they look like the rest of the admin and team screens.
 */
export const ADMIN_LOOK = {
  "--client-bg": "var(--admin-bg)",
  "--client-ink": "var(--admin-ink)",
  "--client-muted": "var(--admin-muted)",
  "--client-card": "var(--admin-card)",
  "--client-line": "var(--admin-line)",
  "--client-hover": "var(--admin-hover)",
  "--client-blue": "var(--admin-blue)",
  "--client-bright": "var(--admin-bright)",
  "--client-navy": "var(--admin-navy)",
  "--client-radius": "var(--admin-radius)",
} as CSSProperties;
