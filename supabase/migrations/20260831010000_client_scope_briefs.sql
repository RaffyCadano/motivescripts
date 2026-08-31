-- Client scope intake: after they are a client, before the project and proposal.
-- One brief per client. Answers seed the project description and proposal scope.

create table public.client_scope_briefs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients (id) on delete cascade,
  selected_pages text[] not null default '{}',
  goal text not null default '',
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  constraint client_scope_briefs_goal_len check (char_length(trim(goal)) between 1 and 2000),
  constraint client_scope_briefs_pages_len check (cardinality(selected_pages) between 1 and 24),
  constraint client_scope_briefs_pages_allowed check (
    selected_pages <@ array[
      'Homepage',
      'Responsive Website Design',
      'Mobile Optimization',
      'Services Page',
      'About Page',
      'Contact Page',
      'Gallery',
      'Testimonials',
      'Quote Request Form',
      'Booking Form',
      'SEO Setup',
      'Analytics',
      'Google Maps',
      'Social Media Integration',
      'Hosting Setup'
    ]::text[]
  )
);

comment on table public.client_scope_briefs is
  'Portal intake after convert, before project. One row per client. Not the signed proposal.';

create index client_scope_briefs_submitted_at_idx on public.client_scope_briefs (submitted_at desc);

create or replace function public.client_scope_briefs_normalize()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_client() then
    new.client_id := public.current_client_id();
  end if;
  new.goal := trim(coalesce(new.goal, ''));
  new.selected_pages := coalesce((
    select array_agg(page order by first_seen)
    from (
      select trim(p) as page, min(ord) as first_seen
      from unnest(coalesce(new.selected_pages, '{}')) with ordinality as t(p, ord)
      where length(trim(p)) > 0
      group by trim(p)
    ) pages
  ), '{}');
  if tg_op = 'INSERT' then
    new.submitted_at := coalesce(new.submitted_at, now());
  else
    new.submitted_at := coalesce(old.submitted_at, new.submitted_at, now());
  end if;
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger client_scope_briefs_normalize
  before insert or update on public.client_scope_briefs
  for each row execute function public.client_scope_briefs_normalize();

create trigger client_scope_briefs_updated_at
  before update on public.client_scope_briefs
  for each row execute function public.set_updated_at();

alter table public.client_scope_briefs enable row level security;

create policy client_scope_briefs_select on public.client_scope_briefs
  for select to authenticated
  using (
    (public.is_client() and client_id = public.current_client_id())
    or public.staff_may_client(client_id, 'clients.view')
  );

create policy client_scope_briefs_insert on public.client_scope_briefs
  for insert to authenticated
  with check (
    (public.is_client() and client_id = public.current_client_id())
    or public.staff_may_client(client_id, 'clients.manage')
  );

create policy client_scope_briefs_update on public.client_scope_briefs
  for update to authenticated
  using (
    (public.is_client() and client_id = public.current_client_id())
    or public.staff_may_client(client_id, 'clients.manage')
  )
  with check (
    (public.is_client() and client_id = public.current_client_id())
    or public.staff_may_client(client_id, 'clients.manage')
  );

revoke all on table public.client_scope_briefs from public, anon;
grant select, insert, update on table public.client_scope_briefs to authenticated;
revoke all on function public.client_scope_briefs_normalize() from public, anon;
