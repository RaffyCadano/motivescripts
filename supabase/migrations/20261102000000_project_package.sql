-- The package a project was sold as (Website / Growth / Custom, the three columns of the Pricing page's
-- comparison table). Until now a "package" was only marketing copy plus a starting point in the contact
-- form; nothing in the system knew which one a client bought, so nothing could follow from it.
--
-- Nullable on purpose: every project that exists today keeps package = null, which the app treats as "no
-- package restrictions" (the full client portal), so this changes nothing for current clients until staff
-- set one. Only staff can write it (projects_admin_update / _insert); clients can read it (their own
-- project rows) but there is no client update policy on projects, so they can't change it.
--
-- What the package drives:
--   * proposals: a fresh draft is pre-filled with that package's line items (client app / admin app);
--   * the client portal: a client whose active projects are all 'website' doesn't get the Files library or
--     the live website status. Approvals, feedback, messages, proposals, contracts and invoices stay for
--     every package, because the launch gate and the payment gate depend on the client using them;
--   * client_website_health(): the live status is a Growth / Custom benefit, so it returns nothing for a
--     'website' project. This one IS enforced server-side (the rest of the gating is the portal UI).

alter table public.projects
  add column if not exists package text
    check (package is null or package in ('website', 'growth', 'custom'));

comment on column public.projects.package is
  'website | growth | custom: the package this project was sold as, or null (not set / legacy, no package restrictions). See the Pricing page comparison table.';

create or replace function public.client_website_health(p_project_id uuid)
returns table (
  environment text,
  status text,
  checked_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.owns_project(p_project_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  -- Live website status isn't part of the Website package.
  if exists (select 1 from public.projects p where p.id = p_project_id and p.package = 'website') then
    return;
  end if;

  return query
  select distinct on (whc.environment)
    whc.environment, whc.status, whc.checked_at
  from public.website_health_checks whc
  where whc.project_id = p_project_id
  order by whc.environment, whc.checked_at desc;
end;
$$;

comment on function public.client_website_health(uuid) is
  'Client-safe latest health status (healthy/degraded/down) per environment for the caller''s own project. Status and checked_at only -- see website_health_checks for the full staff-only row. Returns no rows for a project on the Website package (live status is a Growth / Custom benefit).';

revoke all on function public.client_website_health(uuid) from public, anon;
grant execute on function public.client_website_health(uuid) to authenticated;
