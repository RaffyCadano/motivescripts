-- Clients can cancel their own plan from the portal. An active plan is canceled at the END of the period the
-- client has already paid for (Stripe cancel_at_period_end), so the plan stays Active until then and they are
-- not charged again. cancel_at records that scheduled end so the portal and Admin can show "Ends <date>", and
-- so a client can change their mind before it happens.
--
-- Written only from the manage-service-plan Edge Function and the stripe-webhook (service role); the value
-- always mirrors what Stripe says, and a scheduled end that Stripe later removes clears it again.

alter table public.service_plans add column if not exists cancel_at timestamptz;

comment on column public.service_plans.cancel_at is
  'When Stripe will end this subscription (set when the client or an admin schedules a cancellation), or null when nothing is scheduled. status stays active until Stripe actually ends it.';

create or replace function public.set_service_plan_cancel_at(
  p_stripe_subscription_id text,
  p_cancel_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer;
begin
  -- Only a plan that is still running can have a scheduled end. A canceled plan keeps whatever it had.
  update public.service_plans
    set cancel_at = p_cancel_at
    where stripe_subscription_id = p_stripe_subscription_id
      and status in ('active', 'past_due')
      and cancel_at is distinct from p_cancel_at;
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;
revoke all on function public.set_service_plan_cancel_at(text, timestamptz) from public, anon, authenticated;
grant execute on function public.set_service_plan_cancel_at(text, timestamptz) to service_role;

comment on function public.set_service_plan_cancel_at(text, timestamptz) is
  'Webhook / Edge Function only. Records (or clears) the date Stripe will end a running subscription. Returns true when the value changed.';
