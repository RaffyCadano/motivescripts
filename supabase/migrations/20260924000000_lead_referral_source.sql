-- Referral source tracking on leads -- there was previously no way to see
-- which marketing channel actually produced an inquiry. `leads.source` only
-- distinguishes the internal intake channel ("Start a Project" vs "Manual"
-- staff entry), not where the prospect heard about the agency. Nullable and
-- defaulted so this is fully additive; existing rows are unaffected.

alter table public.leads
  add column if not exists referral_source text,
  add column if not exists referral_source_other text not null default '';

comment on column public.leads.referral_source is
  'How the prospect says they heard about the agency (Google Search, Referral, Social Media, Existing Client, Other). Validated app-side, same convention as leads.industry.';
comment on column public.leads.referral_source_other is
  'Free-text detail when referral_source is Other. Empty string when not applicable.';
