-- Pin-style annotation comments on image deliverables (PNG/JPG only).
-- Additive to the existing text feedback/approval flow -- a second,
-- independent commenting channel on the same current version.

create table public.pin_comments (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.file_versions(id) on delete cascade,
  deliverable_id uuid not null references public.deliverables(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  x_pct numeric(6,3) not null check (x_pct >= 0 and x_pct <= 100),
  y_pct numeric(6,3) not null check (y_pct >= 0 and y_pct <= 100),
  body text not null check (length(trim(body)) > 0),
  status text not null default 'Open' check (status in ('Open', 'Resolved')),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id)
);

create index pin_comments_version_idx on public.pin_comments (version_id);
create index pin_comments_project_idx on public.pin_comments (project_id);

alter table public.pin_comments enable row level security;

create policy pin_comments_admin_select on public.pin_comments
  for select to authenticated
  using (public.is_admin());

create policy pin_comments_staff_select on public.pin_comments
  for select to authenticated
  using (
    public.staff_may_project(project_id, 'feedback.manage')
    or public.staff_may_project(project_id, 'files.view')
  );

create policy pin_comments_client_select on public.pin_comments
  for select to authenticated
  using (public.is_client() and client_id = public.current_client_id());

-- Client inserts go through client_submit_pin_comment (below), which re-checks
-- the same ownership chain server-side -- this policy is a second, redundant
-- layer in case of a direct insert attempt.
create policy pin_comments_client_insert on public.pin_comments
  for insert to authenticated
  with check (
    public.is_client()
    and client_id = public.current_client_id()
    and created_by = auth.uid()
    and status = 'Open'
    and exists (
      select 1
      from public.file_versions fv
      join public.deliverables d on d.id = fv.deliverable_id
      join public.projects p on p.id = d.project_id
      where fv.id = version_id
        and fv.is_current
        and d.id = deliverable_id
        and p.id = project_id
        and p.client_id = public.current_client_id()
        and d.status in ('In Review', 'Needs Changes')
    )
  );

create policy pin_comments_staff_insert on public.pin_comments
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.staff_may_project(project_id, 'feedback.manage')
  );

create policy pin_comments_resolve on public.pin_comments
  for update to authenticated
  using (public.is_admin() or public.staff_may_project(project_id, 'feedback.manage'))
  with check (public.is_admin() or public.staff_may_project(project_id, 'feedback.manage'));

revoke all on public.pin_comments from public, anon;
grant select, insert, update on public.pin_comments to authenticated;

comment on table public.pin_comments is 'Pin-positioned comments on an image file_version. Additive to feedback/approvals, same review-window lifecycle.';

-- ---------------------------------------------------------------------------
-- Client submission RPC: mirrors client_submit_feedback's ownership-chain
-- check, so the client_id/project_id/deliverable_id on the row are always
-- server-derived, never trusted from the browser beyond the version_id.
-- ---------------------------------------------------------------------------

create or replace function public.client_submit_pin_comment(
  p_version_id uuid,
  p_x_pct numeric,
  p_y_pct numeric,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  fv public.file_versions;
  d public.deliverables;
  p public.projects;
  pin_id uuid;
begin
  if not public.is_client() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into fv from public.file_versions where id = p_version_id and is_current;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  select * into d from public.deliverables where id = fv.deliverable_id;
  select * into p from public.projects where id = d.project_id;
  if p.client_id is distinct from public.current_client_id() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if d.status not in ('In Review', 'Needs Changes') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if length(trim(p_body)) = 0 then
    raise exception 'EMPTY_BODY' using errcode = 'P0001';
  end if;

  insert into public.pin_comments (version_id, deliverable_id, project_id, client_id, x_pct, y_pct, body, created_by)
  values (
    p_version_id, d.id, p.id, p.client_id,
    greatest(0, least(100, p_x_pct)), greatest(0, least(100, p_y_pct)),
    trim(p_body), auth.uid()
  )
  returning id into pin_id;

  insert into public.activity (project_id, actor_id, activity_type, message, metadata)
  values (
    p.id, auth.uid(), 'pin_comment_submitted', left(trim(p_body), 200),
    jsonb_build_object('icon', 'review', 'deliverable_id', d.id, 'pin_id', pin_id)
  );

  return pin_id;
end;
$$;

revoke all on function public.client_submit_pin_comment(uuid, numeric, numeric, text) from public, anon;
grant execute on function public.client_submit_pin_comment(uuid, numeric, numeric, text) to authenticated;

create or replace function public.resolve_pin_comment(p_pin_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.pin_comments
    set status = 'Resolved', resolved_at = now(), resolved_by = auth.uid()
    where id = p_pin_id
      and (public.is_admin() or public.staff_may_project(project_id, 'feedback.manage'));
  if not found then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.resolve_pin_comment(uuid) from public, anon;
grant execute on function public.resolve_pin_comment(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Notification: extend the existing activity_notify_recipients() trigger
-- function rather than adding a new trigger. `deliverable` is already
-- extracted from metadata->>'deliverable_id' by the existing function body.
-- ---------------------------------------------------------------------------

create or replace function public.activity_notify_recipients()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_client uuid;
  deliverable uuid;
begin
  select client_id into project_client from public.projects where id = new.project_id;
  deliverable := null;
  if jsonb_typeof(new.metadata) = 'object' and (new.metadata ? 'deliverable_id') then
    begin
      deliverable := (new.metadata->>'deliverable_id')::uuid;
    exception when others then
      deliverable := null;
    end;
  end if;

  if new.activity_type in ('feedback_submitted') then
    perform public.notify_admins(
      'feedback_received',
      'New feedback on a deliverable',
      left(new.message, 120),
      null, null, new.project_id, deliverable
    );
  elsif new.activity_type = 'changes_requested' then
    perform public.notify_admins(
      'changes_requested',
      'Changes requested on a deliverable',
      left(new.message, 120),
      null, null, new.project_id, deliverable
    );
  elsif new.activity_type = 'version_approved' then
    perform public.notify_admins(
      'version_approved',
      'A deliverable was approved',
      left(new.message, 120),
      null, null, new.project_id, deliverable
    );
  elsif new.activity_type = 'version_sent_for_review' then
    perform public.notify_client_users(
      project_client,
      'version_ready_for_review',
      'A file is ready for review',
      left(new.message, 120),
      null, null, new.project_id, deliverable
    );
  elsif new.activity_type = 'status_changed' then
    perform public.notify_client_users(
      project_client,
      'project_update',
      'Project updated',
      left(new.message, 120),
      null, null, new.project_id, null
    );
  elsif new.activity_type = 'pin_comment_submitted' then
    perform public.notify_admins(
      'pin_comment_received',
      'New pin comment on a deliverable',
      left(new.message, 120),
      null, null, new.project_id, deliverable
    );
  end if;

  return new;
end;
$$;
