-- website_backups (20261020000000) was deliberately staff-only: an internal recovery aid, not a
-- client-facing download. But "Automated backups" is a client-facing Website Care promise, and the
-- client portal already surfaces comparable operational status (domain/hosting/SSL) without giving
-- any control over it -- so clients should at least be able to see that backups are happening,
-- same spirit, without gaining file access (storage.objects stays staff-only; unchanged here).

create policy website_backups_client_select on public.website_backups
  for select to authenticated
  using (
    public.is_client()
    and exists (
      select 1 from public.projects p
      where p.id = website_backups.project_id and p.client_id = public.current_client_id()
    )
  );

comment on policy website_backups_client_select on public.website_backups is
  'Read-only status visibility for the client portal (last backup time, size, ok/failed) -- storage.objects access remains staff-only, so this never grants file download.';
