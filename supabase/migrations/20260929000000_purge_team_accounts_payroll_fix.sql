-- purge_team_accounts() predates payroll_payments (added 2026-09-14) and was
-- never updated to clean it up first. payroll_payments.staff_id references
-- auth.users(id) on delete restrict, so deleting a staff member's auth user
-- while they still have payroll payment history fails with:
--   update or delete on table "users" violates foreign key constraint
--   "payroll_payments_staff_id_fkey" on table "payroll_payments"
-- Delete their payroll_payments rows first. time_entries.payroll_payment_id
-- is on delete set null, so no other data is orphaned by this.

create or replace function public.purge_team_accounts()
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  removed integer := 0;
begin
  delete from public.staff_invitations where true;

  delete from public.notifications
  where user_id is distinct from auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.id = notifications.user_id
        and p.role in ('admin', 'staff')
    );

  begin
    delete from auth.identities
    where user_id is distinct from auth.uid()
      and exists (
        select 1
        from public.profiles p
        where p.id = auth.identities.user_id
          and p.role in ('admin', 'staff')
      );
  exception
    when undefined_table then null;
    when others then null;
  end;

  delete from public.staff_grants where user_id is distinct from auth.uid();
  delete from public.staff_profiles where user_id is distinct from auth.uid();

  delete from public.payroll_payments
  where staff_id is distinct from auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.id = payroll_payments.staff_id
        and p.role in ('admin', 'staff')
    );

  delete from auth.users u
  where u.id is distinct from auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.id = u.id
        and p.role in ('admin', 'staff')
    );

  get diagnostics removed = row_count;

  delete from public.profiles
  where id is distinct from auth.uid()
    and role in ('admin', 'staff');

  return removed;
end;
$$;
