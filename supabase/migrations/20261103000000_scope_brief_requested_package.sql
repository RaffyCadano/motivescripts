-- The package a client says they want, chosen on the client portal's Website Scope page. It is a REQUEST,
-- not the package itself: projects.package (set by staff, see 20261102000000_project_package.sql) is what
-- drives proposals and the portal, because the package is what the client pays for. Staff see this when
-- they create the project and it pre-selects the Package dropdown there.
--
-- Nullable: null = not chosen / "not sure yet", and every scope brief that exists today stays null.
-- Written the same way as the rest of the brief (the client's own row, through the existing policies).

alter table public.client_scope_briefs
  add column if not exists requested_package text
    check (requested_package is null or requested_package in ('website', 'growth', 'custom'));

comment on column public.client_scope_briefs.requested_package is
  'website | growth | custom: the package the client asked for on the Website Scope page, or null (not chosen). A request only; the project''s own package (projects.package) is what takes effect and is set by staff.';
