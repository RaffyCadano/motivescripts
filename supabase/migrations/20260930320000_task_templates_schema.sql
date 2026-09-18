-- Admin-Configurable Production Task Templates: schema.
--
-- Replaces the hardcoded task-definition portion of
-- prepare_project_production_from_paid_invoice() (values() lists of
-- title/description pairs, gated by inline scope-key checks) with a
-- database-backed catalog. Does NOT touch:
--   - canonical_commercial_item() / production_scope_keys_from_text() --
--     still the sole extractor of scope "keys" from accepted proposal/
--     contract text. This migration only changes what happens with those
--     keys once extracted, not how they're extracted.
--   - classify_task_type() / its tasks_default_task_type trigger -- kept as
--     a fallback default for any task inserted WITHOUT an explicit
--     task_type (hand-created tasks via the admin task form, or any future
--     insert path). Template-generated tasks will always pass task_type
--     explicitly (see 20260930340000), so this trigger becomes a no-op for
--     them, but it must not be removed: it's still load-bearing for
--     non-templated task creation.
--   - EXACT_TITLE_ROLES / TITLE_PREFIX_ROLES (src/data/taskRecommendedRoles.ts)
--     -- same reasoning, kept as the client-side fallback for tasks whose
--     stored recommended_role is null.
--
-- Design decision (materially changes task generation -- confirmed with the
-- user before implementing): today task_type and recommended_role are
-- DERIVED from task title text via hardcoded regex/exact-match tables, kept
-- "manually in sync" between a Postgres trigger and a TypeScript twin. That
-- is precisely what makes titles unsafe to edit today -- renaming a task
-- silently reclassifies (or fails to classify) it. Task templates instead
-- store task_type and recommended_role as their OWN explicit columns; the
-- generator (20260930340000) copies them straight onto the generated task,
-- so title becomes a free-text label with zero effect on workflow-gate
-- classification or role display, and templates can be safely renamed by
-- Admin at any time.

-- ---------------------------------------------------------------------------
-- 1. task_templates
-- ---------------------------------------------------------------------------

create table public.task_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (length(trim(slug)) > 0),
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  instructions text,
  milestone_key text not null check (milestone_key in ('discovery', 'design', 'development', 'review', 'launch')),
  task_type text not null check (task_type in (
    'discovery', 'content_collection', 'design', 'production', 'client_review', 'qa', 'handoff', 'internal'
  )),
  recommended_role text check (
    recommended_role is null
    or recommended_role in ('project_manager', 'designer', 'developer', 'content_writer', 'team_member')
  ),
  -- True for the "write copy" / "prepare contact information" / "migrate
  -- approved content" family: today these ALSO require the client to have
  -- purchased a distinct "content" or "content_migration" scope item (a
  -- Copywriting/Content Writing/Content Migration line, not any specific
  -- page), on top of whatever page-level scope_item_key this template maps
  -- to. See task_template_scope_items below for the page-level mapping.
  requires_content_scope boolean not null default false,
  estimated_hours numeric,
  -- Informational only. Per the production-workflow spec: a template's
  -- "required" flag must NEVER gate workflow enforcement -- the actual
  -- gate-critical tasks are identified structurally (task_type = 'qa' /
  -- 'client_review' / 'handoff', milestone, status), never by this column.
  -- No SQL function in this migration set reads is_required for anything
  -- other than display/warnings.
  is_required boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.task_templates is
  'Admin-managed definitions for production tasks. Renaming/editing a template only affects FUTURE production plans -- prepare_project_production_from_paid_invoice() copies each field onto the generated task row at creation time, so existing tasks are never touched by a later template edit (see 20260930340000).';

comment on column public.task_templates.is_required is
  'Display/warning hint only (e.g. "deactivating this may leave a scope item with no task"). Never read by any workflow-gate function.';

create index task_templates_milestone_sort_idx on public.task_templates (milestone_key, sort_order);
create index task_templates_active_idx on public.task_templates (is_active);

alter table public.task_templates enable row level security;

-- Admin-only in both directions: unlike feature_catalog (which the client
-- scope form and any staff proposal UI must read), nothing outside the
-- SECURITY DEFINER generator function ever needs to read task_templates --
-- staff work with the generated task instances, not the templates that
-- produced them. Least-privilege: no authenticated-read policy at all.
create policy task_templates_admin_select
  on public.task_templates for select
  to authenticated
  using (public.is_admin());

create policy task_templates_admin_insert
  on public.task_templates for insert
  to authenticated
  with check (public.is_admin());

create policy task_templates_admin_update
  on public.task_templates for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy task_templates_admin_delete
  on public.task_templates for delete
  to authenticated
  using (public.is_admin());

revoke all on public.task_templates from public, anon;
grant select, insert, update, delete on public.task_templates to authenticated;

create trigger task_templates_set_updated_at
  before update on public.task_templates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. task_template_scope_items: which commercial scope key(s) trigger this
--    template. Zero rows = unconditional (always generated), matching the
--    "always enqueue" tasks in today's function (Review approved scope,
--    Establish design direction, Prepare/deploy staging, Deploy production,
--    etc). Multiple rows = OR semantics -- any one key present in the
--    project's resolved scope keys is enough (this already covers today's
--    has_responsive/has_pages aggregate checks, which are themselves just
--    "any of these keys present").
--
--    scope_item_key reuses the exact vocabulary production_scope_keys_from_text()
--    already produces today (homepage, gallery, contact_form, ecommerce,
--    responsive, content, ...) -- not the Feature Catalog's page/feature
--    names, which are a distinct, client-facing concept (selectable options
--    with prices). Confirmed with the user before implementing.
-- ---------------------------------------------------------------------------

create table public.task_template_scope_items (
  id uuid primary key default gen_random_uuid(),
  task_template_id uuid not null references public.task_templates (id) on delete cascade,
  scope_item_key text not null check (length(trim(scope_item_key)) > 0),
  created_at timestamptz not null default now(),
  unique (task_template_id, scope_item_key)
);

create index task_template_scope_items_key_idx on public.task_template_scope_items (scope_item_key);

alter table public.task_template_scope_items enable row level security;

create policy task_template_scope_items_admin_select
  on public.task_template_scope_items for select
  to authenticated
  using (public.is_admin());

create policy task_template_scope_items_admin_insert
  on public.task_template_scope_items for insert
  to authenticated
  with check (public.is_admin());

create policy task_template_scope_items_admin_update
  on public.task_template_scope_items for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy task_template_scope_items_admin_delete
  on public.task_template_scope_items for delete
  to authenticated
  using (public.is_admin());

revoke all on public.task_template_scope_items from public, anon;
grant select, insert, update, delete on public.task_template_scope_items to authenticated;

-- ---------------------------------------------------------------------------
-- 3. task_template_checklist_items: ordered checklist snapshot source.
--    Genuinely new -- today's task_checklist_items (20260912000000) is
--    purely ad-hoc per task instance, with no template concept at all, so
--    there is no existing checklist data to migrate here. The generator
--    (20260930340000) copies these rows into task_checklist_items for each
--    newly generated task; editing a template's checklist afterward never
--    touches already-generated tasks' own checklist rows.
-- ---------------------------------------------------------------------------

create table public.task_template_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_template_id uuid not null references public.task_templates (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index task_template_checklist_items_template_sort_idx
  on public.task_template_checklist_items (task_template_id, sort_order);

alter table public.task_template_checklist_items enable row level security;

create policy task_template_checklist_items_admin_select
  on public.task_template_checklist_items for select
  to authenticated
  using (public.is_admin());

create policy task_template_checklist_items_admin_insert
  on public.task_template_checklist_items for insert
  to authenticated
  with check (public.is_admin());

create policy task_template_checklist_items_admin_update
  on public.task_template_checklist_items for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy task_template_checklist_items_admin_delete
  on public.task_template_checklist_items for delete
  to authenticated
  using (public.is_admin());

revoke all on public.task_template_checklist_items from public, anon;
grant select, insert, update, delete on public.task_template_checklist_items to authenticated;

create trigger task_template_checklist_items_set_updated_at
  before update on public.task_template_checklist_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. tasks: provenance columns. Both nullable/additive -- every existing
--    task row (and every task created by any path other than the
--    template-driven generator) keeps null here, unaffected.
-- ---------------------------------------------------------------------------

alter table public.tasks
  add column if not exists task_template_id uuid references public.task_templates (id) on delete set null;

create index if not exists tasks_task_template_id_idx on public.tasks (task_template_id) where task_template_id is not null;

comment on column public.tasks.task_template_id is
  'Which task_templates row generated this task, if any. Set once at generation time; a later edit to that template never touches this task (title/description/task_type/recommended_role/checklist already copied onto the task row itself). Null for hand-created or pre-template-system tasks.';

alter table public.tasks
  add column if not exists production_scope_key text;

comment on column public.tasks.production_scope_key is
  'The single commercial scope key (production_scope_keys_from_text() vocabulary, e.g. "homepage", "gallery") that triggered this task, if it was generated from a scope-conditional template. Lets the UI show "this copy is for the {page}" without re-parsing the task title (see contentWriterPageForTitle in src/data/productionTaskInstructions.ts, being replaced by a lookup on this column).';

-- ---------------------------------------------------------------------------
-- 5. try_insert_production_task: add a new, longer overload (Postgres
--    treats a different parameter count as a distinct function -- this does
--    NOT replace the existing 7-arg version, it coexists alongside it,
--    same as each earlier arity bump in this function's history already
--    did). enqueue_production_task always calls with exactly 7 positional
--    args, so it keeps resolving to the 7-arg overload unchanged, unaware
--    this new one exists. The new generator (20260930340000) calls this
--    11-arg overload directly and explicitly, bypassing enqueue_production_task
--    entirely so it can pass its own task_type/recommended_role/provenance
--    instead of relying on tasks_default_task_type's title regex.
-- ---------------------------------------------------------------------------

create or replace function public.try_insert_production_task(
  p_project_id uuid,
  p_milestone_id uuid,
  p_title text,
  p_description text,
  p_position integer,
  p_estimated_hours numeric default null,
  p_due_date date default null,
  p_task_type text default null,
  p_recommended_role text default null,
  p_task_template_id uuid default null,
  p_production_scope_key text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.tasks
    where project_id = p_project_id
      and lower(trim(title)) = lower(trim(p_title))
  ) then
    return false;
  end if;

  insert into public.tasks (
    project_id,
    milestone_id,
    title,
    description,
    status,
    priority,
    assignee,
    assigned_to,
    position,
    due_date,
    completed_at,
    estimated_hours,
    task_type,
    recommended_role,
    task_template_id,
    production_scope_key
  )
  values (
    p_project_id,
    p_milestone_id,
    p_title,
    coalesce(p_description, ''),
    'Todo',
    'Medium',
    '',
    null,
    p_position,
    p_due_date,
    null,
    p_estimated_hours,
    p_task_type,
    p_recommended_role,
    p_task_template_id,
    p_production_scope_key
  );
  return true;
end;
$$;

revoke all on function public.try_insert_production_task(
  uuid, uuid, text, text, integer, numeric, date, text, text, uuid, text
) from public, anon, authenticated;
