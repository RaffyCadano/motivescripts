-- Bug fix: reverse_invoice_payment() failed every time with
--   ERROR 42702: column reference "pay.invoice_id" is ambiguous
-- so the admin "Reverse" button never worked, for any payment.
--
-- Cause: 20260829200000_team_management.sql rewrote the function's permission check (via
-- apply_rpc_admin_guard) into a subquery that aliases payments as "pay", but the function also
-- declares a PL/pgSQL variable named "pay". PostgreSQL cannot tell the alias from the variable.
--
-- Fix: same behavior and same permission check (invoices.manage for that invoice's client), with the
-- variables renamed so nothing can collide. Only this function had the collision; every other function
-- patched by that migration was checked (their guard subqueries use unaliased columns and no variable
-- of the same name).

create or replace function public.reverse_invoice_payment(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay public.payments;
  v_inv public.invoices;
begin
  perform public.assert_client_perm(
    (select i.client_id
       from public.payments p
       join public.invoices i on i.id = p.invoice_id
      where p.id = p_payment_id),
    'invoices.manage'
  );
  select * into v_pay from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_pay.reversed_at is not null then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  select * into v_inv from public.invoices where id = v_pay.invoice_id for update;
  if v_inv.status = 'cancelled' then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  perform set_config('app.document_rpc', '1', true);
  update public.payments
    set reversed_at = now(), reversed_by = auth.uid()
    where id = v_pay.id;
  perform public.recalc_invoice_totals(v_inv.id);
  perform public.record_document_activity(
    v_inv.client_id, v_inv.project_id, 'payment_recorded',
    'Payment reversed on ' || v_inv.invoice_number
  );
end;
$$;

revoke all on function public.reverse_invoice_payment(uuid) from public, anon;
grant execute on function public.reverse_invoice_payment(uuid) to authenticated;
