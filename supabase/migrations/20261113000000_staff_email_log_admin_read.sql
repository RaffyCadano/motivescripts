-- Let an admin read the staff alert email log (20261112000000_staff_email_alerts.sql), so they can see which
-- alert emails each team member was sent, and when. A person could already read their own rows; nobody can write
-- to it from the app.

drop policy if exists staff_email_log_select_admin on public.staff_email_log;
create policy staff_email_log_select_admin on public.staff_email_log
  for select to authenticated
  using (public.is_admin());
