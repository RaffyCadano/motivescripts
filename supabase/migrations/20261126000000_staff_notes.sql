-- Staff have never had an internal note trail, unlike clients (client_staff_data.notes) -- a real
-- gap found while auditing "what else needs done for the staffs": the Staff Performance panel
-- shows what someone's numbers look like, but there was nowhere to record why (a conversation
-- about being late, a verbal warning, context for a later promote/let-go decision).
--
-- A separate table, mirroring client_staff_data exactly (the staff-only extension that already
-- holds client notes, off to the side of the broadly-readable clients row) rather than a column on
-- staff_profiles: staff_profiles_select already lets a team.view holder or the row's own user read
-- that row, and RLS is row-level, not column-level -- a column can't be carved out of an existing
-- policy after the fact (a first attempt at exactly that, revoking column-level select after a
-- table-level grant, turned out to have no effect: a table-level grant still wins). A separate
-- table with its own admin-only policy is the same fix client_staff_data already relies on, so
-- this reuses a pattern already proven here instead of a new one.
create table public.staff_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.staff_profiles (user_id) on delete cascade,
  body text not null,
  -- Filled by the trigger below from the caller's own profile -- never trusted from the client, so
  -- authorship can't be forged (unlike client notes, which are written client-side wholesale).
  author text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index staff_notes_user_id_idx on public.staff_notes (user_id, created_at desc);

comment on table public.staff_notes is 'Internal notes about a staff member (agency only). Admin-only, like every other staff_profiles write.';

alter table public.staff_notes enable row level security;

create policy staff_notes_admin_select on public.staff_notes
  for select to authenticated
  using (public.is_admin());
create policy staff_notes_admin_insert on public.staff_notes
  for insert to authenticated
  with check (public.is_admin());

revoke all on public.staff_notes from public, anon;
grant select, insert on public.staff_notes to authenticated;

create or replace function public.staff_notes_set_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
  v_email text;
  v_body text;
begin
  v_body := trim(coalesce(new.body, ''));
  if v_body = '' then
    raise exception 'EMPTY_NOTE' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.staff_profiles where user_id = new.user_id) then
    -- A confirmed, real case elsewhere in this app (see adminStaffFallback in teamRepository.ts):
    -- an admin account created directly rather than through the invite flow has no staff_profiles
    -- row of its own. Notes should still work for them -- provision the same bare admin row that
    -- fallback already synthesizes client-side (this runs before the FK check below fires, so it's
    -- in place by the time this insert needs it). Anyone else missing a row is a genuinely broken
    -- state (every staff invite creates one), not something to paper over here.
    if exists (select 1 from public.profiles where id = new.user_id and role = 'admin') then
      insert into public.staff_profiles (user_id, template_key) values (new.user_id, 'admin');
    else
      raise exception 'NOT_FOUND' using errcode = 'P0001';
    end if;
  end if;

  select full_name, email into v_full_name, v_email from public.profiles where id = auth.uid();

  new.body := v_body;
  new.author := coalesce(nullif(trim(v_full_name), ''), v_email, 'Agency');
  new.created_by := auth.uid();
  new.created_at := now();
  return new;
end;
$$;

create trigger staff_notes_before_insert
  before insert on public.staff_notes
  for each row execute function public.staff_notes_set_author();

comment on function public.staff_notes_set_author() is
  'Computes a staff note''s author/timestamp server-side from the caller''s own profile, so neither can be forged from the client.';
