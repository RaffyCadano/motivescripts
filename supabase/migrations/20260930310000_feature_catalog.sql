-- Feature Catalog: turns the previously hardcoded SCOPE_PAGE_OPTIONS /
-- SCOPE_FEATURE_OPTIONS (src/data/scopeBriefs.ts) into an admin-managed
-- table. This does NOT change how a client's scope selection or a
-- proposal's scope/line-item text is stored -- both already store raw
-- label TEXT (client_scope_briefs.selected_pages/features text[],
-- proposal_revisions.scope text, proposal_items.name text), frozen at the
-- time they're written. Renaming or deactivating a catalog item here only
-- changes what's OFFERED for new selections going forward; it can never
-- rewrite a historical proposal/contract/invoice, because none of them
-- reference this table -- they only ever copied the label text.
--
-- Same reason production-task generation (canonical_commercial_item() in
-- 20260909000000_catalog_additions.sql) is untouched by this migration: it
-- matches on the literal text already frozen into proposal/contract scope,
-- not on any id from here.

create table public.feature_catalog (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('page', 'feature')),
  name text not null check (length(trim(name)) > 0),
  slug text not null check (length(trim(slug)) > 0),
  description text,
  default_price_cents integer check (default_price_cents is null or default_price_cents >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Slugs are stable identifiers for a catalog item within its own category
-- (not globally unique -- "Other" legitimately exists as both a page and a
-- feature option today, and a global unique slug would collide on it).
create unique index feature_catalog_category_slug_uidx
  on public.feature_catalog (category, slug);

-- Prevent two active-or-not items with the same name in the same category
-- (case-insensitive) -- this is the "no duplicate name within category"
-- rule from the admin UI, enforced at the data layer too.
create unique index feature_catalog_category_name_uidx
  on public.feature_catalog (category, lower(trim(name)));

create index feature_catalog_active_order_idx
  on public.feature_catalog (category, sort_order) where is_active = true;

comment on table public.feature_catalog is
  'Admin-managed catalog of website scope "page" and "feature" options offered on the client scope form. Renaming/deactivating an item only affects future selections -- client_scope_briefs, proposal_revisions.scope, and proposal_items.name all store copied label text, never a reference to this table, so historical records are unaffected. See src/data/scopeBriefs.ts (SCOPE_PAGE_OPTIONS/SCOPE_FEATURE_OPTIONS, kept as migration/seed reference and as the fallback allow-list for a few call sites not yet converted -- see that file''s comments) and src/data/featureCatalogRepository.ts for the runtime consumer.';

alter table public.feature_catalog enable row level security;

drop policy if exists feature_catalog_select on public.feature_catalog;
drop policy if exists feature_catalog_admin_insert on public.feature_catalog;
drop policy if exists feature_catalog_admin_update on public.feature_catalog;
drop policy if exists feature_catalog_admin_delete on public.feature_catalog;

-- Any signed-in user (client or staff) may read active items -- the client
-- scope form and any staff-facing scope UI both need this. Admins alone
-- also see inactive items, for the management screen itself.
create policy feature_catalog_select
  on public.feature_catalog for select
  to authenticated
  using (is_active = true or public.is_admin());

create policy feature_catalog_admin_insert
  on public.feature_catalog for insert
  to authenticated
  with check (public.is_admin());

create policy feature_catalog_admin_update
  on public.feature_catalog for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy feature_catalog_admin_delete
  on public.feature_catalog for delete
  to authenticated
  using (public.is_admin());

-- No anon access at all -- the scope form is only ever shown to a signed-in
-- client, matching every other client-facing table in this schema.
revoke all on public.feature_catalog from public, anon;
grant select, insert, update, delete on public.feature_catalog to authenticated;

drop trigger if exists feature_catalog_set_updated_at on public.feature_catalog;
create trigger feature_catalog_set_updated_at
  before update on public.feature_catalog
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Seed: every existing SCOPE_PAGE_OPTIONS / SCOPE_FEATURE_OPTIONS value,
-- preserving current labels, current relative order (as sort_order), and
-- marked active. Nothing is omitted, per the migration's own requirement.
-- ---------------------------------------------------------------------------

insert into public.feature_catalog (category, name, slug, sort_order) values
  ('page', 'Services', 'services', 0),
  ('page', 'About', 'about', 1),
  ('page', 'Contact', 'contact', 2),
  ('page', 'Gallery / Portfolio', 'gallery-portfolio', 3),
  ('page', 'Testimonials', 'testimonials', 4),
  ('page', 'FAQ', 'faq', 5),
  ('page', 'Pricing', 'pricing', 6),
  ('page', 'Team', 'team', 7),
  ('page', 'Locations', 'locations', 8),
  ('page', 'Blog / News', 'blog-news', 9),
  ('page', 'Other', 'other', 10),
  ('feature', 'Contact Form', 'contact-form', 0),
  ('feature', 'Quote Request Form', 'quote-request-form', 1),
  ('feature', 'Booking / Appointment Form', 'booking-appointment-form', 2),
  ('feature', 'Online Payments', 'online-payments', 3),
  ('feature', 'E-commerce / Online Store', 'ecommerce-online-store', 4),
  ('feature', 'Customer Login', 'customer-login', 5),
  ('feature', 'Gallery', 'gallery', 6),
  ('feature', 'Google Maps', 'google-maps', 7),
  ('feature', 'Social Media Integration', 'social-media-integration', 8),
  ('feature', 'Newsletter Signup', 'newsletter-signup', 9),
  ('feature', 'Live Chat', 'live-chat', 10),
  ('feature', 'Other', 'other', 11);

-- Map the seven existing fixed add-on prices from agency_settings into the
-- catalog, reading the LIVE row (not the column defaults) so a Sandbox/Prod
-- instance that already customized these prices carries the real values
-- forward. Three of the seven (Quote Request Form, Booking / Appointment
-- Form, Social Media Integration) already exist as seeded rows above;
-- Website, Business Email, Domain, and Hosting Setup are not part of the
-- original SCOPE_PAGE_OPTIONS/SCOPE_FEATURE_OPTIONS lists (they're
-- proposal-editor-only add-ons today, see src/data/proposalPresets.ts), so
-- they're added here as new catalog rows per the explicit price-mapping
-- requirement -- additive only, nothing existing is renamed or removed.
do $$
declare
  s public.agency_settings;
begin
  select * into s from public.agency_settings where id = 1;
  if not found then
    return;
  end if;

  update public.feature_catalog
    set default_price_cents = s.default_addon_quote_request_form_cents
    where category = 'feature' and slug = 'quote-request-form';
  update public.feature_catalog
    set default_price_cents = s.default_addon_booking_form_cents
    where category = 'feature' and slug = 'booking-appointment-form';
  update public.feature_catalog
    set default_price_cents = s.default_addon_social_media_cents
    where category = 'feature' and slug = 'social-media-integration';

  insert into public.feature_catalog (category, name, slug, description, default_price_cents, sort_order) values
    ('feature', 'Website', 'website', 'Base website design and development package.', s.default_proposal_website_cents, 12),
    ('feature', 'Business Email', 'business-email', 'Professional email set up on the business domain.', s.default_addon_business_email_cents, 13),
    ('feature', 'Domain', 'domain', 'Domain name registration or connection.', s.default_addon_domain_cents, 14),
    ('feature', 'Hosting Setup', 'hosting-setup', 'Hosting setup so the finished website can go live.', s.default_addon_hosting_setup_cents, 15);
end $$;
