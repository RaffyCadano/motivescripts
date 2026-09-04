-- Time entries: staff log hours against a project (optionally a task). Feeds
-- the project Time tab (fixed-fee budget comparison) and hourly invoice
-- generation. Direct-table RLS-governed CRUD, mirroring task_client_requests
-- (20260903000000_task_workspace.sql) -- not RPC-wrapped, since there's no
-- cross-table chain-of-custody check needed beyond project assignment.

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  staff_id uuid not null references public.profiles(id) on delete cascade,
  entry_date date not null default (timezone('utc', now()))::date,
  hours numeric(6,2) not null check (hours > 0 and hours <= 24),
  note text not null default '',
  billed_at timestamptz,
  invoice_id uuid references public.invoices(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.profiles(id)
);

create index time_entries_project_idx on public.time_entries (project_id);
create index time_entries_staff_idx on public.time_entries (staff_id, entry_date);
create index time_entries_unbilled_idx on public.time_entries (project_id) where billed_at is null;

alter table public.time_entries enable row level security;

-- Admin sees everything; a staff member sees their own entries on projects
-- they're assigned to; anyone with invoices.manage on the project can see
-- entries for billing purposes even if not personally assigned.
create policy time_entries_select on public.time_entries
  for select to authenticated
  using (
    public.is_admin()
    or (staff_id = auth.uid() and public.staff_may_project(project_id, 'projects.view'))
    or public.staff_may_project(project_id, 'invoices.manage')
  );

create policy time_entries_insert on public.time_entries
  for insert to authenticated
  with check (
    staff_id = auth.uid()
    and created_by = auth.uid()
    and public.staff_may_project(project_id, 'projects.view')
  );

-- Once billed, a staff member's own row locks -- only admin can still touch it
-- (e.g. to correct a billing mistake). Unbilled rows stay editable by the
-- logging staff member.
create policy time_entries_update on public.time_entries
  for update to authenticated
  using (public.is_admin() or (staff_id = auth.uid() and billed_at is null))
  with check (public.is_admin() or (staff_id = auth.uid() and billed_at is null));

create policy time_entries_delete on public.time_entries
  for delete to authenticated
  using (public.is_admin() or (staff_id = auth.uid() and billed_at is null));

revoke all on public.time_entries from public, anon;
grant select, insert, update, delete on public.time_entries to authenticated;

comment on table public.time_entries is 'Staff-logged hours per project/task. billed_at/invoice_id set when rolled into an invoice via generate_invoice_items_from_time_entries.';
