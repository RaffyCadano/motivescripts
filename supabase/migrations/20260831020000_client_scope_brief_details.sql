-- Fuller client scope intake. One row per client still.
-- Does not change RLS. Do not edit 20260831010000_client_scope_briefs.sql.

alter table public.client_scope_briefs
  drop constraint if exists client_scope_briefs_pages_allowed;

alter table public.client_scope_briefs
  drop constraint if exists client_scope_briefs_pages_len;

alter table public.client_scope_briefs
  add constraint client_scope_briefs_pages_len check (cardinality(selected_pages) <= 24);

alter table public.client_scope_briefs
  add column if not exists features text[] not null default '{}',
  add column if not exists other_pages text not null default '',
  add column if not exists other_features text not null default '',
  add column if not exists has_existing_website boolean not null default false,
  add column if not exists current_website_url text not null default '',
  add column if not exists current_website_notes text not null default '',
  add column if not exists design_styles text[] not null default '{}',
  add column if not exists other_style text not null default '',
  add column if not exists liked_websites text not null default '',
  add column if not exists additional_notes text not null default '';

alter table public.client_scope_briefs
  drop constraint if exists client_scope_briefs_features_len,
  drop constraint if exists client_scope_briefs_styles_len,
  drop constraint if exists client_scope_briefs_other_pages_len,
  drop constraint if exists client_scope_briefs_other_features_len,
  drop constraint if exists client_scope_briefs_url_len,
  drop constraint if exists client_scope_briefs_website_notes_len,
  drop constraint if exists client_scope_briefs_other_style_len,
  drop constraint if exists client_scope_briefs_liked_len,
  drop constraint if exists client_scope_briefs_notes_len;

alter table public.client_scope_briefs
  add constraint client_scope_briefs_features_len check (cardinality(features) <= 24),
  add constraint client_scope_briefs_styles_len check (cardinality(design_styles) <= 16),
  add constraint client_scope_briefs_other_pages_len check (char_length(other_pages) <= 400),
  add constraint client_scope_briefs_other_features_len check (char_length(other_features) <= 400),
  add constraint client_scope_briefs_url_len check (char_length(current_website_url) <= 300),
  add constraint client_scope_briefs_website_notes_len check (char_length(current_website_notes) <= 2000),
  add constraint client_scope_briefs_other_style_len check (char_length(other_style) <= 200),
  add constraint client_scope_briefs_liked_len check (char_length(liked_websites) <= 1000),
  add constraint client_scope_briefs_notes_len check (char_length(additional_notes) <= 2000);

comment on column public.client_scope_briefs.selected_pages is
  'Additional pages requested. Homepage and responsive setup are implied, not stored here.';
comment on column public.client_scope_briefs.features is
  'Requested functionality. Not a priced inclusion until the proposal.';

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
  if not new.has_existing_website then
    new.current_website_url := '';
    new.current_website_notes := '';
  end if;
  if tg_op = 'INSERT' then
    new.submitted_at := coalesce(new.submitted_at, now());
  else
    new.submitted_at := coalesce(old.submitted_at, new.submitted_at, now());
  end if;
  new.updated_by := auth.uid();
  return new;
end;
$$;

revoke all on function public.client_scope_briefs_normalize() from public, anon;
