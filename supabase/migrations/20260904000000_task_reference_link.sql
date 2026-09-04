-- Optional external reference link per task (e.g. a Figma file for a design
-- task, a GitHub PR for a dev task). Plain URL field, no vendor integration.

alter table public.tasks add column if not exists reference_url text;

alter table public.tasks drop constraint if exists tasks_reference_url_length_check;
alter table public.tasks
  add constraint tasks_reference_url_length_check check (
    reference_url is null or length(reference_url) <= 2000
  );

comment on column public.tasks.reference_url is
  'Optional external link for this task (Figma, GitHub, etc.). Display-only, not validated against any provider.';
