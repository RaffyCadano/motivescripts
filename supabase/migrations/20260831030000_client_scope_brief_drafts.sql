-- Allow a saved draft before official submit.
-- Draft: submitted_at is null. Submitted: submitted_at is set.
-- Do not edit 20260831010000 or 20260831020000.

alter table public.client_scope_briefs
  alter column submitted_at drop not null,
  alter column submitted_at drop default;

alter table public.client_scope_briefs
  alter column has_existing_website drop not null,
  alter column has_existing_website drop default;

alter table public.client_scope_briefs
  drop constraint if exists client_scope_briefs_goal_len;

alter table public.client_scope_briefs
  add constraint client_scope_briefs_goal_len check (char_length(trim(goal)) <= 2000);

comment on column public.client_scope_briefs.submitted_at is
  'Set when the client submits. Null means a draft (In Progress). No row means Not Started.';

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
  new.other_pages := trim(coalesce(new.other_pages, ''));
  new.other_features := trim(coalesce(new.other_features, ''));
  new.current_website_url := trim(coalesce(new.current_website_url, ''));
  new.current_website_notes := trim(coalesce(new.current_website_notes, ''));
  new.other_style := trim(coalesce(new.other_style, ''));
  new.liked_websites := trim(coalesce(new.liked_websites, ''));
  new.additional_notes := trim(coalesce(new.additional_notes, ''));
  new.selected_pages := coalesce((
    select array_agg(page order by first_seen)
    from (
      select trim(p) as page, min(ord) as first_seen
      from unnest(coalesce(new.selected_pages, '{}')) with ordinality as t(p, ord)
      where length(trim(p)) > 0
      group by trim(p)
    ) pages
  ), '{}');
  new.features := coalesce((
    select array_agg(item order by first_seen)
    from (
      select trim(p) as item, min(ord) as first_seen
      from unnest(coalesce(new.features, '{}')) with ordinality as t(p, ord)
      where length(trim(p)) > 0
      group by trim(p)
    ) items
  ), '{}');
  new.design_styles := coalesce((
    select array_agg(item order by first_seen)
    from (
      select trim(p) as item, min(ord) as first_seen
      from unnest(coalesce(new.design_styles, '{}')) with ordinality as t(p, ord)
      where length(trim(p)) > 0
      group by trim(p)
    ) items
  ), '{}');
  if new.has_existing_website is not true then
    new.current_website_url := '';
    new.current_website_notes := '';
  end if;
  if tg_op = 'UPDATE' and old.submitted_at is not null then
    new.submitted_at := old.submitted_at;
  end if;
  new.updated_by := auth.uid();
  return new;
end;
$$;

revoke all on function public.client_scope_briefs_normalize() from public, anon;
