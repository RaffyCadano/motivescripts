-- Signed-out visitors only ever need to read published testimonials (row security already limits them to that),
-- but the role held every table privilege, including TRUNCATE, which row security does not cover. Keep SELECT only.
revoke all on public.testimonials from anon;
grant select on public.testimonials to anon;
