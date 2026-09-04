-- Let staff (not just clients) place pin comments, e.g. a PM flagging
-- something to a teammate on a proof. Mirrors client_submit_pin_comment's
-- server-side chain-of-custody derivation from version_id, swapping the
-- identity check for staff_may_project('feedback.manage') instead of
-- is_client(). The existing pin_comments_staff_insert RLS policy already
-- allows this at the table level; this RPC is the safer path (derives
-- project_id/deliverable_id/client_id server-side rather than trusting
-- them from the browser).

create or replace function public.staff_submit_pin_comment(
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
  select * into fv from public.file_versions where id = p_version_id and is_current;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  select * into d from public.deliverables where id = fv.deliverable_id;
  select * into p from public.projects where id = d.project_id;

  if not (public.is_admin() or public.staff_may_project(p.id, 'feedback.manage')) then
    raise exception 'Not allowed' using errcode = '42501';
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

revoke all on function public.staff_submit_pin_comment(uuid, numeric, numeric, text) from public, anon;
grant execute on function public.staff_submit_pin_comment(uuid, numeric, numeric, text) to authenticated;
