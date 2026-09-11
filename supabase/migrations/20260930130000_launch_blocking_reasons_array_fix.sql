-- Fix found by direct-transition testing: `v_reasons || 'literal text'` is
-- ambiguous in Postgres between the array||array and array||element forms of
-- the || operator, and it resolved to array||array here -- trying to parse
-- the plain sentence as an array literal and raising "malformed array
-- literal", which aborted every call to launch_blocking_reasons() (and
-- therefore the launch gate trigger itself, for every project, even ones
-- that should legitimately be blocked with a real reason). array_append()
-- is unambiguous.

create or replace function public.launch_blocking_reasons(p_project_id uuid)
returns text[]
language plpgsql
stable
as $$
declare
  v_reasons text[] := '{}';
begin
  if not public.project_checkpoint_approved(p_project_id, 'overall_design') then
    v_reasons := array_append(v_reasons, 'Overall Design is not approved.');
  end if;
  if not public.development_tasks_complete(p_project_id) then
    v_reasons := array_append(v_reasons, 'Development is not complete.');
  end if;
  if public.qa_latest_result(p_project_id) is distinct from 'pass' then
    v_reasons := array_append(v_reasons, 'QA has not passed.');
  end if;
  if not public.project_client_review_complete(p_project_id) then
    v_reasons := array_append(v_reasons, 'Client review is not complete.');
  end if;
  if not public.project_checkpoint_approved(p_project_id, 'final_website') then
    v_reasons := array_append(v_reasons, 'The final website has not been approved.');
  end if;
  if not public.project_payment_gate_open(p_project_id) then
    v_reasons := array_append(v_reasons, 'An invoice for this project is still outstanding.');
  end if;
  return v_reasons;
end;
$$;

revoke all on function public.launch_blocking_reasons(uuid) from public, anon;
