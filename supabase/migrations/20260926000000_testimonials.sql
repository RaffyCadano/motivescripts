-- Testimonials -- there was no way to collect or display client testimonials
-- anywhere in the app, not even as hardcoded marketing copy. This adds an
-- admin-curated table (staff write, nobody else submits) and lets the public
-- marketing site read published rows directly. This is the first table any
-- anonymous visitor reads directly -- everywhere else the public site goes
-- through an edge function (see public-lead) -- but the anon policy here is
-- narrow (published=true rows only, no write access), so it's a safe first
-- instance of that pattern rather than a broad precedent.

create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  role_title text not null default '',
  quote text not null,
  project_id uuid references public.projects (id) on delete set null,
  published boolean not null default false,
  display_order integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists testimonials_published_order_idx
  on public.testimonials (display_order) where published = true;

alter table public.testimonials enable row level security;

drop policy if exists testimonials_public_select on public.testimonials;
drop policy if exists testimonials_admin_select on public.testimonials;
drop policy if exists testimonials_admin_insert on public.testimonials;
drop policy if exists testimonials_admin_update on public.testimonials;
drop policy if exists testimonials_admin_delete on public.testimonials;

create policy testimonials_public_select
  on public.testimonials for select
  to anon, authenticated
  using (published = true);

create policy testimonials_admin_select
  on public.testimonials for select
  to authenticated
  using (public.is_admin());

create policy testimonials_admin_insert
  on public.testimonials for insert
  to authenticated
  with check (public.is_admin());

create policy testimonials_admin_update
  on public.testimonials for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy testimonials_admin_delete
  on public.testimonials for delete
  to authenticated
  using (public.is_admin());

grant select on public.testimonials to anon;
grant select, insert, update, delete on public.testimonials to authenticated;

drop trigger if exists testimonials_set_updated_at on public.testimonials;
create trigger testimonials_set_updated_at
  before update on public.testimonials
  for each row execute function public.set_updated_at();
